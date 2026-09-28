// /api/auth/register — 自助注册
//   GET  — { open: boolean }：注册是否开放（环境变量 REGISTRATION_OPEN 控制，用于被灌水时紧急关闭）
//   POST — { username, password, contact? } → { token, account }
//
// 设计要点：
//  - 永久免费，注册成功即登录（直接下发令牌，省掉「注册完再登录一次」）
//  - 用户名不区分大小写去重：DB 上是 UNIQUE（区分大小写），这里显式查重并给出
//    友好提示，避免出现 Alice / alice 两个近似账号
//  - 按 IP 限速，防止脚本批量灌水；限速表复用 login_attempts（fail-open 降级）
//  - 注册写入 admin_audit，管理员在同一个地方就能看到谁在什么时候注册
import {
  json,
  errorJson,
  hashPassword,
  issueUserToken,
  publicAccount,
  validateRegistration,
  clientIp,
  checkWindowCount,
  logAdmin,
} from '../../lib/_auth'

// 同一 IP 每小时最多注册 5 个。正常用户一生只注册一次，
// 这个阈值只用来挡住脚本，不会影响真人。
const REGISTER_MAX = 5
const REGISTER_WINDOW_MS = 60 * 60_000

function registrationOpen(env) {
  // 未设置时默认开放；设为 0 / false / off 即关闭
  const raw = env.REGISTRATION_OPEN
  if (raw === undefined || raw === null || raw === '') return true
  return !/^(0|false|off|no)$/i.test(String(raw).trim())
}

export async function onRequestGet({ env }) {
  return json({ open: registrationOpen(env) })
}

export async function onRequestPost({ request, env }) {
  if (!registrationOpen(env)) {
    return errorJson('暂时关闭了注册，请稍后再试', 403, 'REGISTRATION_CLOSED')
  }

  let body
  try {
    body = await request.json()
  } catch {
    return errorJson('请求格式错误', 400, 'BAD_BODY')
  }

  const v = validateRegistration(body)
  if (!v.ok) return errorJson(v.message, 400, 'INVALID_' + String(v.field).toUpperCase())

  const ip = clientIp(request)
  const gate = await checkWindowCount(env, `reg:${ip}`, REGISTER_MAX, REGISTER_WINDOW_MS)
  if (!gate.allowed) {
    return errorJson(`注册过于频繁，请 ${gate.waitMin} 分钟后再试`, 429, 'RATE_LIMITED')
  }

  // 用户名大小写不敏感去重
  const clash = await env.DB.prepare(
    'SELECT id FROM accounts WHERE username = ? COLLATE NOCASE',
  )
    .bind(v.value.username)
    .first()
  if (clash) return errorJson('该用户名已被注册，换一个试试', 409, 'USERNAME_TAKEN')

  const id = crypto.randomUUID()
  const now = Date.now()
  const stored = await hashPassword(v.value.password)

  try {
    await env.DB.prepare(
      'INSERT INTO accounts (id, username, password_hash, salt, disabled, created_at, last_login, contact) VALUES (?, ?, ?, ?, 0, ?, ?, ?)',
    )
      .bind(id, v.value.username, stored, '', now, now, v.value.contact)
      .run()
  } catch (e) {
    // 并发同用户名注册时唯一索引会兜底，避免把底层错误抛给用户
    if (String(e?.message || '').includes('UNIQUE')) {
      return errorJson('该用户名已被注册，换一个试试', 409, 'USERNAME_TAKEN')
    }
    throw e
  }

  await logAdmin(env, request, 'register', v.value.username, '自助注册')

  const account = { id, username: v.value.username, contact: v.value.contact, created_at: now, last_login: now, disabled: 0 }
  return json({ token: await issueUserToken(account, env.AUTH_SECRET, env), account: publicAccount(account) })
}

export async function onRequest() {
  return errorJson('不支持的请求方法', 405, 'METHOD')
}
