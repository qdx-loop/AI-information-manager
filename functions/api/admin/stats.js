// GET /api/admin/stats — 运营概览：近 7 天活跃/注册、关键行为、续费漏斗与卡种转化
import { json, errorJson, requireAdmin } from '../../lib/_auth'

export async function onRequestGet({ request, env }) {
  const { error } = await requireAdmin(request, env)
  if (error) return error

  const since = Date.now() - 7 * 86400000
  const monthAgo = Date.now() - 30 * 86400000
  try {
    const [active, signups, events, renews, expiry, trialTotal, trialRenewed] = await Promise.all([
      env.DB.prepare(
        'SELECT COUNT(DISTINCT account_id) AS n FROM analytics_events WHERE created_at > ?',
      )
        .bind(since)
        .first(),
      env.DB.prepare('SELECT COUNT(*) AS n FROM accounts WHERE created_at > ?')
        .bind(since)
        .first(),
      env.DB.prepare(
        'SELECT name, COUNT(*) AS c FROM analytics_events WHERE created_at > ? GROUP BY name ORDER BY c DESC',
      )
        .bind(since)
        .all(),
      // 近 30 天续费操作数（audit 中 action='renew'）
      env.DB.prepare(
        "SELECT COUNT(*) AS n FROM admin_audit WHERE action = 'renew' AND created_at > ?",
      )
        .bind(monthAgo)
        .first(),
      // 近 30 天内到期的账号数（续费率分母：含刚到期的）
      env.DB.prepare(
        'SELECT COUNT(*) AS n FROM accounts WHERE expires_at > ? AND expires_at <= ?',
      )
        .bind(monthAgo, Date.now())
        .first(),
      // 体验卡总数（卡期 <= 7 天）
      env.DB.prepare(
        'SELECT COUNT(*) AS n FROM accounts WHERE expires_at - created_at <= 7 * 86400000',
      ).first(),
      // 体验卡中被续过费的数量（audit renew 记录按用户名对上）
      env.DB.prepare(
        "SELECT COUNT(DISTINCT a.id) AS n FROM accounts a JOIN admin_audit r ON r.action = 'renew' AND r.target = a.username WHERE a.expires_at - a.created_at <= 7 * 86400000",
      ).first(),
    ])
    return json({
      activeUsers7: Number(active?.n ?? 0),
      signups7: Number(signups?.n ?? 0),
      events7: (events.results ?? []).map((r) => ({ name: String(r.name), count: Number(r.c) })),
      // —— 续费漏斗（近 30 天）——
      renewCount30: Number(renews?.n ?? 0),
      expiredCount30: Number(expiry?.n ?? 0),
      trialTotal: Number(trialTotal?.n ?? 0),
      trialRenewed: Number(trialRenewed?.n ?? 0),
    })
  } catch (e) {
    // 未执行迁移时静默降级为空数据，不阻塞后台加载
    console.warn('[stats] 查询失败:', e?.message)
    return json({ activeUsers7: 0, signups7: 0, events7: [] })
  }
}

export async function onRequest() {
  return errorJson('不支持的请求方法', 405, 'METHOD')
}
