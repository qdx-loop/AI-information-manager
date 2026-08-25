// /api/admin/audit — 管理端操作审计查询（最近 200 条）
import { json, errorJson, requireAdmin } from '../../lib/_auth'

export async function onRequestGet({ request, env }) {
  const { error } = await requireAdmin(request, env)
  if (error) return error
  const { results } = await env.DB.prepare(
    'SELECT action, target, detail, ip, created_at FROM admin_audit ORDER BY created_at DESC LIMIT 200',
  ).all()
  return json({ logs: results ?? [] })
}

export async function onRequest() {
  return errorJson('不支持的请求方法', 405, 'METHOD')
}
