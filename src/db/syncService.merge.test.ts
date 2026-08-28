// @vitest-environment jsdom
// 合并核心 mergeNativeIntoLocal 的测试：新者胜 / 墓碑传播 / 字段并集 / 幂等。
// 依赖 fake-indexeddb 提供内存版 IndexedDB（须在导入 dexie 之前注入）。
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './dexie'
import { mergeNativeIntoLocal } from './syncService'
import type { Library, FieldDef, Item } from '@/types'

const ACC = 'acc-A'

function lib(id: string, over: Partial<Library> = {}): Library {
  return { id, accountId: ACC, name: `lib-${id}`, category: '默认', sortOrder: 0, deletedAt: null, parentId: null, ...over }
}
function field(id: string, libraryId: string, over: Partial<FieldDef> = {}): FieldDef {
  return { id, libraryId, key: `k_${id}`, label: `字段${id}`, type: 'text', options: [], required: false, visible: true, sortOrder: 0, ...over }
}
function item(id: string, libraryId: string, updatedAt: number, over: Partial<Item> = {}): Item {
  return { id, libraryId, accountId: ACC, fields: { name: id }, pinned: false, sortOrder: 0, createdAt: updatedAt, updatedAt, deletedAt: null, ...over }
}

async function clearAll() {
  await Promise.all([db.libraries.clear(), db.fields.clear(), db.items.clear(), db.accounts.clear()])
}

beforeEach(async () => {
  await clearAll()
})

describe('条目：新者胜', () => {
  it('对端较新 → 覆盖本地', async () => {
    await db.items.put(item('i1', 'L1', 100, { fields: { name: '旧' } }))
    const r = await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1')],
      fields: [],
      items: [item('i1', 'L1', 200, { fields: { name: '新' } })],
    })
    expect(r.updatedItems).toBe(1)
    const got = await db.items.get('i1')
    expect(got!.updatedAt).toBe(200)
    expect(got!.fields.name).toBe('新')
  })

  it('本地较新 → 保留本地', async () => {
    await db.items.put(item('i1', 'L1', 300, { fields: { name: '本地新' } }))
    const r = await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1')],
      fields: [],
      items: [item('i1', 'L1', 100, { fields: { name: '对端旧' } })],
    })
    expect(r.updatedItems).toBe(0)
    const got = await db.items.get('i1')
    expect(got!.fields.name).toBe('本地新')
  })

  it('本地没有 → 新增', async () => {
    const r = await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1')],
      fields: [],
      items: [item('i1', 'L1', 100)],
    })
    expect(r.addedItems).toBe(1)
    expect(await db.items.get('i1')).toBeTruthy()
  })

  it('软删除也按时间比较（对端更新则传播删除）', async () => {
    await db.items.put(item('i1', 'L1', 100))
    const r = await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1')],
      fields: [],
      items: [item('i1', 'L1', 200, { deletedAt: 200 })],
    })
    expect(r.updatedItems).toBe(1)
    const got = await db.items.get('i1')
    expect(got!.deletedAt).toBe(200)
  })
})

describe('管理库：并集 + 墓碑', () => {
  it('对端新库 → 新增', async () => {
    const r = await mergeNativeIntoLocal(ACC, { libraries: [lib('L1'), lib('L2')], fields: [], items: [] })
    expect(r.addedLibraries).toBe(2)
  })

  it('对端已删、本地还在 → 传播软删除', async () => {
    await db.libraries.put(lib('L1'))
    await mergeNativeIntoLocal(ACC, { libraries: [lib('L1', { deletedAt: 555 })], fields: [], items: [] })
    const got = await db.libraries.get('L1')
    expect(got!.deletedAt).toBe(555)
  })

  it('两边都有且未删 → 保留本地（不覆盖离线改名）', async () => {
    await db.libraries.put(lib('L1', { name: '本地改名' }))
    await mergeNativeIntoLocal(ACC, { libraries: [lib('L1', { name: '对端名' })], fields: [], items: [] })
    const got = await db.libraries.get('L1')
    expect(got!.name).toBe('本地改名')
  })
})

describe('字段：并集（仅限本账号可见库）', () => {
  it('缺失字段被补上', async () => {
    await db.libraries.put(lib('L1'))
    const r = await mergeNativeIntoLocal(ACC, { libraries: [], fields: [field('f1', 'L1')], items: [] })
    expect(r.addedFields).toBe(1)
    expect(await db.fields.get('f1')).toBeTruthy()
  })

  it('已存在字段不重复插入', async () => {
    await db.libraries.put(lib('L1'))
    await db.fields.put(field('f1', 'L1'))
    const r = await mergeNativeIntoLocal(ACC, { libraries: [], fields: [field('f1', 'L1', { label: '改了' })], items: [] })
    expect(r.addedFields).toBe(0)
    const got = await db.fields.get('f1')
    expect(got!.label).toBe('字段f1') // 保留本地
  })

  it('属于未知库的字段被跳过（脏数据防护）', async () => {
    const r = await mergeNativeIntoLocal(ACC, { libraries: [], fields: [field('f1', 'NOT_EXIST')], items: [] })
    expect(r.addedFields).toBe(0)
    expect(await db.fields.get('f1')).toBeUndefined()
  })
})

describe('幂等与账号隔离', () => {
  it('重复合并结果不变', async () => {
    const incoming = { libraries: [lib('L1')], fields: [field('f1', 'L1')], items: [item('i1', 'L1', 100)] }
    await mergeNativeIntoLocal(ACC, incoming)
    const r2 = await mergeNativeIntoLocal(ACC, incoming)
    expect(r2.addedLibraries).toBe(0)
    expect(r2.addedFields).toBe(0)
    expect(r2.addedItems).toBe(0)
    expect(r2.updatedItems).toBe(0)
  })

  it('写入的条目强制绑定到当前账号', async () => {
    await mergeNativeIntoLocal(ACC, {
      libraries: [lib('L1', { accountId: '别的账号' })],
      fields: [],
      items: [item('i1', 'L1', 100, { accountId: '别的账号' })],
    })
    const gotItem = await db.items.get('i1')
    const gotLib = await db.libraries.get('L1')
    expect(gotItem!.accountId).toBe(ACC)
    expect(gotLib!.accountId).toBe(ACC)
  })
})
