// POST /api/admin/account — 对单个账户执行管理操作
// body: { accountId, op: 'disable'|'enable'|'delete'|'resetPassword' }
//
// 2026-09 变化：删掉 renew（不再有卡种/续费），新增 resetPassword。
// 重置密码是自助注册后的必要客服能力——用户自己设的密码，只有用户自己知道，
// 忘记后唯一出路就是管理员重置。新密码仅此一次明文返回，服务端只存哈希。
// 每次重置都会 pwd_epoch +1，立即吊销该用户所有已签发的令牌。
import {
  json,
  errorJson,
  requireAdmin,
  hashPassword,
  randomString,
  MIN_PASSWORD,
  logAdmin,
} from '../../lib/_auth'

const TEMP_PASSWORD_LEN = 10

export async function onRequestPost({ request, env }) {
  const { error } = await requireAdmin(request, env)
  if (error) return error

  let body
  try {
    body = await request.json()
  } catch {
    return errorJson('请求格式错误', 400, 'BAD_BODY')
  }
  const { accountId, op } = body
  if (!accountId || !op) return errorJson('缺少 accountId 或 op', 400, 'MISSING')

  const acc = await env.DB.prepare('SELECT id, username, disabled FROM accounts WHERE id = ?')
    .bind(accountId)
    .first()
  if (!acc) return errorJson('账户不存在', 404, 'NO_ACCOUNT')

  switch (op) {
    case 'disable': {
      await env.DB.prepare('UPDATE accounts SET disabled = 1 WHERE id = ?').bind(accountId).run()
      await logAdmin(env, request, 'disable', acc.username)
      return json({ ok: true })
    }
    case 'enable': {
      await env.DB.prepare('UPDATE accounts SET disabled = 0 WHERE id = ?').bind(accountId).run()
      await logAdmin(env, request, 'enable', acc.username)
      return json({ ok: true })
    }
    case 'delete': {
      await env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId).run()
      await logAdmin(env, request, 'delete', acc.username)
      return json({ ok: true })
    }
    case 'resetPassword': {
      // 管理员可指定新密码；不指定则生成一个不易猜的临时密码
      const chosen = typeof body.newPassword === 'string' ? body.newPassword.trim() : ''
      if (chosen && chosen.length < MIN_PASSWORD) {
        return errorJson(`新密码至少 ${MIN_PASSWORD} 位`, 400, 'WEAK_PASSWORD')
      }
      if (chosen.length > 200) return errorJson('新密码过长', 400, 'WEAK_PASSWORD')
      const password = chosen || randomString(TEMP_PASSWORD_LEN)

      const stored = await hashPassword(password)
      // pwd_epoch +1 → 该用户所有旧令牌立即失效，必须用新密码重新登录
      try {
        await env.DB.prepare('UPDATE accounts SET password_hash = ?, pwd_epoch = pwd_epoch + 1 WHERE id = ?')
          .bind(stored, accountId)
          .run()
      } catch (e) {
        // pwd_epoch 列缺失（未迁移）时仍允许改密，只是旧令牌不会立即失效
        console.warn('[admin] pwd_epoch 更新失败（请执行 migration-pwd-epoch.sql）:', e?.message)
        await env.DB.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?')
          .bind(stored, accountId)
          .run()
      }
      await logAdmin(env, request, 'resetPassword', acc.username, chosen ? '管理员指定' : '生成临时密码')
      return json({ ok: true, password })
    }
    default:
      return errorJson('未知操作', 400, 'BAD_OP')
  }
}

export async function onRequest() {
  return errorJson('不支持的请求方法', 405, 'METHOD')
}
