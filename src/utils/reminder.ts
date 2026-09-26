import type { Item, FieldValue } from '@/types'

// 条目提醒：把提醒时间戳与重复规则存进条目 fields 的保留键。
// 之所以放 fields 而非独立列：Local(Dexie) 与 Supabase 两种存储都无需改表结构即可持久化，
// 且模板里不存在该键的 FieldDef，故不会在表格/编辑器/导出中显示。
export const REMINDER_FIELD_KEY = '__reminder'
export const REMINDER_REPEAT_KEY = '__reminderRepeat'

export type ReminderRepeat = 'none' | 'daily' | 'weekly' | 'monthly'

export function getReminderAt(item: Item): number | null {
  const v = item.fields[REMINDER_FIELD_KEY]
  return typeof v === 'number' && v > 0 ? v : null
}

export function getReminderRepeat(item: Item): ReminderRepeat {
  const v = item.fields[REMINDER_REPEAT_KEY]
  return v === 'daily' || v === 'weekly' || v === 'monthly' ? v : 'none'
}

/** 返回写入了提醒时间与重复规则的新 fields，不修改原对象 */
export function withReminder(
  fields: Record<string, FieldValue>,
  at: number | null,
  repeat: ReminderRepeat = 'none',
): Record<string, FieldValue> {
  const next: Record<string, FieldValue> = { ...fields }
  if (at == null) {
    delete next[REMINDER_FIELD_KEY]
    delete next[REMINDER_REPEAT_KEY]
  } else {
    next[REMINDER_FIELD_KEY] = at
    if (repeat === 'none') delete next[REMINDER_REPEAT_KEY]
    else next[REMINDER_REPEAT_KEY] = repeat
  }
  return next
}

const DAY = 86400000

/**
 * 计算重复提醒的「下一次触发时间」：
 *   - none：原样返回
 *   - daily/weekly/monthly：从原始提醒日出发，按周期递进到不早于今天的最近一次；
 *     若原始提醒日尚未到，直接返回原始时间（首次触发）。
 * 纯函数，供 insights 引擎与通知检查复用。
 */
export function nextOccurrence(at: number, repeat: ReminderRepeat, now = Date.now()): number {
  if (repeat === 'none') return at
  if (at > now) return at
  const start = new Date(at)
  start.setHours(9, 0, 0, 0) // 当天 9 点视为提醒基准时刻
  const base = start.getTime()
  if (repeat === 'daily') {
    let next = base
    while (next < now) next += DAY
    return next
  }
  if (repeat === 'weekly') {
    let next = base
    while (next < now) next += 7 * DAY
    return next
  }
  // monthly：按日历月递进（31 日等边界由 Date 归一化处理）
  const d = new Date(base)
  while (d.getTime() < now) d.setMonth(d.getMonth() + 1)
  return d.getTime()
}
