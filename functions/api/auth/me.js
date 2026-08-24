// GET /api/auth/me — 携带 Bearer token，返回账户最新状态（到期/停用实时生效）
import { json, errorJson, requireUser, publicAccount } from '../../lib/_auth'

export async function onRequestGet({ request, env }) {
  const { account: acc, error } = await requireUser(request, env)
  if (error) return error
  return json({ account: publicAccount(acc) })
}

export async function onRequest() {
  return errorJson('不支持的请求方法', 405, 'METHOD')
}
