// 订阅状态工具：到期分级提醒 + 只读宽限期（与服务端 GRACE_MS 保持一致）

export const GRACE_DAYS = 7
export const GRACE_MS = GRACE_DAYS * 86400000

export type SubStatus = 'active' | 'grace' | 'expired'

/** 依据到期时间戳计算订阅状态：未到期=active；到期后宽限期内=grace（只读）；超过宽限=expired */
export function getSubStatus(expiresAt: number | undefined | null, now = Date.now()): SubStatus {
  if (expiresAt == null) return 'active'
  if (now <= expiresAt) return 'active'
  if (now <= expiresAt + GRACE_MS) return 'grace'
  return 'expired'
}

/** 距离某时间戳的整天数（向上取整；已过期返回负数或 0） */
export function daysUntil(date: number, now = Date.now()): number {
  return Math.ceil((date - now) / 86400000)
}

/** 宽限期剩余整天数（仅在 grace 状态有意义） */
export function graceDaysLeft(expiresAt: number, now = Date.now()): number {
  return Math.max(0, daysUntil(expiresAt + GRACE_MS, now))
}
