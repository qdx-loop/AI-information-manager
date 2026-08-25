// POST /api/admin/account — 对单个账户执行操作
// body: { accountId, op: 'renew'|'disable'|'enable'|'delete', cardType?, days? }
// 注意：不提供重置密码的能力——卖家不可触碰买家凭证（产品决策，见 PRODUCT.md）
import { json, errorJson, requireAdmin, hashPassword, cardDays } from '../../lib/_auth'

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

  const acc = await env.DB.prepare('SELECT id, username, expires_at, disabled FROM accounts WHERE id = ?')
    .bind(accountId)
    .first()
  if (!acc) return errorJson('账户不存在', 404, 'NO_ACCOUNT')

  switch (op) {
    case 'renew': {
      const days = cardDays(body)
      if (!days) return errorJson('无效的续费时长', 400, 'BAD_CARD')
      // 从 max(当前时间, 现有到期时间) 起累加；未到期续费不亏天数，已到期从今天算
      const base = Math.max(Date.now(), acc.expires_at)
      const expiresAt = base + days * 86400000 - 1
      await env.DB.prepare('UPDATE accounts SET expires_at = ?, disabled = 0 WHERE id = ?')
        .bind(expiresAt, accountId)
        .run()
      return json({ ok: true, expiresAt })
    }
    case 'disable': {
      await env.DB.prepare('UPDATE accounts SET disabled = 1 WHERE id = ?').bind(accountId).run()
      return json({ ok: true })
    }
    case 'enable': {
      await env.DB.prepare('UPDATE accounts SET disabled = 0 WHERE id = ?').bind(accountId).run()
      return json({ ok: true })
    }
    case 'delete': {
      await env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId).run()
      return json({ ok: true })
    }
    default:
      return errorJson('未知操作', 400, 'BAD_OP')
  }
}

export async function onRequest() {
  return errorJson('不支持的请求方法', 405, 'METHOD')
}
