// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'

// coerceValue 原本没有导出，也没有测试。导入是数据进入应用的唯一入口，
// 这里的静默损坏不可逆（写进 IndexedDB、再经云同步扩散），必须锁住。
import { coerceValueForTest as coerceValue } from './ImportExport'

describe('导入：日期列', () => {
  it('Date 对象按本地日期取值，不被 UTC 偏移成前一天', () => {
    // 东八区 2026-10-05 00:00 本地 = 2026-10-04T16:00Z。
    // 原来用 toISOString().slice(0,10) → '2026-10-04'，比用户填的早一天。
    const d = new Date(2026, 9, 5, 0, 0, 0)
    expect(coerceValue('date', d)).toBe('2026-10-05')
  })

  it('Excel 序列号不会被当成 1970 年', () => {
    // xlsx 未开 cellDates 时返回序列号；45900 ≈ 2025-09-04。
    // `new Date(45900)` 会得到 1970-01-01 —— 原来的行为。
    expect(coerceValue('date', 45900)).not.toMatch(/^1970/)
    expect(coerceValue('date', 45900)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('常见中文写法', () => {
    expect(coerceValue('date', '2026-10-05')).toBe('2026-10-05')
    expect(coerceValue('date', '2026/10/5')).toBe('2026-10-05')
    expect(coerceValue('date', '2026.10.5')).toBe('2026-10-05')
    expect(coerceValue('date', '2026年10月5日')).toBe('2026-10-05')
  })

  it('空值与无法解析的值', () => {
    expect(coerceValue('date', '')).toBe(null)
    expect(coerceValue('date', null)).toBe(null)
    expect(coerceValue('date', undefined)).toBe(null)
    expect(coerceValue('date', '下周三')).toBe('下周三') // 保留原文交给用户看
  })
})

describe('导入：数值列', () => {
  it('千分位与货币符号', () => {
    expect(coerceValue('number', '1,200')).toBe(1200)
    expect(coerceValue('number', '1,234,567')).toBe(1234567)
    expect(coerceValue('number', '¥1,200')).toBe(1200)
    expect(coerceValue('number', '$3.50')).toBe(3.5)
    expect(coerceValue('number', ' 500 ')).toBe(500)
    expect(coerceValue('number', '１，２００')).toBe(1200) // 全角
  })

  it('中文单位后缀', () => {
    expect(coerceValue('number', '5000元')).toBe(5000)
    expect(coerceValue('number', '约5000')).toBe(5000)
    expect(coerceValue('number', '1.2万')).toBe(12000)
  })

  it('无法解析时返回 null 而不是 NaN', () => {
    // NaN 会被写进 IndexedDB（显示空白），经 JSONB 序列化变成 null，数值不可恢复
    expect(Number.isNaN(coerceValue('number', 'abc') as number)).toBe(false)
    expect(coerceValue('number', 'abc')).toBe(null)
    expect(coerceValue('rating', '—')).toBe(null)
  })

  it('0 和负数是有效值，不能当空', () => {
    expect(coerceValue('number', 0)).toBe(0)
    expect(coerceValue('number', '0')).toBe(0)
    expect(coerceValue('number', '-50')).toBe(-50)
  })
})

describe('导入：布尔与文本', () => {
  it('checkbox', () => {
    expect(coerceValue('checkbox', true)).toBe(true)
    expect(coerceValue('checkbox', '是')).toBe(true)
    expect(coerceValue('checkbox', '1')).toBe(true)
    expect(coerceValue('checkbox', '否')).toBe(false)
    expect(coerceValue('checkbox', false)).toBe(false)
  })

  it('文本保持字符串，且 0/false 不会被 String() 弄丢', () => {
    expect(coerceValue('text', '北京华盛')).toBe('北京华盛')
    expect(coerceValue('text', 0)).toBe('0')
    expect(coerceValue('text', false)).toBe('false')
  })
})
