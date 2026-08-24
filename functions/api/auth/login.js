// POST /api/auth/login — 用户登录，签发令牌
import { json, errorJson, verifyPassword, issueUserToken } from '../../lib/_auth'

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

  const acc = await env.DB.prepare(
    'SELECT id, username, password_hash, expires_at, disabled, created_at FROM accounts WHERE username = ?',
  )
    .bind(username)
    .first()

  // 统一提示，不暴露“用户是否存在”
  if (!acc || !(await verifyPassword(password, acc.password_hash))) {
    return errorJson('用户名或密码错误', 401, 'INVALID_CREDENTIALS')
  }
  if (acc.disabled) return errorJson('账户已被停用，请联系管理员', 403, 'DISABLED')
  if (Date.now() > acc.expires_at) {
    return errorJson('您的账户已到期，请联系管理员续费', 403, 'EXPIRED')
  }

  await env.DB.prepare('UPDATE accounts SET last_login = ? WHERE id = ?')
    .bind(Date.now(), acc.id)
    .run()

  const token = await issueUserToken(acc, env.AUTH_SECRET)
  return json({
    token,
    account: {
      id: acc.id,
      username: acc.username,
      createdAt: acc.created_at,
      expiresAt: acc.expires_at,
      disabled: false,
    },
  })
}

export async function onRequest() {
  return errorJson('不支持的请求方法', 405, 'METHOD')
}
