import { describe, it, expect } from 'vitest'
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
