import { describe, it, expect, afterEach } from 'vitest'
import { getReminderAt, withReminder, REMINDER_FIELD_KEY } from './reminder'
import { nextOccurrence } from './reminder'
import { gatherInsights, itemDisplayName, invalidateInsightsCache } from './insights'
import { setProvider, resetProvider } from '@/db/providerFactory'
import type { DataProvider } from '@/types/dataProvider'
import type { Item, Library, FieldDef, FieldValue } from '@/types'

const DAY = 86400000

describe('reminder 保留键', () => {
  const base: Item = {
    id: 'i1', libraryId: 'l1', accountId: 'a1', fields: {}, pinned: false,
    sortOrder: 0, createdAt: 0, updatedAt: 0, deletedAt: null,
  }
  it('无提醒返回 null', () => {
    expect(getReminderAt(base)).toBeNull()
  })
  it('写入并可读出提醒', () => {
    const f = withReminder(base.fields, 12345)
    expect(f[REMINDER_FIELD_KEY]).toBe(12345)
    expect(getReminderAt({ ...base, fields: f })).toBe(12345)
  })
  it('清除提醒会移除保留键', () => {
    const f = withReminder({ [REMINDER_FIELD_KEY]: 999 }, null)
    expect(REMINDER_FIELD_KEY in f).toBe(false)
  })
  it('不修改原 fields 对象', () => {
    const orig: Record<string, FieldValue> = { a: 1 }
    withReminder(orig, 5)
    expect(REMINDER_FIELD_KEY in orig).toBe(false)
  })
})

describe('重复提醒 nextOccurrence', () => {
  const now = Date.now()
  const at9 = (dateStr: string) => new Date(`${dateStr}T09:00:00`).getTime()
  const days = (a: number, b: number) => Math.round((a - b) / DAY)

  it('none 原样返回', () => {
    expect(nextOccurrence(now - DAY, 'none', now)).toBe(now - DAY)
  })
  it('未到的首次提醒直接返回原始时间', () => {
    const at = now + 3 * DAY
    expect(nextOccurrence(at, 'weekly', now)).toBe(at)
  })
  it('每日重复：推进到不早于现在的最近一次（保持 9 点基准）', () => {
    const at = now - 9 * DAY
    const occ = nextOccurrence(at, 'daily', now)
    expect(days(occ, at) % 1).toBe(0)
    expect(occ).toBeLessThanOrEqual(now + DAY)
    expect(occ).toBeGreaterThan(now - DAY)
    expect(new Date(occ).getHours()).toBe(9)
  })
  it('每周重复：推进量为 7 的整数倍', () => {
    const at = now - 20 * DAY
    const occ = nextOccurrence(at, 'weekly', now)
    expect(Math.round((occ - at) / (7 * DAY))).toBeGreaterThanOrEqual(1)
    expect(occ).toBeGreaterThan(now - 7 * DAY)
    expect(occ).toBeLessThanOrEqual(now + 7 * DAY)
    expect(new Date(occ).getHours()).toBe(9)
  })
  it('每月重复：月份递进（日保留）', () => {
    const at = at9('2026-05-10')
    const occ = nextOccurrence(at, 'monthly', now)
    const d = new Date(occ)
    expect(d.getDate()).toBe(10)
    expect(d.getHours()).toBe(9)
    expect(d.getTime()).toBeGreaterThan(now - 32 * DAY)
  })
  it('withReminder 写入并读出重复规则', () => {
    const f = withReminder({}, 123, 'weekly')
    const item: Item = { id: 'x', libraryId: 'l', accountId: 'a', fields: f, pinned: false, sortOrder: 0, createdAt: 0, updatedAt: 0, deletedAt: null }
    expect(getReminderAt(item)).toBe(123)
    expect(item.fields.__reminderRepeat).toBe('weekly')
  })
  it('清除提醒时一并清除重复规则', () => {
    const f = withReminder({ __reminderRepeat: 'daily' }, null)
    expect('__reminderRepeat' in f).toBe(false)
    expect(REMINDER_FIELD_KEY in f).toBe(false)
  })
})

describe('insights 规则引擎', () => {
  afterEach(() => {
    resetProvider()
    invalidateInsightsCache() // gatherInsights 有结果缓存，测试间必须失效
  })

  it('汇总统计、提醒与日期到期事项', async () => {
    const now = Date.now()
    const lib: Library = { id: 'l1', accountId: 'a1', name: '客户', category: '默认', sortOrder: 0, deletedAt: null, parentId: null }
    const fields: FieldDef[] = [
      { id: 'f1', libraryId: 'l1', key: 'name', label: '姓名', type: 'text', options: [], required: false, visible: true, sortOrder: 0 },
      { id: 'f2', libraryId: 'l1', key: 'due', label: '到期日', type: 'date', options: [], required: false, visible: true, sortOrder: 1 },
    ]
    const items: Item[] = [
      { id: 'i1', libraryId: 'l1', accountId: 'a1', fields: { name: '张三', due: now + 2 * DAY }, pinned: false, sortOrder: 0, createdAt: now - DAY, updatedAt: now, deletedAt: null },
      { id: 'i2', libraryId: 'l1', accountId: 'a1', fields: { name: '李四', [REMINDER_FIELD_KEY]: now + DAY }, pinned: false, sortOrder: 1, createdAt: now - 30 * DAY, updatedAt: now, deletedAt: null },
    ]
    setProvider({ getTemplate: async () => fields, listItems: async () => items } as unknown as DataProvider)

    const data = await gatherInsights([lib])
    expect(data.totalLibs).toBe(1)
    expect(data.totalItems).toBe(2)
    expect(data.itemsThisWeek).toBe(1)
    expect(data.dateAlerts).toHaveLength(1)
    expect(data.dateAlerts[0].fieldLabel).toBe('到期日')
    expect(data.reminders).toHaveLength(1)
    expect(data.reminders[0].at).toBe(now + DAY)
    expect(itemDisplayName(items[0])).toBe('张三')
  })

  it('超出 7 天窗口的日期不进入提醒', async () => {
    const now = Date.now()
    const lib: Library = { id: 'l1', accountId: 'a1', name: 'L', category: '默认', sortOrder: 0, deletedAt: null, parentId: null }
    const fields: FieldDef[] = [
      { id: 'f1', libraryId: 'l1', key: 'due', label: '到期日', type: 'date', options: [], required: false, visible: true, sortOrder: 0 },
    ]
    const items: Item[] = [
      { id: 'i1', libraryId: 'l1', accountId: 'a1', fields: { due: now + 30 * DAY }, pinned: false, sortOrder: 0, createdAt: now, updatedAt: now, deletedAt: null },
    ]
    setProvider({ getTemplate: async () => fields, listItems: async () => items } as unknown as DataProvider)
    const data = await gatherInsights([lib])
    expect(data.dateAlerts).toHaveLength(0)
    expect(data.reminders).toHaveLength(0)
  })
})
