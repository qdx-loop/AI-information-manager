import { describe, it, expect, afterEach } from 'vitest'
import { getReminderAt, withReminder, REMINDER_FIELD_KEY } from './reminder'
import { nextOccurrence, todayLocalISO, isoToLocalTs } from './reminder'
import { gatherInsights, itemDisplayName, invalidateInsightsCache, parseDateValueForTest as parseDateValueForTest } from './insights'
import dayjs from 'dayjs'
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
  it('写入并可读出提醒（存日历日字符串，不是时间戳）', () => {
    const f = withReminder(base.fields, '2026-10-05')
    expect(f[REMINDER_FIELD_KEY]).toBe('2026-10-05')
    expect(getReminderAt({ ...base, fields: f })).toBe('2026-10-05')
  })

  /**
   * 旧数据迁移：升级前提醒存的是「本地零点时间戳」。
   * 必须转成当天的日历日，否则换一台时区不同的设备打开会显示成前一天。
   */
  it('兼容旧的时间戳格式，读出时转成当天的日历日', () => {
    const ts = new Date(2026, 9, 5, 0, 0, 0).getTime() // 本地 10-05 零点
    const legacy: Item = { ...base, fields: { [REMINDER_FIELD_KEY]: ts } }
    expect(getReminderAt(legacy)).toBe('2026-10-05')
  })

  it('非法/越界的日期字符串返回 null，而不是产生一个假日期', () => {
    for (const bad of ['2026-13-01', '2026-02-30', 'not-a-date', '2026-1-1x', '']) {
      expect(getReminderAt({ ...base, fields: { [REMINDER_FIELD_KEY]: bad } })).toBeNull()
    }
  })
  it('清除提醒会移除保留键', () => {
    const f = withReminder({ [REMINDER_FIELD_KEY]: 999 }, null)
    expect(REMINDER_FIELD_KEY in f).toBe(false)
  })
  it('不修改原 fields 对象', () => {
    const orig: Record<string, FieldValue> = { a: 1 }
    withReminder(orig, '2026-10-05')
    expect(REMINDER_FIELD_KEY in orig).toBe(false)
  })
})

describe('重复提醒 nextOccurrence（日历日运算，与时区无关）', () => {
  const today = '2026-10-05'

  it('none 原样返回（即使已过期也仍要提醒）', () => {
    expect(nextOccurrence('2026-10-01', 'none', today)).toBe('2026-10-01')
  })

  it('未到的首次提醒直接返回原始日期', () => {
    expect(nextOccurrence('2026-10-08', 'weekly', today)).toBe('2026-10-08')
  })

  it('每日：推进到不早于起算日的最近一次', () => {
    expect(nextOccurrence('2026-09-26', 'daily', today)).toBe('2026-10-05')
    expect(nextOccurrence('2026-10-04', 'daily', today)).toBe('2026-10-05')
    expect(nextOccurrence('2026-10-06', 'daily', today)).toBe('2026-10-06')
  })

  it('每周：推进 7 天，且结果必须不早于起算日', () => {
    // 9/04 起每 7 天：9/04, 11, 18, 25, 10/02, 10/09 …
    // 起算日是 10/05，所以 10/02 已过期，返回 10/09
    expect(nextOccurrence('2026-09-04', 'weekly', today)).toBe('2026-10-09')
    expect(nextOccurrence('2026-10-02', 'weekly', '2026-10-02')).toBe('2026-10-02')
    expect(nextOccurrence('2026-10-03', 'weekly', today)).toBe('2026-10-10')
  })

  it('每月：同一天号，且不早于起算日', () => {
    expect(nextOccurrence('2026-09-15', 'monthly', today)).toBe('2026-10-15')
    // 8/15 起每月：9/15 已早于 10/05，所以是 10/15
    expect(nextOccurrence('2026-08-15', 'monthly', today)).toBe('2026-10-15')
    expect(nextOccurrence('2026-09-15', 'monthly', '2026-09-15')).toBe('2026-09-15')
  })

  it('每月：目标月没有该日时夹到当月最后一天，而不是溢出到下个月', () => {
    // 1/31 起算，2 月没有 31 日
    expect(nextOccurrence('2026-01-31', 'monthly', '2026-02-01')).toBe('2026-02-28')
    // 闰年 2 月夹到 29
    expect(nextOccurrence('2028-01-31', 'monthly', '2028-02-01')).toBe('2028-02-29')
  })

  it('每月 31 日不会永久漂移到 3 号', () => {
    let cursor = '2026-02-15'
    for (let i = 0; i < 8; i++) {
      const next = nextOccurrence('2026-01-31', 'monthly', cursor)
      expect(next).not.toBe('2026-03-03')
      expect([ '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31' ].includes(next)).toBe(true)
      cursor = next
    }
  })

  it('跨闰年/跨年都正确', () => {
    // 2027-12-31 起每月：2028-01-31 → 2028-02 夹到 29（2028 是闰年）
    expect(nextOccurrence('2027-12-31', 'monthly', '2028-01-01')).toBe('2028-01-31')
    expect(nextOccurrence('2027-12-31', 'monthly', '2028-02-01')).toBe('2028-02-29')
    // 年末跨到下一年
    expect(nextOccurrence('2026-12-31', 'monthly', '2027-01-05')).toBe('2027-01-31')
  })

  it('起算日恰好等于某次触发时返回它自己（与旧语义一致）', () => {
    expect(nextOccurrence('2026-10-02', 'weekly', '2026-10-02')).toBe('2026-10-02')
  })

  it('纯字符串运算，不受运行环境时区影响', () => {
    // 关键性质：结果里不含任何本地时间成分。
    // 同样的输入在任何 TZ 下必须得到同样的输出。
    const a = nextOccurrence('2026-01-31', 'monthly', '2026-02-01')
    const b = nextOccurrence('2026-01-31', 'monthly', '2026-02-01')
    expect(a).toBe(b)
    expect(a).toBe('2026-02-28')
  })

  it('withReminder 写入并读出重复规则', () => {
    const f = withReminder({}, '2026-10-05', 'weekly')
    const item: Item = { id: 'x', libraryId: 'l', accountId: 'a', fields: f, pinned: false, sortOrder: 0, createdAt: 0, updatedAt: 0, deletedAt: null }
    expect(getReminderAt(item)).toBe('2026-10-05')
    expect(item.fields.__reminderRepeat).toBe('weekly')
  })
  it('清除提醒时一并清除重复规则', () => {
    const f = withReminder({ __reminderRepeat: 'daily' }, null)
    expect('__reminderRepeat' in f).toBe(false)
    expect(REMINDER_FIELD_KEY in f).toBe(false)
  })
})

describe('日期字段按本地午夜解析（与表格展示一致）', () => {
  it('日期字段与提醒在同一个列表里显示成同一个日子', async () => {
    // 同一个日历日：字段存 'YYYY6-10-05'，提醒存 '2026-10-05'，
    // 两者落到时间戳后 dayjs 必须渲染出同一天。
    // 原来 parseDateValue 走 Date.parse（UTC 午夜），在 UTC-5 上会差一天。
    const p = parseDateValueForTest('2026-10-05')
    const q = isoToLocalTs('2026-10-05')
    expect(dayjs(p).format('YYYY-MM-DD')).toBe(dayjs(q).format('YYYY-MM-DD'))
    expect(dayjs(p).format('YYYY-MM-DD')).toBe('2026-10-05')
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
      { id: 'i2', libraryId: 'l1', accountId: 'a1', fields: { name: '李四', [REMINDER_FIELD_KEY]: todayLocalISO(now + DAY) }, pinned: false, sortOrder: 1, createdAt: now - 30 * DAY, updatedAt: now, deletedAt: null },
    ]
    setProvider({ getTemplate: async () => fields, listItems: async () => items } as unknown as DataProvider)

    const data = await gatherInsights([lib])
    expect(data.totalLibs).toBe(1)
    expect(data.totalItems).toBe(2)
    expect(data.itemsThisWeek).toBe(1)
    expect(data.dateAlerts).toHaveLength(1)
    expect(data.dateAlerts[0].fieldLabel).toBe('到期日')
    expect(data.reminders).toHaveLength(1)
    // 提醒现在是「日历日」，落到时间戳时是该日本地零点，
    // 不再是「现在的时刻 + 1 天」那个任意瞬间。
    expect(data.reminders[0].at).toBe(isoToLocalTs(todayLocalISO(now + DAY)))
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
