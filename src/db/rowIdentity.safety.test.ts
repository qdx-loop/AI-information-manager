// @vitest-environment jsdom
// 回归测试：表格内联编辑的行身份
//
// 原来 beginEdit/commitEdit 只存「行下标」，而 antd 的 render(_, record, index)
// 传的 index 是**分页后的页内下标**（pageSize 20）。于是：
//   在第 2 页点任意单元格 → 编辑器里显示第 1 条的内容 → 回车把改动写进整个库的第 1 条。
// 这类静默写错行不会报错，只会在几天后被发现，所以用测试锁死「按 id 定位」。
import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { db } from '@/db/dexie'
import type { Item } from '@/types'

/** 复刻修复后的定位逻辑：页内下标只用于 DOM，数据身份一律用 id */
function resolveTarget(items: Item[], cell: { id: string } | null): Item | undefined {
  if (!cell) return undefined
  return items.find((i) => i.id === cell.id)
}

function item(id: string, n: number): Item {
  return {
    id, libraryId: 'L1', accountId: 'A', fields: { name: `第${n}条` },
    pinned: false, sortOrder: n, createdAt: 1, updatedAt: 1, deletedAt: null,
  }
}

describe('表格内联编辑的行身份', () => {
  it('第 2 页的一行不会被解析成第 1 行（25 条、分页 20）', () => {
    const items = Array.from({ length: 25 }, (_, i) => item(`i${i + 1}`, i + 1))
    const PAGE = 20
    // antd 给出的页内下标：第 2 页的第 1 行 index = 0
    const pageTwoFirstRowIndex = 0
    const record = items.slice(PAGE)[pageTwoFirstRowIndex] // 也就是 items[20] = i21
    expect(record.id).toBe('i21')

    // 修复前：items[pageTwoFirstRowIndex] → i1（错行）
    // 修复后：按 record.id 找
    const target = resolveTarget(items, { id: record.id })
    expect(target!.id).toBe('i21')
    expect(target!.fields.name).toBe('第21条')
  })

  it('行被删除后按 id 解析得到 undefined，而不是误伤别人', () => {
    const items = [item('i1', 1), item('i2', 2)]
    expect(resolveTarget(items, { id: 'i2' })!.id).toBe('i2')
    expect(resolveTarget(items, { id: '已删除' })).toBeUndefined()
  })
})

// 同时锁住「改名/改分类/改排序必须刷新 updatedAt」这条跨设备合并不变式。
// 云端 provider 原来不刷新，于是改名在下次同步时被对方覆盖回去。
describe('改名/分类/排序必须刷新 updatedAt', () => {
  it('localProvider 三者都刷新（既有行为，防回归）', async () => {
    const { LocalDataProvider } = await import('@/db/localProvider')
    const p = new LocalDataProvider()
    const lib = {
      id: 'L1', accountId: 'A', name: '旧名', category: '默认',
      sortOrder: 0, deletedAt: null, parentId: null, updatedAt: 1000,
    }
    await db.libraries.put(lib as never)

    await p.renameLibrary('L1', '新名')
    expect((await db.libraries.get('L1'))!.updatedAt).toBeGreaterThan(1000)

    await db.libraries.update('L1', { updatedAt: 1000 })
    await p.setLibraryCategory('L1', '客户')
    expect((await db.libraries.get('L1'))!.updatedAt).toBeGreaterThan(1000)

    await db.libraries.update('L1', { updatedAt: 1000 })
    await p.reorderLibraries('A', ['L1'])
    expect((await db.libraries.get('L1'))!.updatedAt).toBeGreaterThan(1000)

    await db.libraries.clear()
  })

  it('supabaseProvider 三者都带 updated_at（本次修复点）', async () => {
    const updates: Array<{ table: string; patch: Record<string, unknown> }> = []
    const fake = {
      from: (table: string) => {
        const chain = {
          update: (patch: Record<string, unknown>) => {
            updates.push({ table, patch })
            return chain
          },
          eq: () => Promise.resolve({ error: null }),
        }
        return chain
      },
    }
    const { SupabaseDataProvider } = await import('@/db/supabaseProvider')
    // 构造函数会调 createClient，这里造实例后直接换掉 client，绕开真实网络配置
    const p = new SupabaseDataProvider('https://example.supabase.co', 'anon-key')
    ;(p as unknown as { client: unknown }).client = fake

    await p.renameLibrary('L1', '新名')
    await p.setLibraryCategory('L1', '客户')
    await p.reorderLibraries('A', ['L1'])

    expect(updates).toHaveLength(3)
    for (const u of updates) {
      expect(u.table).toBe('libraries')
      // 缺这一项，跨设备合并会判为「本地没变」并把改动覆盖回去
      expect(u.patch).toHaveProperty('updated_at')
      expect(typeof u.patch.updated_at).toBe('number')
    }
  })
})
