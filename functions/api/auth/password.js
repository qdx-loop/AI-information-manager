// POST /api/auth/password — 用户自助修改密码（需登录）
import { json, errorJson, requireUser, hashPassword, verifyPassword } from '../../lib/_auth'

export async function onRequestPost({ request, env }) {
  const { account: acc, error } = await requireUser(request, env)
  if (error) return error

  let body
  try {
    body = await request.json()
  } catch {
    return errorJson('请求格式错误', 400, 'BAD_BODY')
  }
  const oldPwd = String(body.oldPassword ?? '')
  const newPwd = String(body.newPassword ?? '')
  if (newPwd.length < 6) return errorJson('新密码至少 6 位', 400, 'WEAK_PASSWORD')
  if (!(await verifyPassword(oldPwd, acc.password_hash))) {
    return errorJson('旧密码不正确', 403, 'WRONG_OLD')
  }
  const stored = await hashPassword(newPwd)
  await env.DB.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').bind(stored, acc.id).run()
  return json({ ok: true })
}

export async function onRequest() {
  return errorJson('不支持的请求方法', 405, 'METHOD')
}
