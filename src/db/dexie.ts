import Dexie, { type Table } from 'dexie'
import type { Account, Library, FieldDef, Item } from '@/types'

// 单例 Dexie 实例
export class AppDB extends Dexie {
  accounts!: Table<Account, string>
  libraries!: Table<Library, string>
  fields!: Table<FieldDef, string>
  items!: Table<Item, string>

  constructor() {
    super('info-management-db')
    this.version(1).stores({
      accounts: 'id, username',
      libraries: 'id, accountId, category, sortOrder, deletedAt',
      fields: 'id, libraryId, sortOrder',
      items: 'id, libraryId, accountId, sortOrder, pinned, deletedAt, updatedAt',
    })
  }
}

export const db = new AppDB()
