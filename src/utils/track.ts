import { API_BASE, getToken } from '@/lib/serverApi'

/**
 * 轻量埋点：fire-and-forget。失败完全静默——绝不阻塞 UI、绝不抛错。
 * 服务端有事件白名单，未注册的事件名会被忽略。
 */
export function track(name: string, props?: Record<string, unknown>): void {
  const token = getToken()
  if (!token) return
  try {
    void fetch(`${API_BASE}/api/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, props }),
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    /* 忽略 */
  }
}
