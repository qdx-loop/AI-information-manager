// POST /api/admin/login — 管理后台登录（密码来自 Cloudflare 环境变量 ADMIN_PASSWORD）
// 带 IP 维度限速：15 分钟内失败 5 次即锁定（红队报告 P4）
import {
  json,
  errorJson,
  issueAdminToken,
  checkRateLimit,
  recordLoginFailure,
  clearLoginFailures,
  clientIp,
  logAdmin,
} from '../../lib/_auth'

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD) {
    return errorJson('服务端未配置 ADMIN_PASSWORD 环境变量', 500, 'NOT_CONFIGURED')
  }
  const ip = clientIp(request)
  const limit = await checkRateLimit(env, `admin:${ip}`, 5, 15 * 60_000)
  if (!limit.allowed) {
    return errorJson(`失败次数过多，请约 ${limit.waitMin} 分钟后再试`, 429, 'RATE_LIMITED')
  }

  let body
  try {
    body = await request.json()
  } catch {
    return errorJson('请求格式错误', 400, 'BAD_BODY')
  }
  const password = String(body.password ?? '')
  if (password !== env.ADMIN_PASSWORD) {
    await recordLoginFailure(env, `admin:${ip}`)
    return errorJson('管理密码错误', 401, 'WRONG_ADMIN')
  }
  await clearLoginFailures(env, `admin:${ip}`)
  await logAdmin(env, request, 'login', '-', '管理后台登录成功')
  const token = await issueAdminToken(env.AUTH_SECRET)
  return json({ token })
}

export async function onRequest() {
  return errorJson('不支持的请求方法', 405, 'METHOD')
}
