// @vitest-environment jsdom
// fake-indexeddb 必须在导入 dexie 之前注入
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './dexie'
import { LocalDataProvider } from './localProvider'
import type { Item } from '@/types'

const ACC = 'acc-A'

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'i1', libraryId: 'L1', accountId: ACC,
    fields: { name: '原值' }, pinned: false, sortOrder: 3,
    createdAt: 1000, updatedAt: 1000, deletedAt: null, ...over,
  }
}

const p = new LocalDataProvider()

beforeEach(async () => { await db.items.clear() })

/**
 * updateItem 原来写的是 `{ ...item }` —— 整条覆盖。
 * 调用方传进来的是**打开界面那一刻**的快照，所以 deleted_at 会被一起写回：
 *   打开条目 X 的编辑器 → 另一标签页/设备删了 X → 用户保存 → X 复活。
 * 锁住「updateItem 只写字段内容」这条不变量。
 */
describe('LocalProvider.updateItem 只写字段', () => {
  it('不会把过期的 deletedAt 写回去（条目不会被复活）', async () => {
    await db.items.put(item())
    await p.deleteItem('i1') // 另一处删除
    // 编辑器持有的是删除之前的快照
    await p.updateItem(item({ fields: { name: '用户改的' } }))
    const got = await db.items.get('i1')
    expect(got!.deletedAt).not.toBe(null) // 仍然是已删
    expect(got!.fields.name).toBe('用户改的') // 但字段改动确实写进去了
  })

  it('不改动 pinned / sortOrder / createdAt / libraryId', async () => {
    await db.items.put(item({ pinned: true, sortOrder: 9, createdAt: 555 }))
    await p.updateItem(item({ pinned: false, sortOrder: 0, createdAt: 1, libraryId: 'L2' }))
    const got = await db.items.get('i1')
    expect(got!.pinned).toBe(true)
    expect(got!.sortOrder).toBe(9)
    expect(got!.createdAt).toBe(555)
    expect(got!.libraryId).toBe('L1')
  })

  it('正常编辑仍会刷新 updatedAt', async () => {
    await db.items.put(item())
    await p.updateItem(item({ fields: { name: 'x' } }))
    expect((await db.items.get('i1'))!.updatedAt).toBeGreaterThan(1000)
  })
})

describe('LocalProvider 删除/恢复刷新 updatedAt', () => {
  it('deleteItem 同时写 deletedAt 和 updatedAt', async () => {
    await db.items.put(item({ updatedAt: 100 }))
    await p.deleteItem('i1')
    const got = await db.items.get('i1')
    expect(got!.deletedAt).not.toBe(null)
    // 合并的冲突判定比的是 updatedAt；不刷新的话「删除」在时间轴上不可见，
    // 会被任何并发编辑整体覆盖
    expect(got!.updatedAt).toBeGreaterThan(100)
  })

  it('restoreItem 清空 deletedAt 并刷新 updatedAt', async () => {
    await db.items.put(item({ deletedAt: 500, updatedAt: 500 }))
    await p.restoreItem('i1')
    const got = await db.items.get('i1')
    expect(got!.deletedAt).toBe(null)
    expect(got!.updatedAt).toBeGreaterThan(500)
  })
})

describe('LocalProvider.getItem', () => {
  it('能取到已软删的记录（冲突检测需要）', async () => {
    await db.items.put(item())
    await p.deleteItem('i1')
    // store 的 items 数组里已经没有它了，冲突检测必须能查到
    expect(await p.getItem('i1')).not.toBeNull()
  })

  it('不存在的返回 null 而不是 undefined', async () => {
    expect(await p.getItem('nope')).toBeNull()
  })
})

describe('LocalProvider.purgeExpiredTrash', () => {
  it('只清理超过保留期的软删内容', async () => {
    const old = Date.now() - 40 * 86400000
    const fresh = Date.now() - 2 * 86400000
    await db.items.put(item({ id: 'gone', deletedAt: old, updatedAt: old }))
    await db.items.put(item({ id: 'stay', deletedAt: fresh, updatedAt: fresh }))
    await db.items.put(item({ id: 'alive', deletedAt: null }))
    await p.purgeExpiredTrash(ACC, 30)
    expect(await db.items.get('gone')).toBeUndefined()
    expect(await db.items.get('stay')).toBeTruthy()
    expect(await db.items.get('alive')).toBeTruthy()
  })
})
