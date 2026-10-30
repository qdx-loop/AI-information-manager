// POST /api/track — 基础数据埋点（需登录，按账号归因）
// 事件白名单：未注册的事件名静默忽略，防止滥用写入额度。
import { json, errorJson, requireUser, checkWindowCount } from '../lib/_auth'

// 每个账号每小时最多上报 120 条（可用 TRACK_RATE_MAX / TRACK_RATE_WINDOW_MS 调整）。
// 为什么必须限速：每次上报 = 1 次 D1 写，而 D1 免费额度写 10 万/日；登录/注册/限速
// 本身也写 D1，一个人写满配额就会让全站登录失败（审计 P1-4）。
const TRACK_MAX = 120
const TRACK_WINDOW_MS = 60 * 60_000

const ALLOWED = new Set([
  'login',
  'library_created',
  'item_created',
  'items_imported',
  'ai_message_sent',
  'demo_created',
])

export async function onRequestPost({ request, env }) {
  const { account, error } = await requireUser(request, env)
  if (error) return error

  // 限速放在解析 body 之前：畸形请求同样消耗一次计数，避免用它绕开计数
  const maxCount = Number(env.TRACK_RATE_MAX) > 0 ? Number(env.TRACK_RATE_MAX) : TRACK_MAX
  const windowMs = Number(env.TRACK_RATE_WINDOW_MS) > 0 ? Number(env.TRACK_RATE_WINDOW_MS) : TRACK_WINDOW_MS
  const limit = await checkWindowCount(env, `track:${account.id}`, maxCount, windowMs)
  if (!limit.allowed) {
    return errorJson(`上报过于频繁，请约 ${limit.waitMin} 分钟后再试`, 429, 'RATE_LIMITED')
  }

  let body
  try {
    body = await request.json()
  } catch {
    return errorJson('请求格式错误', 400, 'BAD_BODY')
  }

  const name = String(body?.name ?? '')
  if (!ALLOWED.has(name)) return json({ ok: true })

  let props = ''
  if (body?.props != null) {
    try {
      props = JSON.stringify(body.props).slice(0, 500)
    } catch {
      props = ''
    }
  }

  try {
    await env.DB.prepare(
      'INSERT INTO analytics_events (account_id, name, props, created_at) VALUES (?, ?, ?, ?)',
    )
      .bind(account.id, name, props, Date.now())
      .run()
  } catch (e) {
    console.warn('[track] 写入失败:', e?.message)
  }
  return json({ ok: true })
}

export async function onRequest() {
  return errorJson('不支持的请求方法', 405, 'METHOD')
}
