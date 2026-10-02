// 条目提醒：把提醒日期与重复规则存进条目 fields 的保留键。
// 之所以放 fields 而非独立列：Local(Dexie) 与 Supabase 两种存储都无需改表结构即可持久化，
// 且模板里不存在该键的 FieldDef，故不会在表格/编辑器/导出中显示。
//
// 关键约定：提醒日期以 **'YYYY-MM-DD' 字符串**存储，不是时间戳。
//
// 以前存的是「某个本地零点的时间戳」。但提醒的语义是「某个日历日」，
// 不是「某个瞬间」，于是跨时区必然错位：
//   A 设备（UTC+8）选 10-05 → 存 2026-10-04T16:00Z
//   B 设备（UTC-5）读出来是 10-04 19:00 本地 → 日期少一天
// 于是 DatePicker 显示前一天、去重键算成前一天（提前一天弹通知），
// 而第二天又算「新的一天」再弹一次。
//
// 存日历日本身后，这些问题全部消失：'2026-10-05' 在任何时区都是 10 月 5 日，
// 而且 ISO 日期字符串可以直接按字典序比较，不需要经过 Date 运算。
import type { Item, FieldValue } from '@/types'

export const REMINDER_FIELD_KEY = '__reminder'
export const REMINDER_REPEAT_KEY = '__reminderRepeat'

export type ReminderRepeat = 'none' | 'daily' | 'weekly' | 'monthly'

/** 提醒日期：'YYYY-MM-DD' */
export type ReminderDate = string

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** 把任意输入规整成 'YYYY-MM-DD'；无法识别返回 null */
export function toISODate(v: unknown): ReminderDate | null {
  if (typeof v !== 'string') return null
  const m = ISO_RE.exec(v.trim())
  if (!m) return null
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  // 校验是真实存在的日期（挡掉 2026-02-30）
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

/** 今天的本地日历日 */
export function todayLocalISO(now: number = Date.now()): ReminderDate {
  const d = new Date(now)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 'YYYY-MM-DD' → 该日本地零点的时间戳（仅用于 DatePicker 等需要 Date 的地方） */
export function isoToLocalTs(iso: ReminderDate): number {
  const m = ISO_RE.exec(iso)
  if (!m) return NaN
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()
}

/**
 * 读出提醒日期。
 *
 * 兼容旧数据：升级前的提醒存的是「本地零点时间戳」（数字）。
 * 这里把它转成当天的 'YYYY-MM-DD'，用户看到的是他当初填的那个日子，
 * 下次保存时就自动变成新格式。不做这个转换的话旧提醒会在
 * 非原时区的设备上显示成前一天。
 */
export function getReminderAt(item: Item): ReminderDate | null {
  const v = item.fields[REMINDER_FIELD_KEY]
  if (typeof v === 'string') return toISODate(v)
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return null
    return todayLocalISO(v)
  }
  return null
}

export function getReminderRepeat(item: Item): ReminderRepeat {
  const v = item.fields[REMINDER_REPEAT_KEY]
  return v === 'daily' || v === 'weekly' || v === 'monthly' ? v : 'none'
}

/** 返回写入了提醒日期与重复规则的新 fields，不修改原对象 */
export function withReminder(
  fields: Record<string, FieldValue>,
  at: ReminderDate | null,
  repeat: ReminderRepeat = 'none',
): Record<string, FieldValue> {
  const out = { ...fields }
  if (at) {
    out[REMINDER_FIELD_KEY] = at
    out[REMINDER_REPEAT_KEY] = repeat
  } else {
    delete out[REMINDER_FIELD_KEY]
    delete out[REMINDER_REPEAT_KEY]
  }
  return out
}

function daysInMonth(y: number, mo1: number): number {
  return new Date(y, mo1, 0).getDate() // mo1 为 1-based，new Date(y, mo1, 0) = 该月最后一天
}

function parts(iso: ReminderDate): { y: number; mo: number; d: number } {
  const m = ISO_RE.exec(iso)!
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) }
}

function fmt(y: number, mo: number, d: number): ReminderDate {
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * 从 base 起算、不早于 fromISO 的下一次触发日（'YYYY-MM-DD'）。
 *
 * 全部在日历日层面运算，不经过时间戳，所以与时区无关。
 * ISO 日期可直接按字典序比较。
 *
 * 语义是「不早于 from 的第一次触发」：from 恰好等于某次触发时，返回它自己。
 * 与旧的 `while (next < now)` 行为保持一致。
 */
export function nextOccurrence(
  base: ReminderDate,
  repeat: ReminderRepeat,
  fromISO: ReminderDate,
): ReminderDate {
  const norm = toISODate(base)
  if (!norm) return base   // 非法输入：原样返回，交由调用方决定如何展示
  if (repeat === 'none') return norm

  const b = parts(norm)

  if (repeat === 'daily') {
    const cur = new Date(b.y, b.mo - 1, b.d)
    // 上限防御：最多往后找 20 年
    for (let i = 0; i < 365 * 20; i++) {
      const iso = fmt(cur.getFullYear(), cur.getMonth() + 1, cur.getDate())
      if (iso >= fromISO) return iso
      cur.setDate(cur.getDate() + 1)
    }
    return norm
  }

  if (repeat === 'weekly') {
    const cur = new Date(b.y, b.mo - 1, b.d)
    for (let i = 0; i < 520 * 20; i++) {
      const iso = fmt(cur.getFullYear(), cur.getMonth() + 1, cur.getDate())
      if (iso >= fromISO) return iso
      cur.setDate(cur.getDate() + 7)
    }
    return norm
  }

  // monthly：按日历月递进，并把日期夹到目标月最后一天。
  // 不能简单地把「月 +1」：那样 1/31 会溢出成 3/3（2 月没有 31 日），
  // 之后再每次 +1 月都停在 3 号 —— 用户设的「每月 31 日」永久漂移。
  let y = b.y
  let mo = b.mo
  let d = b.d
  for (let i = 0; i < 12 * 20; i++) {
    const clamped = Math.min(d, daysInMonth(y, mo))
    const iso = fmt(y, mo, clamped)
    if (iso >= fromISO) return iso
    mo++
    if (mo > 12) { mo = 1; y++ }
  }
  return norm
}
