// GET /api/admin/stats — 运营概览：账户总量、停用数、近 7/30 天注册与活跃、关键行为、管理操作
// 2026-09：去掉续费/体验卡漏斗（已无卡种），改为关注注册规模与活跃留存。
import { json, errorJson, requireAdmin } from '../../lib/_auth'

const DAY = 86400000

export async function onRequestGet({ request, env }) {
  const { error } = await requireAdmin(request, env)
  if (error) return error

  const now = Date.now()
  const since7 = now - 7 * DAY
  const since30 = now - 30 * DAY
  try {
    const [total, disabled, signups7, signups30, active, events, ops] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) AS n FROM accounts').first(),
      env.DB.prepare('SELECT COUNT(*) AS n FROM accounts WHERE disabled = 1').first(),
      env.DB.prepare('SELECT COUNT(*) AS n FROM accounts WHERE created_at > ?').bind(since7).first(),
      env.DB.prepare('SELECT COUNT(*) AS n FROM accounts WHERE created_at > ?').bind(since30).first(),
      env.DB.prepare(
        'SELECT COUNT(DISTINCT account_id) AS n FROM analytics_events WHERE created_at > ?',
      )
        .bind(since7)
        .first(),
      env.DB.prepare(
        'SELECT name, COUNT(*) AS c FROM analytics_events WHERE created_at > ? GROUP BY name ORDER BY c DESC',
      )
        .bind(since7)
        .all(),
      env.DB.prepare(
        'SELECT action, COUNT(*) AS c FROM admin_audit WHERE created_at > ? GROUP BY action ORDER BY c DESC',
      )
        .bind(since30)
        .all(),
    ])
    return json({
      totalAccounts: Number(total?.n ?? 0),
      disabledAccounts: Number(disabled?.n ?? 0),
      signups7: Number(signups7?.n ?? 0),
      signups30: Number(signups30?.n ?? 0),
      activeUsers7: Number(active?.n ?? 0),
      events7: (events.results ?? []).map((r) => ({ name: String(r.name), count: Number(r.c) })),
      ops30: (ops.results ?? []).map((r) => ({ action: String(r.action), count: Number(r.c) })),
    })
  } catch (e) {
    // 未执行迁移时静默降级为空数据，不阻塞后台加载
    console.warn('[stats] 查询失败:', e?.message)
    return json({
      totalAccounts: 0,
      disabledAccounts: 0,
      signups7: 0,
      signups30: 0,
      activeUsers7: 0,
      events7: [],
      ops30: [],
    })
  }
}

export async function onRequest() {
  return errorJson('不支持的请求方法', 405, 'METHOD')
}
