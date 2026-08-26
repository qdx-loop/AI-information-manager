// /api/admin/accounts
//   GET  — 列出全部账户（管理后台表格）
//   POST — 生成新账户：{ cardType: 'trial'|'month'|'quarter'|'year' } 或 { days: N }
//          返回明文用户名/密码，仅此一次；服务端只存哈希
import { json, errorJson, requireAdmin, CARD_TYPES, hashPassword, randomString, cardDays, publicAccount, logAdmin } from '../../lib/_auth'

export async function onRequestGet({ request, env }) {
  const { error } = await requireAdmin(request, env)
  if (error) return error
  const { results } = await env.DB.prepare(
    'SELECT id, username, expires_at, disabled, created_at, last_login FROM accounts ORDER BY created_at DESC',
  ).all()
  return json({ accounts: results.map(publicAccount) })
}

// 好记的用户名：单词 + 四位数字，如 tiger4821 / panda7392。
// 无任何符号、总长 8~10 位；词库×数字约 22 万组合，冲突自动重试，极端情况兜底纯随机串。
const USERNAME_WORDS = [
  'tiger', 'panda', 'eagle', 'otter', 'fox', 'wolf', 'deer', 'hawk',
  'lynx', 'bear', 'whale', 'falcon', 'raven', 'koala', 'horse', 'lion',
  'maple', 'coral', 'pine', 'river', 'cloud', 'star', 'ember', 'frost',
]

function pickWord(words) {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return words[buf[0] % words.length]
}

async function uniqueUsername(env) {
  for (let i = 0; i < 20; i++) {
    const num = 1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000)
    const name = `${pickWord(USERNAME_WORDS)}${num}`
    const hit = await env.DB.prepare('SELECT id FROM accounts WHERE username = ?').bind(name).first()
    if (!hit) return name
  }
  // 兜底：纯随机串（理论上极少走到）
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

  await logAdmin(env, request, 'create', username, `卡种天数=${days}，初始密码已生成（仅此一次）`)

  return json({
    account: publicAccount(await env.DB.prepare('SELECT id, username, expires_at, disabled, created_at, last_login FROM accounts WHERE id = ?').bind(id).first()),
    credentials: { username, password },
    days,
  })
}

export async function onRequest() {
  return errorJson('不支持的请求方法', 405, 'METHOD')
}