// 回归测试：编辑类操作必须刷新 updatedAt，否则跨设备合并会把它们判为「本地没变」
//
// syncService.mergeNativeIntoLocal 用 updatedAt 做 last-write-wins 仲裁：
//   incNewer = inc.updatedAt > local.updatedAt
// 只有在 updatedAt 变大的那一侧才会赢。
//
// 也就是说：任何**会被用户感知的编辑**都必须刷新 updatedAt，
// 否则它在时间轴上不可见，下一次同步会被对端的旧值覆盖回去，
// 而且是三方一致地错（A 改了→B 判没变→A 又被 B 的旧值盖回来）。
//
// 本轮补齐的四个：pinItem / reorderItems（本地与云端 provider 都要）。
// 之前 renameLibrary / setLibraryCategory / reorderLibraries 已经刷新过。
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './dexie'
import { LocalDataProvider } from './localProvider'
import type { Item } from '@/types'

const ACC = 'acc-sync'
const LIB = 'L1'

const p = new LocalDataProvider()

function seedItem(id: string, over: Partial<Item> = {}): Item {
  return {
    id, libraryId: LIB, accountId: ACC,
    fields: { name: '原值' }, pinned: false, sortOrder: 0,
    createdAt: 1000, updatedAt: 1000, deletedAt: null, ...over,
  }
}

beforeEach(async () => {
  await db.items.clear()
  await db.libraries.clear()
})

describe('编辑类操作刷新 updatedAt（跨设备合并的前提）', () => {
  it('pinItem 刷新 updatedAt', async () => {
    await db.items.put(seedItem('i1'))
    await db.items.update('i1', { updatedAt: 1000 })
    await p.pinItem('i1', true)
    const got = await db.items.get('i1')
    expect(got!.pinned).toBe(true)
    expect(got!.updatedAt).toBeGreaterThan(1000)
  })

  it('reorderItems 刷新 updatedAt（且只改指定顺序）', async () => {
    await db.items.bulkPut([
      seedItem('a', { sortOrder: 0 }),
      seedItem('b', { sortOrder: 1 }),
    ])
    await db.items.update('a', { updatedAt: 1000 })
    await db.items.update('b', { updatedAt: 1000 })
    await p.reorderItems(LIB, ['b', 'a'])
    const a = await db.items.get('a')
    const b = await db.items.get('b')
    expect(a!.sortOrder).toBe(1)
    expect(b!.sortOrder).toBe(0)
    expect(a!.updatedAt).toBeGreaterThan(1000)
    expect(b!.updatedAt).toBeGreaterThan(1000)
  })

  it('reorderItems 用同一时间戳（排序是一次整体操作，避免各自为政）', async () => {
    await db.items.bulkPut([seedItem('x', { sortOrder: 0 }), seedItem('y', { sortOrder: 1 })])
    const before = Date.now()
    await p.reorderItems(LIB, ['y', 'x'])
    const x = await db.items.get('x')
    const y = await db.items.get('y')
    expect(x!.updatedAt).toBe(y!.updatedAt)
    expect(x!.updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('pinItem 不动其它字段（不能整体覆盖，deletedAt 会被写回）', async () => {
    await db.items.put(seedItem('i1', { deletedAt: 555, createdAt: 77 }))
    await p.pinItem('i1', true)
    const got = await db.items.get('i1')
    expect(got!.deletedAt).toBe(555)
    expect(got!.createdAt).toBe(77)
  })
})