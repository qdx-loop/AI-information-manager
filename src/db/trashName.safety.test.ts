// @vitest-environment jsdom
// 回归测试：回收站里「条目所属库」的名称解析。
// 旧实现只把 deletedAt !== null 的库放进名称映射，于是删一条条目后，
// 父库明明还在，回收站却显示「（已删除的库）」——误导用户以为库也没了。
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './dexie'
import { LocalDataProvider } from './localProvider'
import type { Library, Item } from '@/types'

const ACC = 'acc-trash'
const p = new LocalDataProvider()

function lib(id: string, over: Partial<Library> = {}): Library {
  return { id, accountId: ACC, name: `lib-${id}`, category: '默认', sortOrder: 0, deletedAt: null, parentId: null, updatedAt: 0, ...over }
}
function itm(id: string, libraryId: string, over: Partial<Item> = {}): Item {
  return { id, libraryId, accountId: ACC, fields: {}, pinned: false, sortOrder: 0, createdAt: 0, updatedAt: 0, deletedAt: null, ...over }
}

beforeEach(async () => {
  await Promise.all([db.libraries.clear(), db.fields.clear(), db.items.clear(), db.accounts.clear()])
})

describe('回收站：条目所属库名称解析', () => {
  it('父库仍在时显示真实库名，而不是「已删除的库」', async () => {
    await db.libraries.put(lib('L1', { name: '客户管理' }))
    await db.items.put(itm('I1', 'L1', { deletedAt: Date.now() }))

    const entries = await p.listTrash(ACC)
    const item = entries.find((e) => e.kind === 'item')
    expect(item).toBeTruthy()
    if (item?.kind === 'item') expect(item.libraryName).toBe('客户管理')
  })

  it('父库已被永久清除时 libraryName 留空，交给 UI 的 i18n 文案兜底', async () => {
    await db.items.put(itm('I2', 'L-gone', { deletedAt: Date.now() }))
    const entries = await p.listTrash(ACC)
    const item = entries.find((e) => e.kind === 'item')
    if (item?.kind === 'item') expect(item.libraryName).toBe('')
  })
})
