// @vitest-environment jsdom
// 合并核心对「库」和「字段」的墓碑感知行为。
// fake-indexeddb 必须在导入 dexie 之前注入。
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './dexie'
import { mergeNativeIntoLocal } from './syncService'
import { LocalDataProvider } from './localProvider'
import type { Library, FieldDef, Item } from '@/types'

const ACC = 'acc-A'
const p = new LocalDataProvider()

function lib(id: string, over: Partial<Library> = {}): Library {
  return { id, accountId: ACC, name: `lib-${id}`, category: '默认', sortOrder: 0, deletedAt: null, parentId: null, updatedAt: 0, ...over }
}
function fld(id: string, libraryId: string, over: Partial<FieldDef> = {}): FieldDef {
  return { id, libraryId, key: `k_${id}`, label: `字段${id}`, type: 'text', options: [], required: false, visible: true, sortOrder: 0, updatedAt: 0, deletedAt: null, ...over }
}
function itm(id: string, libraryId: string, over: Partial<Item> = {}): Item {
  return { id, libraryId, accountId: ACC, fields: {}, pinned: false, sortOrder: 0, createdAt: 0, updatedAt: 0, deletedAt: null, ...over }
}

async function clearAll() {
  await Promise.all([db.libraries.clear(), db.fields.clear(), db.items.clear(), db.accounts.clear()])
}
beforeEach(clearAll)

/**
 * ① 管理库的改名/分类/排序以前**永远不同步，而且会把云端改回去**：
 * Library 没有 updatedAt → 合并一律「保留本地」→ 上传又拿本地旧值覆盖云端。
 * A 改名 → B 同步（丢弃）→ 上传把旧名写回云端 → A 下次同步拉回旧名。
 */
describe('管理库：改名/分类/排序终于能跨设备生效', () => {
  it('对端改名更新 → 覆盖本地旧名', async () => {
    await db.libraries.put(lib('L1', { name: '合同库', updatedAt: 100 }))
    const r = await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1', { name: '2026 合同库', updatedAt: 200 })],
      fields: [], items: [],
    })
    const got = await db.libraries.get('L1')
    expect(got!.name).toBe('2026 合同库')
    expect(r.updatedLibraries).toBe(1)
  })

  it('本地改名更新 → 保留本地（不会被旧的云端值盖掉）', async () => {
    await db.libraries.put(lib('L1', { name: '我的新名字', updatedAt: 200 }))
    await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1', { name: '旧名字', updatedAt: 100 })],
      fields: [], items: [],
    })
    expect((await db.libraries.get('L1'))!.name).toBe('我的新名字')
  })

  it('分类与排序同样按时间裁决', async () => {
    await db.libraries.put(lib('L1', { category: '旧分类', sortOrder: 9, updatedAt: 100 }))
    await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1', { category: '新分类', sortOrder: 0, updatedAt: 200 })],
      fields: [], items: [],
    })
    const got = await db.libraries.get('L1')
    expect(got!.category).toBe('新分类')
    expect(got!.sortOrder).toBe(0)
  })

  it('两边都没有 updatedAt（旧数据）→ 保持原样，不互相覆盖', async () => {
    const legacy = lib('L1', { name: '本地名' })
    delete legacy.updatedAt
    await db.libraries.put(legacy)
    const inc = lib('L1', { name: '对端名' })
    delete inc.updatedAt
    await mergeNativeIntoLocal(ACC, { libraries: [inc], fields: [], items: [] })
    expect((await db.libraries.get('L1'))!.name).toBe('本地名')
  })

  it('对端改名有 updatedAt 而本地是旧数据（undefined）→ 采纳对端', async () => {
    const legacy = lib('L1', { name: '旧数据名' })
    delete legacy.updatedAt
    await db.libraries.put(legacy)
    await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1', { name: '新数据名', updatedAt: 200 })],
      fields: [], items: [],
    })
    expect((await db.libraries.get('L1'))!.name).toBe('新数据名')
  })

  it('本地已删 + 对端改名（时间更新）→ 保持删除，不复活', async () => {
    await db.libraries.put(lib('L1', { deletedAt: 100, updatedAt: 100 }))
    await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1', { name: '对端改名', deletedAt: null, updatedAt: 200 })],
      fields: [], items: [],
    })
    const got = await db.libraries.get('L1')
    expect(got!.deletedAt).toBe(100)
    expect(got!.name).not.toBe('对端改名')
  })

  it('对端删除比本地改动新 → 传播删除', async () => {
    await db.libraries.put(lib('L1', { updatedAt: 100 }))
    await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1', { deletedAt: 200, updatedAt: 200 })],
      fields: [], items: [],
    })
    expect((await db.libraries.get('L1'))!.deletedAt).toBe(200)
  })
})

/**
 * ② 字段模板以前只做并集插入：改 label/type/options 对端永远看不到，
 * 删掉的字段还会在对端「重新长出来」。
 */
describe('字段：修改与删除都能传播', () => {
  it('对端改了 label/type → 覆盖本地', async () => {
    await db.fields.put(fld('f1', 'L1', { label: '合同金额', type: 'number', updatedAt: 100 }))
    const r = await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1')],
      fields: [fld('f1', 'L1', { label: '金额（元）', type: 'text', updatedAt: 200 })],
      items: [],
    })
    const got = await db.fields.get('f1')
    expect(got!.label).toBe('金额（元）')
    expect(got!.type).toBe('text')
    expect(r.updatedFields).toBe(1)
  })

  it('本地改得更晚 → 保留本地', async () => {
    await db.fields.put(fld('f1', 'L1', { label: '本地新名', updatedAt: 200 }))
    await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1')],
      fields: [fld('f1', 'L1', { label: '对端旧名', updatedAt: 100 })],
      items: [],
    })
    expect((await db.fields.get('f1'))!.label).toBe('本地新名')
  })

  it('对端删除字段（墓碑）→ 传播，且不复活', async () => {
    await db.fields.put(fld('f1', 'L1', { updatedAt: 100 }))
    await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1')],
      fields: [fld('f1', 'L1', { deletedAt: 200, updatedAt: 200 })],
      items: [],
    })
    const got = await db.fields.get('f1')
    expect(got!.deletedAt).toBe(200)
    // 再来一次「对端还活着」的旧版本，不得复活
    await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1')],
      fields: [fld('f1', 'L1', { deletedAt: null, updatedAt: 300 })],
      items: [],
    })
    expect((await db.fields.get('f1'))!.deletedAt).toBe(200)
  })

  it('本地删除（墓碑）+ 对端旧版本 → 不复活', async () => {
    await db.fields.put(fld('f1', 'L1', { deletedAt: 100, updatedAt: 100 }))
    await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1')],
      fields: [fld('f1', 'L1', { deletedAt: null, updatedAt: 50 })],
      items: [],
    })
    expect((await db.fields.get('f1'))!.deletedAt).toBe(100)
  })

  it('getTemplate 不返回墓碑字段（界面上不会看到被删的列）', async () => {
    await db.fields.put(fld('f1', 'L1', { label: '在册', updatedAt: 100 }))
    await db.fields.put(fld('f2', 'L1', { label: '已删', deletedAt: 200, updatedAt: 200 }))
    const tpl = await p.getTemplate('L1')
    expect(tpl.map((f) => f.label)).toEqual(['在册'])
  })
})

/**
 * saveTemplate 以前是「全删再全插」：删除无处可传。
 * 现在改成按 id upsert + 把不在册的字段标墓碑。
 */
describe('saveTemplate：删除变成可同步的墓碑', () => {
  it('移除的字段被标成墓碑而不是物理删除', async () => {
    await db.libraries.put(lib('L1', { updatedAt: 1 }))
    await p.saveTemplate('L1', [fld('f1', 'L1'), fld('f2', 'L1')])
    await p.saveTemplate('L1', [fld('f1', 'L1', { label: '改名了' })]) // 只留 f1
    const f2 = await db.fields.get('f2')
    expect(f2).toBeTruthy()                       // 行还在（墓碑）
    expect(f2!.deletedAt).not.toBe(null)
    expect((await db.fields.get('f1'))!.deletedAt).toBe(null) // 在册的没被误伤
    expect((await p.getTemplate('L1')).map((f) => f.id)).toEqual(['f1'])
  })

  it('把删掉的字段加回来 → 复活（deletedAt 清空）', async () => {
    await db.libraries.put(lib('L1', { updatedAt: 1 }))
    await p.saveTemplate('L1', [fld('f1', 'L1')])
    await p.saveTemplate('L1', [])
    expect((await db.fields.get('f1'))!.deletedAt).not.toBe(null)
    await p.saveTemplate('L1', [fld('f1', 'L1')])
    expect((await db.fields.get('f1'))!.deletedAt).toBe(null)
    expect((await p.getTemplate('L1')).length).toBe(1)
  })

  it('保存会刷新 updatedAt，否则跨设备的模板修改无法裁决', async () => {
    await db.libraries.put(lib('L1', { updatedAt: 1 }))
    await p.saveTemplate('L1', [fld('f1', 'L1', { updatedAt: 0 })])
    expect((await db.fields.get('f1'))!.updatedAt).toBeGreaterThan(0)
  })

  it('字段值不会因为字段被删而丢失（只在模板里消失）', async () => {
    await db.libraries.put(lib('L1', { updatedAt: 1 }))
    await db.items.put(itm('i1', 'L1', { fields: { k_f1: '重要数据' } }))
    await p.saveTemplate('L1', [fld('f1', 'L1')])
    await p.saveTemplate('L1', [])
    expect((await db.items.get('i1'))!.fields.k_f1).toBe('重要数据')
  })
})

/**
 * 彻底删除（purge）后的复活。
 *
 * 原来 purge 是真的把云端行 DELETE 掉，于是 30 天到期（或用户手动彻底删除）后：
 *   A 云端行已删 → B 还留着数据 → B 一上传把数据带回云端
 *   → A 一拉，本地没有该 id → 合并的「本地没有就插入」分支插回来
 *   → **已删数据完整复活**
 *
 * 现在云端 purge 改成「清空内容、保留 id 与 deleted_at 作为墓碑」，
 * 合并侧再补一条规则：本地没有 + 对端是墓碑 → 不插入。
 * 本地缺失本身就等于「不存在」，墓碑不必再写一遍。
 */
const DAY = 86400000
/** 保留期内的墓碑（刚刚删掉） */
const fresh = () => Date.now() - 2 * DAY
/** 已过保留期的墓碑（该被彻底清除了） */
const stale = () => Date.now() - 40 * DAY

describe('彻底删除后不会被另一台设备复活', () => {
  it('条目：本地已清空 + 云端墓碑 → 不再插回来', async () => {
    // A 已经把 X 彻底删除（本地没有这一行了）
    expect(await db.items.get('i1')).toBeUndefined()
    const r = await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1')],
      fields: [],
      items: [itm('i1', 'L1', { deletedAt: 1000, updatedAt: 1000, fields: {} })],
    })
    expect(await db.items.get('i1')).toBeUndefined()
    expect(r.addedItems).toBe(0)
  })

  it('管理库：本地已清空 + 云端墓碑 → 不再插回来', async () => {
    expect(await db.libraries.get('L1')).toBeUndefined()
    const r = await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1', { deletedAt: 1000, updatedAt: 1000 })],
      fields: [], items: [],
    })
    expect(await db.libraries.get('L1')).toBeUndefined()
    expect(r.addedLibraries).toBe(0)
  })

  it('字段：本地已清空 + 云端墓碑 → 不再插回来（列不会重新长出来）', async () => {
    const r = await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1', { updatedAt: 1 })],
      fields: [fld('f1', 'L1', { deletedAt: 1000, updatedAt: 1000 })],
      items: [],
    })
    expect(await db.fields.get('f1')).toBeUndefined()
    expect(r.addedFields).toBe(0)
  })

  it('但不误伤正常新增：本地没有 + 云端是活记录 → 照常插入', async () => {
    // 这条规则不能把「另一台设备新建的条目/库」也挡掉
    const r = await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1', { updatedAt: 100 })],
      fields: [fld('f1', 'L1', { updatedAt: 100 })],
      items: [itm('i1', 'L1', { updatedAt: 100, fields: { name: '新建的' } })],
    })
    expect(r.addedLibraries).toBe(1)
    expect(r.addedFields).toBe(1)
    expect(r.addedItems).toBe(1)
    expect((await db.items.get('i1'))!.fields.name).toBe('新建的')
  })

  it('另一台设备仍持有活副本时，会被云端墓碑纠正为已删（而不是它把删除推回去）', async () => {
    // B 从没同步到删除，本地还是活的
    await db.items.put(itm('i1', 'L1', { updatedAt: 50, deletedAt: null }))
    // 云端是 A 的墓碑（payload 已清空）
    await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1', { updatedAt: 1 })],
      fields: [],
      items: [itm('i1', 'L1', { deletedAt: 1000, updatedAt: 1000, fields: {} })],
    })
    const got = await db.items.get('i1')
    expect(got!.deletedAt).toBe(1000) // B 被纠正为已删
  })

  it('彻底删除是幂等的：重复收到同一条墓碑不会报错也不会插回来', async () => {
    const payload = {
      libraries: [lib('L1', { updatedAt: 1 })],
      fields: [],
      items: [itm('i1', 'L1', { deletedAt: 1000, updatedAt: 1000, fields: {} })],
    }
    await mergeNativeIntoLocal(ACC, payload)
    await mergeNativeIntoLocal(ACC, payload)
    await mergeNativeIntoLocal(ACC, payload)
    expect(await db.items.get('i1')).toBeUndefined()
  })
})

/**
 * 反向用例：跳过规则不能一刀切。
 * 保留期内的墓碑仍然要落地本地 —— 否则「在另一台设备删掉的东西」
 * 就不会出现在本机回收站里，用户也永远没法从另一台设备恢复它。
 */
describe('保留期内的删除仍然同步到各设备（可恢复）', () => {
  it('条目：刚删掉的条目会出现在本机', async () => {
    await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1', { updatedAt: 1 })],
      fields: [],
      items: [itm('i1', 'L1', { deletedAt: fresh(), updatedAt: fresh() })],
    })
    const got = await db.items.get('i1')
    expect(got).toBeTruthy()
    expect(got!.deletedAt).not.toBe(null) // 是墓碑，回收站里可见
  })

  it('管理库：刚删掉的库会出现在本机', async () => {
    await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1', { deletedAt: fresh(), updatedAt: fresh() })],
      fields: [], items: [],
    })
    expect(await db.libraries.get('L1')).toBeTruthy()
  })

  it('字段：刚删掉的字段在本机仍标记为墓碑', async () => {
    await db.libraries.put(lib('L1', { updatedAt: 1 }))
    await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1', { updatedAt: 1 })],
      fields: [fld('f1', 'L1', { deletedAt: fresh(), updatedAt: fresh() })],
      items: [],
    })
    expect((await db.fields.get('f1'))!.deletedAt).not.toBe(null)
    expect((await p.getTemplate('L1')).length).toBe(0) // 但界面上看不到这一列
  })

  it('超过保留期（40 天）→ 不落地', async () => {
    await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1', { updatedAt: 1 })],
      fields: [],
      items: [itm('i1', 'L1', { deletedAt: stale(), updatedAt: stale() })],
    })
    expect(await db.items.get('i1')).toBeUndefined()
  })

  it('判定基准是删除时刻，不是最后修改时刻', async () => {
    // 删了 40 天，之后又有人改过一次（updatedAt 是现在）→ 仍按删除时刻算，已过保留期
    await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1', { updatedAt: 1 })],
      fields: [],
      items: [itm('i1', 'L1', { deletedAt: stale(), updatedAt: Date.now() })],
    })
    expect(await db.items.get('i1')).toBeUndefined()
  })
})
