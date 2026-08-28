import Dexie, { type Table } from 'dexie'
import type { Account, Library, FieldDef, Item, SnapshotRecord } from '@/types'

// 单例 Dexie 实例
export class AppDB extends Dexie {
  accounts!: Table<Account, string>
  libraries!: Table<Library, string>
  fields!: Table<FieldDef, string>
  items!: Table<Item, string>
  snapshots!: Table<SnapshotRecord, string>

  constructor() {
    super('info-management-db')
    // version(2)：libraries 增加 parentId 索引以支持子库层级
    this.version(2).stores({
      accounts: 'id, username',
      libraries: 'id, accountId, parentId, category, sortOrder, deletedAt',
      fields: 'id, libraryId, sortOrder',
      items: 'id, libraryId, accountId, sortOrder, pinned, deletedAt, updatedAt',
    })
    // version(3)：新增快照表（数据回溯）
    this.version(3).stores({
      accounts: 'id, username',
      libraries: 'id, accountId, parentId, category, sortOrder, deletedAt',
      fields: 'id, libraryId, sortOrder',
      items: 'id, libraryId, accountId, sortOrder, pinned, deletedAt, updatedAt',
      snapshots: 'id, accountId, createdAt',
    })
  }
}

export const db = new AppDB()
