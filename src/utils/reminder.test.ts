// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { nextOccurrence } from '@/utils/reminder'

/**
 * 「每月 N 日」不能因为 setMonth 的日期溢出而永久漂移。
 *
 * 原来的写法是 `while (d < now) d.setMonth(d.getMonth() + 1)`。
 * setMonth 会把越界的日溢出到下个月：1/31 +1 个月 → 3/3（2 月没有 31 日），
 * 之后再每次 +1 月都停在 3 号 —— 用户设的「每月 31 日」从 3 月起变成
 * 「每月 3 日」，而且不会有任何人发现。
 *
 * 修正后的语义：目标月没有该日时就取那个月的最后一天。
 * 每月 31 日 → 2 月落在 28 日（或 29 日），3 月回到 31 日。
 * 这样既有通知（不会整个二月静默跳过），锚点日也不会丢失。
 */
describe('nextOccurrence monthly', () => {
  it('目标月没有 31 日时夹到当月最后一天（2/15 之后的下一次是 2/28）', () => {
    const base = new Date(2026, 0, 31, 9, 0, 0).getTime() // 2026-01-31
    const now = new Date(2026, 1, 15, 9, 0, 0).getTime() // 2026-02-15
    const next = new Date(nextOccurrence(base, 'monthly', now))
    expect(next.getFullYear()).toBe(2026)
    expect(next.getMonth()).toBe(1) // 2 月
    expect(next.getDate()).toBe(28) // 2026 不是闰年 → 夹到 28，而不是溢出成 3/3
  })

  it('闰年 2 月夹到 29 日', () => {
    const base = new Date(2028, 0, 31, 9, 0, 0).getTime() // 2028-01-31
    const now = new Date(2028, 1, 10, 9, 0, 0).getTime() // 2028-02-10（闰年）
    const next = new Date(nextOccurrence(base, 'monthly', now))
    expect(next.getMonth()).toBe(1)
    expect(next.getDate()).toBe(29)
  })

  it('从夹紧的 2/28 递进后回到 31 日，不永久漂移', () => {
    const base = new Date(2026, 0, 31, 9, 0, 0).getTime()
    const feb = new Date(nextOccurrence(base, 'monthly', new Date(2026, 1, 15).getTime()))
    expect(feb.getDate()).toBe(28)
    // 下一次：锚点日恢复成 31，而不是停在 3 号。
    // now 取 feb + 1ms：语义是「不早于 now 的第一次触发」，
    // 传 feb 本身会返回 feb（与 daily/weekly 的 `while (next < now)` 一致）。
    const mar = new Date(nextOccurrence(base, 'monthly', feb.getTime() + 1))
    expect(mar.getMonth()).toBe(2) // 3 月
    expect(mar.getDate()).toBe(31)
  })

  it('连续递推 8 个月，日号在 28 与 31 之间夹紧且不漂移到 3 号', () => {
    const base = new Date(2026, 0, 31, 9, 0, 0).getTime()
    let cursor = new Date(2026, 1, 15).getTime()
    for (let i = 0; i < 8; i++) {
      const next = new Date(nextOccurrence(base, 'monthly', cursor))
      expect(next.getDate()).not.toBe(3) // 旧实现在这里会给出 3
      expect([28, 29, 30, 31]).toContain(next.getDate())
      cursor = next.getTime() + 1
    }
  })

  it('30 日在 2 月夹到 28，之后回到 30', () => {
    const base = new Date(2026, 0, 30, 9, 0, 0).getTime()
    const feb = new Date(nextOccurrence(base, 'monthly', new Date(2026, 0, 31).getTime()))
    expect(feb.getMonth()).toBe(1)
    expect(feb.getDate()).toBe(28)
    const mar = new Date(nextOccurrence(base, 'monthly', feb.getTime() + 1))
    expect(mar.getMonth()).toBe(2)
    expect(mar.getDate()).toBe(30)
  })

  it('锚点日不超过目标月天数时日号不变', () => {
    const base = new Date(2026, 0, 15, 9, 0, 0).getTime()
    const next = new Date(nextOccurrence(base, 'monthly', new Date(2026, 0, 20).getTime()))
    expect(next.getMonth()).toBe(1)
    expect(next.getDate()).toBe(15)
  })

  it('还没到本月触发日时返回本月', () => {
    const base = new Date(2026, 0, 15, 9, 0, 0).getTime()
    const next = new Date(nextOccurrence(base, 'monthly', new Date(2026, 0, 3).getTime()))
    expect(next.getMonth()).toBe(0)
    expect(next.getDate()).toBe(15)
  })

  it('daily / weekly 不受影响', () => {
    const base = new Date(2026, 0, 31, 9, 0, 0).getTime()
    const now = new Date(2026, 1, 15).getTime()
    // 1/31 09:00 起每天，now 是 2/15 00:00 → 下一次是 2/15 09:00（同日）
    const daily = new Date(nextOccurrence(base, 'daily', now))
    expect(daily.getMonth()).toBe(1)
    expect(daily.getDate()).toBe(15)
    const weekly = new Date(nextOccurrence(base, 'weekly', now))
    expect(weekly.getMonth()).toBe(1)
    expect(weekly.getDate()).toBe(21) // 1/31 + 3 周
  })
})
