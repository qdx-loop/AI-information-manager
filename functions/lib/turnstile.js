// Cloudflare Turnstile 校验（仅用于自助注册，防脚本批量注册）
//
// 核心原则：**判定**与**故障**必须分开处理。
//   - siteverify 明确返回 success:false  → 这是「你是机器人」的判定，必须拒绝
//   - siteverify 网络异常 / 超时 / 非 2xx → 这是故障，不能用来当拒绝理由
//
// 为什么不能简单地「没带 token 也放行」：那样等于给机器人发了一张永久通行证——
// 脚本只要不加载 Turnstile 就直接绕过了。降级必须由**服务端自己观察到故障**来触发，
// 而不是由客户端声明，攻击者才无法主动触发降级。
//
// 降级策略：用 login_attempts 表记录 siteverify 的连续故障次数（与限速共用那张表，
// 本质是个 key→计数器）。连续故障达到阈值且在窗口内，才允许「没带 token」的请求通过；
// siteverify 一旦恢复正常立即清零、重新强制校验。
// 无论如何，原有的 IP 限速始终生效，降级期间也不会失去兜底。

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const HEALTH_KEY = 'turnstile:health'

// 连续多少次传输故障后进入降级窗口
const DEGRADE_AFTER = 3
// 降级窗口时长：超过这个时间还没恢复，也不再继续放行（防止永久降级）
const DEGRADE_WINDOW_MS = 60 * 60_000
// siteverify 自身的超时
const VERIFY_TIMEOUT_MS = 8000

/** 从环境变量读出允许的站点主机名（生产值不得包含 localhost/127.0.0.1） */
export function expectedHostnames(env) {
  return new Set(
    String(env.TURNSTILE_HOSTNAMES ?? '')
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean),
  )
}

export function isConfigured(env) {
  return Boolean(env.TURNSTILE_SECRET) && expectedHostnames(env).size > 0
}

// ———— 故障计数（D1；表缺失时 fail-open，行为与限速一致）————

async function readHealth(env) {
  try {
    const row = await env.DB.prepare('SELECT count, window_start FROM login_attempts WHERE key = ?')
      .bind(HEALTH_KEY)
      .first()
    if (!row) return { failures: 0, since: 0 }
    return { failures: Number(row.count), since: Number(row.window_start) }
  } catch {
    return { failures: 0, since: 0 }
  }
}

async function writeHealth(env, failures, since) {
  try {
    await env.DB.prepare(
      'INSERT INTO login_attempts (key, count, window_start) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET count = excluded.count, window_start = excluded.window_start',
    )
      .bind(HEALTH_KEY, failures, since)
      .run()
  } catch {
    /* 忽略：健康计数写失败不影响主流程 */
  }
}

async function recordFailure(env) {
  const { failures, since } = await readHealth(env)
  const now = Date.now()
  // 窗口过期视为新的故障序列
  if (now - since > DEGRADE_WINDOW_MS) await writeHealth(env, 1, now)
  else await writeHealth(env, failures + 1, since || now)
}

async function clearFailures(env) {
  try {
    await env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(HEALTH_KEY).run()
  } catch {
    /* 忽略 */
  }
}

async function isDegraded(env) {
  const { failures, since } = await readHealth(env)
  return failures >= DEGRADE_AFTER && Date.now() - since <= DEGRADE_WINDOW_MS
}

// ———— 主校验 ————

/**
 * @param env Pages 环境（需要 TURNSTILE_SECRET / TURNSTILE_HOSTNAMES）
 * @param token 客户端提交的 cf-turnstile-response
 * @param action 期望的 action（注册固定为 'signup'）
 * @param ip 客户端 IP，siteverify 用它做额外风控
 * @returns { ok: true, degraded: boolean } | { ok: false, code: string, message: string }
 */
export async function verifyTurnstile(env, token, action, ip) {
  if (!isConfigured(env)) {
    // 尚未配置（例如本地开发）：完全放行，由 IP 限速兜底
    return { ok: true, degraded: true, reason: 'not_configured' }
  }

  if (typeof token !== 'string' || token.length === 0) {
    if (await isDegraded(env)) return { ok: true, degraded: true, reason: 'degraded' }
    return { ok: false, code: 'TURNSTILE_REQUIRED', message: '请先完成人机验证' }
  }
  if (token.length > 2048) {
    return { ok: false, code: 'TURNSTILE_INVALID', message: '人机验证失败，请重试' }
  }

  let result
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: token,
        ...(ip && ip !== 'unknown' ? { remoteip: ip } : {}),
      }),
    })
    if (!res.ok) throw new Error(`siteverify ${res.status}`)
    result = await res.json()
  } catch (e) {
    // 故障不是判定：记录一次并放行，交给 IP 限速兜底
    await recordFailure(env)
    console.warn('[turnstile] siteverify 不可用，已按故障放行:', e?.message)
    return { ok: true, degraded: true, reason: 'verify_unavailable' }
  }

  // 拿到了有效响应 → 故障计数清零
  await clearFailures(env)

  if (!result?.success) {
    return { ok: false, code: 'TURNSTILE_FAILED', message: '人机验证未通过，请重试' }
  }
  if (action && result.action && result.action !== action) {
    return { ok: false, code: 'TURNSTILE_ACTION', message: '人机验证与当前操作不匹配' }
  }
  const hosts = expectedHostnames(env)
  // siteverify 不回传 hostname 时（极少见）不额外卡死，避免误伤真人
  if (result.hostname && !hosts.has(result.hostname)) {
    console.warn('[turnstile] hostname 不在白名单:', result.hostname)
    return { ok: false, code: 'TURNSTILE_HOST', message: '人机验证来源不合法' }
  }
  return { ok: true, degraded: false }
}
