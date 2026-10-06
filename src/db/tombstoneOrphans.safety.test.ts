// 回归测试：已过保留期的墓碑库不能把它的字段「复活」成孤儿
//
// 场景（需要跨过 30 天保留期）：
//   设备 A 删除库 L（墓碑），同步 → 云端有 L 墓碑 + L 的**活字段**
//   A 上 purge 把 L 和字段硬删干净，再同步 → 云端的 L/字段还是上一版
//   设备 B 同步：
//     - 库循环：L 是已过保留期的墓碑 → continue，不插入 ✓（意图正确）
//     - 但 libIdSet 里已经把 L 的 id 加进去了
//     - 字段循环：L 的活字段通过 libIdSet.has() → 被插入
//     → 字段挂在一个本地根本不存在的库下面
//
// 孤儿字段的坏处：在任何界面里都看不到（按 libraryId 查库查不到），
// purgeExpiredTrash 也清不到（它只看得到活着的库），
// 还会跟着 exportAll 一路进后续备份和下一次同步。
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './dexie'
import { mergeNativeIntoLocal } from './syncService'

const ACC = 'acc-tomb'
const DAY = 86400000

const now = Date.now()
const pastTombstone = { id: 'L-old', name: '旧库', category: '', sortOrder: 0, parentId: null, deletedAt: now - 40 * DAY, updatedAt: now - 40 * DAY }
const aliveField = { id: 'f-old', libraryId: 'L-old', key: 'name', label: '名称', type: 'text', options: [], sortOrder: 0, deletedAt: null, updatedAt: now - 40 * DAY }

beforeEach(async () => {
  await db.libraries.clear()
  await db.fields.clear()
  await db.items.clear()
})

describe('墓碑库不复活其字段（无孤儿）', () => {
  it('已过保留期的墓碑库：不插库，也不插它的活字段', async () => {
    const r = await mergeNativeIntoLocal(ACC, {
      libraries: [pastTombstone] as never,
      fields: [aliveField] as never,
      items: [] as never,
    })

    // 库没落地
    expect(await db.libraries.get('L-old')).toBeUndefined()
    expect(r.addedLibraries).toBe(0)
    // 关键：字段也不能落地
    expect(await db.fields.get('f-old')).toBeUndefined()
    expect(r.addedFields).toBe(0)
  })

  it('保留期内的墓碑库：库和字段都落地（回收站里还能恢复）', async () => {
    const recent = { ...pastTombstone, deletedAt: now - 3 * DAY, updatedAt: now - 3 * DAY }
    const f = { ...aliveField, deletedAt: null, updatedAt: now - 3 * DAY }
    const r = await mergeNativeIntoLocal(ACC, {
      libraries: [recent] as never,
      fields: [f] as never,
      items: [] as never,
    })
    expect(await db.libraries.get('L-old')).toBeDefined()
    expect(await db.fields.get('f-old')).toBeDefined()
    expect(r.addedLibraries).toBe(1)
    expect(r.addedFields).toBe(1)
  })

  it('本地已硬删、但云端墓碑还在保留期内：字段仍应落地', async () => {
    const recent = { ...pastTombstone, deletedAt: now - 2 * DAY, updatedAt: now - 2 * DAY }
    const f = { ...aliveField, updatedAt: now - 2 * DAY }
    await mergeNativeIntoLocal(ACC, {
      libraries: [recent] as never,
      fields: [f] as never,
      items: [] as never,
    })
    expect(await db.fields.get('f-old')).toBeDefined()
  })

  it('活库（deletedAt 为 null）不受影响，字段照常落地', async () => {
    const aliveLib = { id: 'L-alive', name: '活库', category: '', sortOrder: 0, parentId: null, deletedAt: null, updatedAt: now }
    const f = { ...aliveField, id: 'f-alive', libraryId: 'L-alive', updatedAt: now }
    await mergeNativeIntoLocal(ACC, {
      libraries: [aliveLib] as never,
      fields: [f] as never,
      items: [] as never,
    })
    expect(await db.libraries.get('L-alive')).toBeDefined()
    expect(await db.fields.get('f-alive')).toBeDefined()
  })

  it('不属于本账号的字段仍然被跳过（原有防线）', async () => {
    const stray = { ...aliveField, id: 'f-stray', libraryId: 'L-nowhere', accountId: 'other' }
    const r = await mergeNativeIntoLocal(ACC, {
      libraries: [] as never,
      fields: [stray] as never,
      items: [] as never,
    })
    expect(await db.fields.get('f-stray')).toBeUndefined()
    expect(r.addedFields).toBe(0)
  })
})