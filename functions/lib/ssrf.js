// SSRF 防护：判断目标主机/URL 是否为内网或保留地址。
// 纯函数、无依赖，便于单元测试；被 /api/ai/fetch 复用（首跳 + 每一跳重定向）。

// 判断 IPv4 点分十进制是否为内网/保留地址；畸形输入一律按内网处理（拒绝）
export function isPrivateIpv4(ip) {
  const parts = String(ip).split('.').map(Number)
  if (parts.length !== 4 || parts.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return true
  const [a, b] = parts
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true // 链路本地 / 云元数据 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  return false
}

export function isPrivateHost(host) {
  try {
    const h = String(host).toLowerCase().replace(/^\[|\]$/g, '')
    if (!h) return true

    // IPv6（含 IPv4 映射地址 ::ffff:a.b.c.d）
    if (h.includes(':')) {
      const mapped = h.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
      if (mapped) return isPrivateIpv4(mapped[1])
      if (h === '::1' || h === '::') return true // 环回 / 未指定
      if (/^fe8[0-9a-f]:/.test(h)) return true // 链路本地 fe80::/10
      if (/^f[cd][0-9a-f]{2}:/.test(h)) return true // 唯一本地 fc00::/7
      return false
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

// 校验 URL 是否允许抓取（协议 + 主机），供首次请求与每一跳重定向复用
export function isFetchableUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !/^https?:\/\//i.test(rawUrl)) {
    return { ok: false, reason: 'BAD_URL' }
  }
  let host
  try {
    host = new URL(rawUrl).hostname
  } catch {
    return { ok: false, reason: 'BAD_URL' }
  }
  if (!host || isPrivateHost(host)) return { ok: false, reason: 'BLOCKED_HOST' }
  return { ok: true }
}
