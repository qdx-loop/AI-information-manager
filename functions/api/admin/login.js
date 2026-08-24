// POST /api/admin/login — 管理后台登录（密码来自 Cloudflare 环境变量 ADMIN_PASSWORD）
import { json, errorJson, issueAdminToken } from '../../lib/_auth'

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD) {
    return errorJson('服务端未配置 ADMIN_PASSWORD 环境变量', 500, 'NOT_CONFIGURED')
  }
  let body
  try {
    body = await request.json()
  } catch {
    return errorJson('请求格式错误', 400, 'BAD_BODY')
  }
  const password = String(body.password ?? '')
  if (password !== env.ADMIN_PASSWORD) {
    return errorJson('管理密码错误', 401, 'WRONG_ADMIN')
  }
  const token = await issueAdminToken(env.AUTH_SECRET)
  return json({ token })
}

export async function onRequest() {
  return errorJson('不支持的请求方法', 405, 'METHOD')
}
