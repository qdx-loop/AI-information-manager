// /api/admin/accounts
//   GET  — 列出全部账户（管理后台表格）
//   POST — 生成新账户：{ cardType: 'trial'|'month'|'quarter'|'year' } 或 { days: N }
//          返回明文用户名/密码，仅此一次；服务端只存哈希
import { json, errorJson, requireAdmin, CARD_TYPES, hashPassword, randomString, cardDays, publicAccount } from '../../lib/_auth'

export async function onRequestGet({ request, env }) {
  const { error } = await requireAdmin(request, env)
  if (error) return error
  const { results } = await env.DB.prepare(
    'SELECT id, username, expires_at, disabled, created_at, last_login FROM accounts ORDER BY created_at DESC',
  ).all()
  return json({ accounts: results.map(publicAccount) })
}

async function uniqueUsername(env) {
  for (let i = 0; i < 10; i++) {
    const name = 'u' + randomString(7).toLowerCase()
    const hit = await env.DB.prepare('SELECT id FROM accounts WHERE username = ?').bind(name).first()
    if (!hit) return name
  }
  throw new Error('无法生成唯一用户名')
}

export async function onRequestPost({ request, env }) {
  const { error } = await requireAdmin(request, env)
  if (error) return error

  let body
  try {
    body = await request.json()
  } catch {
    return errorJson('请求格式错误', 400, 'BAD_BODY')
  }
  const days = cardDays(body)
  if (!days) {
    return errorJson(`无效的卡种。可用卡种：${Object.keys(CARD_TYPES).join(', ')} 或 days=1~3650`, 400, 'BAD_CARD')
  }

  const id = crypto.randomUUID()
  const username = await uniqueUsername(env)
  const password = randomString(10)
  const now = Date.now()
  // 有效期从现在起算；到期时间精确到当天 23:59:59，避免“当天就过期”的体验问题
  const expiresAt = now + days * 86400000 - 1

  const stored = await hashPassword(password)
  await env.DB.prepare(
    'INSERT INTO accounts (id, username, password_hash, salt, expires_at, disabled, created_at, last_login) VALUES (?, ?, ?, ?, ?, 0, ?, NULL)',
  )
    .bind(id, username, stored, '', expiresAt, now)
    .run()

  return json({
    account: publicAccount(await env.DB.prepare('SELECT id, username, expires_at, disabled, created_at, last_login FROM accounts WHERE id = ?').bind(id).first()),
    credentials: { username, password },
    days,
  })
}

export async function onRequest() {
  return errorJson('不支持的请求方法', 405, 'METHOD')
}
