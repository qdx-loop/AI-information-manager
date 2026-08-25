// POST /api/track — 基础数据埋点（需登录，按账号归因）
// 事件白名单：未注册的事件名静默忽略，防止滥用写入额度。
import { json, errorJson, requireUser } from '../lib/_auth'

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
