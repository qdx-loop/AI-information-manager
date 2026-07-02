import type { DataProvider } from '@/types/dataProvider'
import type {
  Account,
  Library,
  FieldDef,
  Item,
  TrashEntry,
  BackupBlob,
} from '@/types'
import { db } from './dexie'
import { generateSalt, hashPassword, verifyPassword } from '@/utils/crypto'
import { newId } from '@/utils/id'

export class LocalDataProvider implements DataProvider {
  // —————— 账户 ——————
  async registerAccount(username: string, password: string): Promise<Account> {
    const existed = await db.accounts.where('username').equals(username).first()
    if (existed) throw new Error('用户名已存在')
    const salt = generateSalt()
    const passwordHash = await hashPassword(password, salt)
    const account: Account = {
      id: newId(),
      username,
      passwordHash,
      salt,
      createdAt: Date.now(),
    }
    await db.accounts.add(account)
    return account
  }

  async loginAccount(username: string, password: string): Promise<Account> {
    const account = await db.accounts.where('username').equals(username).first()
    if (!account) throw new Error('账户不存在')
    const ok = await verifyPassword(password, account.salt, account.passwordHash)
    if (!ok) throw new Error('密码错误')
    return account
  }

  async listAccounts(): Promise<Account[]> {
    const accounts = await db.accounts.toArray()
    return accounts.sort((a, b) => a.createdAt - b.createdAt)
  }

  async updatePassword(accountId: string, newPassword: string): Promise<void> {
    const account = await db.accounts.get(accountId)
    if (!account) throw new Error('账户不存在')
    const salt = generateSalt()
    const passwordHash = await hashPassword(newPassword, salt)
    await db.accounts.update(accountId, { salt, passwordHash })
  }

  async deleteAccount(accountId: string): Promise<void> {
    await db.transaction('rw', db.accounts, db.libraries, db.fields, db.items, async () => {
      await db.accounts.delete(accountId)
      const libs = await db.libraries.where('accountId').equals(accountId).toArray()
      const libIds = libs.map((l) => l.id)
      await db.libraries.bulkDelete(libIds)
      await db.fields.where('libraryId').anyOf(libIds).delete()
      await db.items.where('accountId').equals(accountId).delete()
    })
  }

  // —————— 管理库 ——————
  async listLibraries(accountId: string): Promise<Library[]> {
    const all = await db.libraries
      .where('accountId')
      .equals(accountId)
      .and((l) => l.deletedAt === null)
      .toArray()
    return all.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async createLibrary(lib: Library): Promise<Library> {
    await db.libraries.add(lib)
    return lib
  }

  async renameLibrary(id: string, name: string): Promise<void> {
    await db.libraries.update(id, { name })
  }

  async setLibraryCategory(id: string, category: string): Promise<void> {
    await db.libraries.update(id, { category })
  }

  async deleteLibrary(id: string): Promise<void> {
    const now = Date.now()
    await db.transaction('rw', db.libraries, db.items, async () => {
      await db.libraries.update(id, { deletedAt: now })
      // 只级联删除尚未被单独删除的条目，保留已回收条目的原始 deletedAt
      const items = await db.items.where('libraryId').equals(id).toArray()
      await Promise.all(
        items
          .filter((it) => it.deletedAt === null)
          .map((it) => db.items.update(it.id, { deletedAt: now })),
      )
    })
  }

  async restoreLibrary(id: string): Promise<void> {
    await db.transaction('rw', db.libraries, db.items, async () => {
      const lib = await db.libraries.get(id)
      const libDeletedAt = lib?.deletedAt
      await db.libraries.update(id, { deletedAt: null })
      if (libDeletedAt === null || libDeletedAt === undefined) return
      // 只恢复随库一起被级联删除的条目（deletedAt 与库相同），不恢复用户单独删除的
      const items = await db.items.where('libraryId').equals(id).toArray()
      await Promise.all(
        items
          .filter((it) => it.deletedAt === libDeletedAt)
          .map((it) => db.items.update(it.id, { deletedAt: null })),
      )
    })
  }

  async purgeLibrary(id: string): Promise<void> {
    await db.transaction('rw', db.libraries, db.fields, db.items, async () => {
      await db.libraries.delete(id)
      await db.fields.where('libraryId').equals(id).delete()
      await db.items.where('libraryId').equals(id).delete()
    })
  }

  async reorderLibraries(_accountId: string, orderedIds: string[]): Promise<void> {
    await db.transaction('rw', db.libraries, async () => {
      await Promise.all(orderedIds.map((id, idx) => db.libraries.update(id, { sortOrder: idx })))
    })
  }

  // —————— 字段模板 ——————
  async getTemplate(libraryId: string): Promise<FieldDef[]> {
    const fields = await db.fields.where('libraryId').equals(libraryId).toArray()
    return fields.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async saveTemplate(libraryId: string, fields: FieldDef[]): Promise<void> {
    await db.transaction('rw', db.fields, async () => {
      await db.fields.where('libraryId').equals(libraryId).delete()
      await db.fields.bulkAdd(fields.map((f) => ({ ...f, libraryId })))
    })
  }

  async cloneTemplate(srcLibraryId: string, dstLibraryId: string): Promise<void> {
    const src = await this.getTemplate(srcLibraryId)
    const cloned: FieldDef[] = src.map((f, idx) => ({
      ...f,
      id: newId(),
      libraryId: dstLibraryId,
      key: f.key,
      sortOrder: idx,
    }))
    await this.saveTemplate(dstLibraryId, cloned)
  }

  // —————— 条目 ——————
  async listItems(libraryId: string): Promise<Item[]> {
    const items = await db.items
      .where('libraryId')
      .equals(libraryId)
      .and((i) => i.deletedAt === null)
      .toArray()
    return items.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return a.sortOrder - b.sortOrder
    })
  }

  async createItem(item: Item): Promise<Item> {
    await db.items.add(item)
    return item
  }

  async updateItem(item: Item): Promise<void> {
    await db.items.update(item.id, { ...item, updatedAt: Date.now() })
  }

  async deleteItem(id: string): Promise<void> {
    await db.items.update(id, { deletedAt: Date.now() })
  }

  async restoreItem(id: string): Promise<void> {
    await db.items.update(id, { deletedAt: null })
  }

  async purgeItem(id: string): Promise<void> {
    await db.items.delete(id)
  }

  async pinItem(id: string, pinned: boolean): Promise<void> {
    await db.items.update(id, { pinned })
  }

  async reorderItems(_libraryId: string, orderedIds: string[]): Promise<void> {
    await db.transaction('rw', db.items, async () => {
      await Promise.all(orderedIds.map((id, idx) => db.items.update(id, { sortOrder: idx })))
    })
  }

  // —————— 回收站 ——————
  async listTrash(accountId: string): Promise<TrashEntry[]> {
    const libs = await db.libraries
      .where('accountId')
      .equals(accountId)
      .and((l) => l.deletedAt !== null)
      .toArray()
    const items = await db.items
      .where('accountId')
      .equals(accountId)
      .and((i) => i.deletedAt !== null)
      .toArray()

    const libMap = new Map(libs.map((l) => [l.id, l.name]))

    const libEntries: TrashEntry[] = libs.map((l) => ({
      kind: 'library' as const,
      record: l,
      deletedAt: l.deletedAt as number,
    }))
    const itemEntries: TrashEntry[] = items.map((i) => ({
      kind: 'item' as const,
      record: i,
      libraryName: libMap.get(i.libraryId) ?? '（已删除的库）',
      deletedAt: i.deletedAt as number,
    }))

    return [...libEntries, ...itemEntries].sort((a, b) => b.deletedAt - a.deletedAt)
  }

  // —————— 备份 / 恢复 ——————
  async exportAll(accountId: string): Promise<BackupBlob> {
    const [libraries, items] = await Promise.all([
      db.libraries.where('accountId').equals(accountId).toArray(),
      db.items.where('accountId').equals(accountId).toArray(),
    ])
    const libIds = libraries.map((l) => l.id)
    const fields = await db.fields.where('libraryId').anyOf(libIds).toArray()
    return {
      version: 1,
      exportedAt: Date.now(),
      accountId,
      libraries,
      fields,
      items,
    }
  }

  async importAll(accountId: string, blob: BackupBlob): Promise<void> {
    await db.transaction('rw', db.libraries, db.fields, db.items, async () => {
      // 清空当前账户现有数据
      const existingLibs = await db.libraries.where('accountId').equals(accountId).toArray()
      const existingLibIds = existingLibs.map((l) => l.id)
      await db.libraries.bulkDelete(existingLibIds)
      await db.fields.where('libraryId').anyOf(existingLibIds).delete()
      await db.items.where('accountId').equals(accountId).delete()
      // 写入备份数据（强制绑定到当前账户）
      await db.libraries.bulkPut(blob.libraries.map((l) => ({ ...l, accountId })))
      await db.fields.bulkPut(blob.fields)
      await db.items.bulkPut(blob.items.map((i) => ({ ...i, accountId })))
    })
  }

  // —————— 云端同步（本地 no-op）——————
  async syncFromCloud(): Promise<void> {}
  async syncToCloud(): Promise<void> {}
}
