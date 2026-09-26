// /api/sync/signal — 局域网同步的服务端信令中转。
//
// 职责边界（第一性原则）：
//   服务器只中转 WebRTC offer/answer（几 KB 的 SDP），帮助两台同账号设备自动配对。
//   全部业务数据（库数据 + AI/云端配置）仍经 WebRTC 数据通道在局域网内直连传输，不经过服务器。
//
// 协议（信令表含 id 主键，guest 按 rowId 精确回写 answer）：
//   POST { role:'host', deviceId, offer }              → 创建配对请求（返回 rowId）
//   POST { role:'guest', deviceId, rowId, answer }     → 加入：写入 answer，标记 done
//   GET  ?deviceId=...                                 → 轮询：host 等 answer / guest 等 offer
//   DELETE { deviceId }                                 → 本设备的等待中请求作废（关弹窗时调用）
import { json, errorJson, requireUser } from '../../lib/_auth'

const TTL_MS = 10 * 60_000 // 信令 10 分钟自动过期

function newId() {
  return crypto.randomUUID()
}

export async function onRequest({ request, env }) {
  const { account: acc, error } = await requireUser(request, env)
  if (error) return error
  const url = new URL(request.url)

  try {
    if (request.method === 'GET') {
      const deviceId = url.searchParams.get('deviceId') || ''
      if (!deviceId) return errorJson('缺少 deviceId', 400)

      // 清理同账号下过期信令（含已完成的，避免残留）
      await env.DB.prepare('DELETE FROM p2p_signals WHERE created_at < ? AND account_id = ?')
        .bind(Date.now() - TTL_MS, acc.id)
        .run()

      // host：查自己设备发出的、最新的、未过期的请求
      const hostRow = await env.DB.prepare(
        `SELECT id, role, offer, answer, status, created_at FROM p2p_signals
         WHERE account_id = ? AND device_id = ? AND role = 'host' AND status IN ('waiting', 'done')
         ORDER BY created_at DESC LIMIT 1`,
      )
        .bind(acc.id, deviceId)
        .first()

      if (hostRow) {
        // host 等 answer：answer 写入且 status=done 才算拿到
        if (hostRow.status === 'done' && hostRow.answer) {
          return json({ pending: true, signal: hostRow })
        }
        // 自己的请求还在等待对端加入
        return json({ pending: true })
      }

      // guest：找同账号其他设备发出的等待中请求
      const guestRow = await env.DB.prepare(
        `SELECT id, role, offer, answer, status, created_at FROM p2p_signals
         WHERE account_id = ? AND created_at >= ? AND role = 'host' AND status = 'waiting' AND device_id != ?
         ORDER BY created_at DESC LIMIT 1`,
      )
        .bind(acc.id, Date.now() - TTL_MS, deviceId)
        .first()

      if (guestRow) {
        return json({ pending: true, signal: guestRow })
      }
      return json({ pending: false })
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const { role, deviceId, offer, answer, rowId } = body || {}
      if (!deviceId) return errorJson('缺少 deviceId', 400)

      if (role === 'host') {
        if (!offer) return errorJson('缺少 offer', 400)
        // 一个设备同时只保留一条等待中的 host 请求：先作废旧请求（按设备隔离，不影响其他设备）
        await env.DB.prepare(
          `UPDATE p2p_signals SET status = 'cancelled' WHERE account_id = ? AND device_id = ? AND role = 'host' AND status = 'waiting'`,
        )
          .bind(acc.id, deviceId)
          .run()
        const id = newId()
        await env.DB.prepare(
          `INSERT INTO p2p_signals (id, account_id, device_id, role, offer, status, created_at) VALUES (?, ?, ?, 'host', ?, 'waiting', ?)`,
        )
          .bind(id, acc.id, deviceId, offer, Date.now())
          .run()
        return json({ ok: true, rowId: id })
      }

      if (role === 'guest') {
        if (!rowId || !answer) return errorJson('缺少 rowId 或 answer', 400)
        // 校验目标行属于同账号、是 host 发出的、且处于等待中
        const row = await env.DB.prepare(
          `SELECT id, device_id, role, status FROM p2p_signals WHERE id = ? AND account_id = ?`,
        )
          .bind(rowId, acc.id)
          .first()
        if (!row || row.role !== 'host' || row.status !== 'waiting') {
          return errorJson('该配对请求已失效，请让对端重新发起', 409, 'STALE')
        }
        await env.DB.prepare(`UPDATE p2p_signals SET answer = ?, status = 'done' WHERE id = ?`)
          .bind(answer, rowId)
          .run()
        return json({ ok: true })
      }

      return errorJson('未知 role', 400)
    }

    if (request.method === 'DELETE') {
      const body = await request.json().catch(() => ({}))
      const { deviceId } = body || {}
      if (!deviceId) return errorJson('缺少 deviceId', 400)
      await env.DB.prepare(`DELETE FROM p2p_signals WHERE account_id = ? AND device_id = ?`)
        .bind(acc.id, deviceId)
        .run()
      return json({ ok: true })
    }

    return errorJson('不支持的请求方法', 405, 'METHOD')
  } catch (e) {
    // 未执行信令表迁移的旧部署：明确提示而不是 500 白屏
    const msg = String(e && e.message ? e.message : e)
    if (msg.includes('p2p_signals') || msg.includes('no such table')) {
      return errorJson('服务端尚未启用局域网同步信令，请联系管理员执行数据库迁移', 503, 'NO_SIGNAL_TABLE')
    }
    return errorJson('信令服务异常：' + msg, 500)
  }
}
