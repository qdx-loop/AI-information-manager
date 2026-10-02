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
