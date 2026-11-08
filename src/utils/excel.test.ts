import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { itemsToExcel, parseExcel } from '@/utils/excel'
import type { FieldDef, Item } from '@/types'

// 回归：xlsx 已从 0.18.5（含原型污染/ReDoS 漏洞）升级到 0.20.3 补丁版，
// 本测试锁定升级后导出/解析 API 行为不变。

function field(key: string, label: string): FieldDef {
  return {
    id: `f-${key}`,
    libraryId: 'lib-1',
    key,
    label,
    type: 'text',
    options: [],
    required: false,
    visible: true,
    sortOrder: 0,
  }
}

function item(fields: Record<string, unknown>): Item {
  return {
    id: 'item-1',
    libraryId: 'lib-1',
    accountId: 'acc-1',
    fields: fields as Item['fields'],
    pinned: false,
    sortOrder: 0,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  }
}

describe('Excel 导出/解析往返（xlsx 0.20.3）', () => {
  it('导出后再解析能还原表头与单元格', async () => {
    const fields = [field('name', '姓名'), field('age', '年龄'), field('city', '城市')]
    const items = [
      item({ name: '张三', age: 30, city: '北京' }),
      item({ name: '李四', age: 25, city: '上海' }),
    ]
    const blob = itemsToExcel(items, fields)
    expect(blob.size).toBeGreaterThan(0)

    const file = new File([blob], 'data.xlsx', { type: 'application/octet-stream' })
    const rows = await parseExcel(file)

    expect(rows.length).toBe(2)
    expect(rows[0]['姓名']).toBe('张三')
    expect(Number(rows[0]['年龄'])).toBe(30)
    expect(rows[1]['城市']).toBe('上海')
  })

  it('不可见字段不导出', async () => {
    const fields = [field('name', '姓名'), { ...field('secret', '隐藏'), visible: false }]
    const items = [item({ name: '王五', secret: '不应出现' })]
    const blob = itemsToExcel(items, fields)
    const file = new File([blob], 'data.xlsx', { type: 'application/octet-stream' })
    const rows = await parseExcel(file)
    expect(rows[0]['姓名']).toBe('王五')
    expect('隐藏' in rows[0]).toBe(false)
  })
})

// 回归：导入曾用 sheet_to_json({ raw: false })，单元格全被格式化成显示字符串：
// 布尔 true → "TRUE"（coerceValue 当 false）、百分比 0.52 → "52%"（被当 52）、
// 日期 → 依赖区域格式的字符串（"10/28/26"），属于静默数据损坏。
describe('Excel 导入：保留单元格原始类型（raw:true）', () => {
  it('数字 / 布尔 / 日期保持原始类型', async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['姓名', '完成率', '已完成', '签约日期'],
      ['张三', 0.52, true, new Date(2026, 9, 5)],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const file = new File([buf], 'typed.xlsx', { type: 'application/octet-stream' })

    const rows = await parseExcel(file)
    expect(typeof rows[0]['完成率']).toBe('number')
    expect(rows[0]['完成率']).toBe(0.52)
    expect(rows[0]['已完成']).toBe(true)
    expect(rows[0]['签约日期']).toBeInstanceOf(Date)
  })
})
