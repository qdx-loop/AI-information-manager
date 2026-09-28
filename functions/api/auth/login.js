// POST /api/auth/login — 用户登录，签发令牌
// 限速：同一「用户名+IP」组合 15 分钟内失败 10 次即锁定（红队报告 P4）；
// 账户不存在时同样执行一次等价哈希，消除响应时序差（防用户名枚举，红队报告 D7）
import {
  json,
  errorJson,
  verifyPassword,
  hashPassword,
  issueUserToken,
  publicAccount,
  checkRateLimit,
  recordLoginFailure,
  clearLoginFailures,
  clientIp,
} from '../../lib/_auth'

const DUMMY_SALT = '0123456789abcdef0123456789abcdef'

export async function onRequestPost({ request, env }) {
  let body
  try {
    body = await request.json()
  } catch {
    return errorJson('请求格式错误', 400, 'BAD_BODY')
  }
  const username = String(body.username ?? '').trim()
  const password = String(body.password ?? '')
  if (!username || !password) return errorJson('请输入用户名和密码', 400, 'MISSING')

  const rateKey = `user:${username.toLowerCase()}:${clientIp(request)}`
  const limit = await checkRateLimit(env, rateKey, 10, 15 * 60_000)
  if (!limit.allowed) {
    return errorJson(`尝试次数过多，请约 ${limit.waitMin} 分钟后再试`, 429, 'RATE_LIMITED')
  }

  // 与注册一致：用户名不区分大小写
  const acc = await env.DB.prepare(
    'SELECT id, username, password_hash, contact, disabled, created_at FROM accounts WHERE username = ? COLLATE NOCASE',
  )
    .bind(username)
    .first()

  // 统一提示，不暴露"用户是否存在"；缺失账户同样消耗一次哈希运算
  let ok = false
  if (acc) {
    ok = await verifyPassword(password, acc.password_hash)
  } else {
    await hashPassword(password, DUMMY_SALT)
  }
  if (!ok) {
    await recordLoginFailure(env, rateKey)
    return errorJson('用户名或密码错误', 401, 'INVALID_CREDENTIALS')
  }
  if (acc.disabled) return errorJson('账户已被停用，请联系管理员', 403, 'DISABLED')

  await clearLoginFailures(env, rateKey)
  const now = Date.now()
  await env.DB.prepare('UPDATE accounts SET last_login = ? WHERE id = ?')
    .bind(now, acc.id)
    .run()

  const token = await issueUserToken(acc, env.AUTH_SECRET, env)
  return json({ token, account: publicAccount({ ...acc, last_login: now }) })
}

export async function onRequest() {
  return errorJson('不支持的请求方法', 405, 'METHOD')
}
