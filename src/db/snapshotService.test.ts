// @vitest-environment jsdom
// 数据回溯 snapshotService 测试：创建/列表/保留上限/恢复/删除/账号隔离。
// 依赖 fake-indexeddb 提供内存版 IndexedDB（须在导入 dexie 之前注入）。
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './dexie'
import { createSnapshot, listSnapshots, restoreSnapshot, deleteSnapshot, MAX_SNAPSHOTS } from './snapshotService'
import type { Library, Item } from '@/types'

const ACC = 'acc-A'

function lib(id: string, over: Partial<Library> = {}): Library {
  return { id, accountId: ACC, name: `lib-${id}`, category: '默认', sortOrder: 0, deletedAt: null, parentId: null, ...over }
}
function item(id: string, libraryId: string, updatedAt: number, over: Partial<Item> = {}): Item {
  return { id, libraryId, accountId: ACC, fields: { name: id }, pinned: false, sortOrder: 0, createdAt: updatedAt, updatedAt, deletedAt: null, ...over }
}

async function clearAll() {
  await Promise.all([db.libraries.clear(), db.fields.clear(), db.items.clear(), db.snapshots.clear(), db.accounts.clear()])
}

beforeEach(async () => {
  await clearAll()
})

describe('创建与列表', () => {
  it('捕获当前数据并可列出摘要', async () => {
    await db.libraries.put(lib('L1'))
    await db.items.put(item('i1', 'L1', 100))
    await createSnapshot(ACC, 'manual')
    const list = await listSnapshots(ACC)
    expect(list.length).toBe(1)
    expect(list[0].trigger).toBe('manual')
    expect(list[0].libraries).toBe(1)
    expect(list[0].items).toBe(1)
  })

  it('列表按时间倒序（最新在前）', async () => {
    await db.libraries.put(lib('L1'))
    await createSnapshot(ACC, 'manual')
    await db.items.put(item('i1', 'L1', 100))
    await createSnapshot(ACC, 'transfer')
    const list = await listSnapshots(ACC)
    expect(list.length).toBe(2)
    expect(list[0].trigger).toBe('transfer')
    expect(list[0].createdAt).toBeGreaterThanOrEqual(list[1].createdAt)
  })
})

describe('保留上限', () => {
  it('超过 MAX_SNAPSHOTS 时自动删除最旧', async () => {
    await db.libraries.put(lib('L1'))
    for (let i = 0; i < MAX_SNAPSHOTS + 3; i++) {
      await createSnapshot(ACC, 'manual')
    }
    const list = await listSnapshots(ACC)
    expect(list.length).toBe(MAX_SNAPSHOTS)
  })
})

describe('恢复', () => {
  it('整体还原数据，且先自动存一张恢复前快照', async () => {
    await db.libraries.put(lib('L1'))
    await db.items.put(item('i1', 'L1', 100))
    const snap = await createSnapshot(ACC, 'manual') // 记录 L1 + i1

    // 快照之后又改了数据
    await db.items.put(item('i2', 'L1', 200))
    await db.libraries.put(lib('L2'))

    await restoreSnapshot(ACC, snap.id)

    const items = await db.items.where('accountId').equals(ACC).toArray()
    const libs = await db.libraries.where('accountId').equals(ACC).toArray()
    expect(items.map((i) => i.id).sort()).toEqual(['i1'])
    expect(libs.map((l) => l.id).sort()).toEqual(['L1'])

    const list = await listSnapshots(ACC)
    expect(list.some((s) => s.trigger === 'pre-restore')).toBe(true)
  })

  it('恢复不存在的快照会抛错', async () => {
    await expect(restoreSnapshot(ACC, 'nonexistent')).rejects.toThrow()
  })
})

describe('删除与账号隔离', () => {
  it('删除后列表不再包含', async () => {
    await db.libraries.put(lib('L1'))
    const snap = await createSnapshot(ACC, 'manual')
    await deleteSnapshot(ACC, snap.id)
    const list = await listSnapshots(ACC)
    expect(list.length).toBe(0)
  })

  it('无法恢复或删除其他账号的快照', async () => {
    await db.libraries.put(lib('L1'))
    const snap = await createSnapshot(ACC, 'manual')
    await expect(restoreSnapshot('other-account', snap.id)).rejects.toThrow()
    await deleteSnapshot('other-account', snap.id) // 应被忽略
    const list = await listSnapshots(ACC)
    expect(list.length).toBe(1)
  })
})
