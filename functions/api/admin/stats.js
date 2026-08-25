// GET /api/admin/stats — 近 7 天运营概览（活跃买家/新增注册/关键行为次数）
import { json, errorJson, requireAdmin } from '../../lib/_auth'

export async function onRequestGet({ request, env }) {
  const { error } = await requireAdmin(request, env)
  if (error) return error

  const since = Date.now() - 7 * 86400000
  try {
    const [active, signups, events] = await Promise.all([
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
    ])
    return json({
      activeUsers7: Number(active?.n ?? 0),
      signups7: Number(signups?.n ?? 0),
      events7: (events.results ?? []).map((r) => ({ name: String(r.name), count: Number(r.c) })),
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
