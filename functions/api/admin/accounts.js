// /api/admin/accounts
//   GET — 列出全部账户（管理后台表格）
//
// 不再提供 POST 创建账户：产品已改为用户自助注册，管理员不再负责发卡。
import { json, requireAdmin, publicAccount } from '../../lib/_auth'

export async function onRequestGet({ request, env }) {
  const { error } = await requireAdmin(request, env)
  if (error) return error
  const { results } = await env.DB.prepare(
    'SELECT id, username, contact, disabled, created_at, last_login FROM accounts ORDER BY created_at DESC',
  ).all()
  return json({ accounts: results.map(publicAccount) })
}

export async function onRequest() {
  return json({ error: '不支持的请求方法', code: 'METHOD' }, 405)
}
