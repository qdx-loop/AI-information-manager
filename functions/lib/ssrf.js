// SSRF 防护：判断目标主机/URL 是否为内网或保留地址。
// 纯函数、无依赖，便于单元测试；被 /api/ai/fetch 复用（首跳 + 每一跳重定向）。
//
// 2026-10 审计补强（P2-1）：原实现有 6 个实测绕过——
//   [::ffff:7f00:1]（IPv4-mapped 的十六进制写法，正则只认点分形式）、
//   [fe90::1] / [febf::1]（fe80::/10 只写了 fe8x，漏掉 fe9x–febx）、
//   192.0.0.1（192.0.0.0/24）、198.18.0.1（198.18.0.0/15）、
//   224.0.0.1（组播 224.0.0.0/4）、255.255.255.255（240.0.0.0/4 保留）。
// 修法：IPv6 先解析成 16 字节再按前缀判断（不再用正则猜字符串），IPv4 补全保留段，
// 并把端口白名单（仅 80/443）放进 URL 校验——否则可以拿它做任意端口探测。

// 判断 IPv4 点分十进制是否为内网/保留地址；畸形输入一律按内网处理（拒绝）
export function isPrivateIpv4(ip) {
  const parts = String(ip).split('.').map(Number)
  if (parts.length !== 4 || parts.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return true
  const [a, b, c] = parts
  if (a === 0) return true // 0.0.0.0/8（含 0.0.0.0）
  if (a === 10) return true
  if (a === 127) return true // 环回
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64.0.0/10
  if (a === 169 && b === 254) return true // 链路本地 / 云元数据 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 0 && c === 0) return true // 192.0.0.0/24（IETF 协议分配段）
  if (a === 192 && b === 168) return true
  if (a === 198 && (b === 18 || b === 19)) return true // 198.18.0.0/15 基准测试段
  if (a >= 224) return true // 224.0.0.0/4 组播 + 240.0.0.0/4 保留 + 255.255.255.255 广播
  return false
}

// 把 IPv6 字面量解析成 16 个字节；解析失败返回 null（调用方按「不可信」处理）。
// 支持 :: 压缩、内嵌 IPv4（::ffff:127.0.0.1 与 ::ffff:7f00:1 两种写法）、%zone id。
function parseIpv6(host) {
  let h = String(host).toLowerCase().replace(/^\[|\]$/g, '')
  const zone = h.indexOf('%') // fe80::1%eth0：zone id 不参与地址判断
  if (zone !== -1) h = h.slice(0, zone)
  if (!h.includes(':')) return null

  // 末尾内嵌 IPv4 先换成两个 hextet，后面就能统一按纯十六进制处理
  const lastColon = h.lastIndexOf(':')
  const maybeV4 = h.slice(lastColon + 1)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(maybeV4)) {
    const p = maybeV4.split('.').map(Number)
    if (p.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return null
    const hi = ((p[0] << 8) | p[1]).toString(16)
    const lo = ((p[2] << 8) | p[3]).toString(16)
    h = `${h.slice(0, lastColon + 1)}${hi}:${lo}`
  }

  const halves = h.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  let groups
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length
    if (missing < 0) return null
    groups = [...head, ...Array(missing).fill('0'), ...tail]
  } else {
    groups = head
  }
  if (groups.length !== 8) return null
  const bytes = []
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null
    const n = parseInt(g, 16)
    bytes.push(n >> 8, n & 0xff)
  }
  return bytes
}

// 按前缀判断 IPv6 是否内网/保留/组播；IPv4-mapped 地址要落回 IPv4 规则
function isPrivateIpv6Bytes(bytes) {
  const zeroPrefix = bytes.slice(0, 10).every((b) => b === 0)
  // ::ffff:a.b.c.d（IPv4-mapped）与 ::a.b.c.d（IPv4-compatible）都按内嵌 IPv4 判断，
  // 这样十六进制写法 [::ffff:7f00:1] 与点分写法 [::ffff:127.0.0.1] 得到同一结论。
  if (zeroPrefix) return isPrivateIpv4(bytes.slice(12).join('.'))
  if (bytes[0] === 0xff) return true // ff00::/8 组播
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true // fe80::/10 全段（fe80–febf）
  if ((bytes[0] & 0xfe) === 0xfc) return true // fc00::/7 唯一本地
  return false
}

export function isPrivateHost(host) {
  try {
    const h = String(host).toLowerCase().replace(/^\[|\]$/g, '')
    if (!h) return true

    // IPv6（含 IPv4-mapped）
    if (h.includes(':')) {
      const bytes = parseIpv6(h)
      if (!bytes) return true // 解析不了就按内网处理（fail-closed）
      return isPrivateIpv6Bytes(bytes)
    }

    // IPv4
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return isPrivateIpv4(h)

    // 域名
    return (
      h === 'localhost' ||
      h === 'local' ||
      h.endsWith('.localhost') ||
      h.endsWith('.local') ||
      h.endsWith('.lan') ||
      h.endsWith('.internal') ||
      h.endsWith('.home')
    )
  } catch {
    return true
  }
}

// 只允许标准 Web 端口：非标准端口是端口探测/内网服务探测的入口
// （审计实测 http://example.com:22/ 原实现放行）。
const ALLOWED_PORTS = new Set([80, 443])

// 校验 URL 是否允许抓取（协议 + 端口 + 主机），供首次请求与每一跳重定向复用
export function isFetchableUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !/^https?:\/\//i.test(rawUrl)) {
    return { ok: false, reason: 'BAD_URL' }
  }
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { ok: false, reason: 'BAD_URL' }
  }
  // URL 省略端口时按协议默认端口算；显式写 :80/:443 也放行
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80
  if (!ALLOWED_PORTS.has(port)) return { ok: false, reason: 'BAD_PORT' }
  const host = parsed.hostname
  if (!host || isPrivateHost(host)) return { ok: false, reason: 'BLOCKED_HOST' }
  return { ok: true }
}
