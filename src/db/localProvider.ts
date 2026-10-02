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

// 收集某库及其所有子孙库的 id 列表（含根）。minDeletedAt 可选：恢复时只取 deletedAt 与之相同的子孙
function collectDescendants(all: Library[], rootId: string, minDeletedAt?: number | null): Library[] {
  const result: Library[] = []
  const byParent = new Map<string | null, Library[]>()
  for (const l of all) byParent.set(l.parentId ?? null, [...(byParent.get(l.parentId ?? null) ?? []), l])

  const walk = (pid: string) => {
    const children = byParent.get(pid) ?? []
    for (const c of children) {
      result.push(c)
      walk(c.id)
    }
  }
  const root = all.find((l) => l.id === rootId)
  if (!root) return []
  result.push(root)
  walk(root.id)
  // 恢复场景：若指定了删除时间，仅保留同时被级联删除的子孙（过滤掉单独删除的）
  if (minDeletedAt !== undefined) {
    return result.filter((l) => l.deletedAt === minDeletedAt)
  }
  return result
}

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
    // 安全：仅返回非敏感字段（本地数据虽在浏览器内，但保持与云端实现一致的安全契约）
    const accounts = await db.accounts.toArray()
    return accounts
      .map((a) => ({ id: a.id, username: a.username, passwordHash: '', salt: '', createdAt: a.createdAt }))
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  async getAccountById(accountId: string): Promise<Account | null> {
    const acc = await db.accounts.get(accountId)
    return acc ?? null
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
    const rec: Library = { ...lib, updatedAt: lib.updatedAt ?? Date.now() }
    await db.libraries.add(rec)
    return rec
  }

  // 下面这几个方法都必须刷新 updatedAt：跨设备的改名/分类/排序靠它来裁决，
  // 不刷新的话这些改动在合并时一律被判为「本地没变」，然后被对方覆盖。

  async renameLibrary(id: string, name: string): Promise<void> {
    await db.libraries.update(id, { name, updatedAt: Date.now() })
  }

  async setLibraryCategory(id: string, category: string): Promise<void> {
    await db.libraries.update(id, { category, updatedAt: Date.now() })
  }

  async deleteLibrary(id: string): Promise<void> {
    const now = Date.now()
    await db.transaction('rw', db.libraries, db.items, async () => {
      // 收集该库及其所有子孙库
      const account = await db.libraries.get(id)
      const all = account
        ? await db.libraries.where('accountId').equals(account.accountId).toArray()
        : []
      const affected = collectDescendants(all, id)

      for (const l of affected) {
        await db.libraries.update(l.id, { deletedAt: now, updatedAt: now })
        // 只级联删除尚未被单独删除的条目，保留已回收条目的原始 deletedAt
        const items = await db.items.where('libraryId').equals(l.id).toArray()
        await Promise.all(
          items
            .filter((it) => it.deletedAt === null)
            .map((it) => db.items.update(it.id, { deletedAt: now, updatedAt: now })),
        )
      }
    })
  }

  async restoreLibrary(id: string): Promise<void> {
    await db.transaction('rw', db.libraries, db.items, async () => {
      const lib = await db.libraries.get(id)
      const libDeletedAt = lib?.deletedAt
      if (!lib) return
      const all = await db.libraries.where('accountId').equals(lib.accountId).toArray()
      // 恢复该库及其子孙库（仅恢复与父库同时被级联删除的子孙）
      const affected = collectDescendants(all, id, libDeletedAt)
      const now = Date.now()
      for (const l of affected) {
        await db.libraries.update(l.id, { deletedAt: null, updatedAt: now })
        const items = await db.items.where('libraryId').equals(l.id).toArray()
        await Promise.all(
          items
            .filter((it) => it.deletedAt === libDeletedAt)
            .map((it) => db.items.update(it.id, { deletedAt: null, updatedAt: now })),
        )
      }
    })
  }

  async purgeLibrary(id: string): Promise<void> {
    await db.transaction('rw', db.libraries, db.fields, db.items, async () => {
      const lib = await db.libraries.get(id)
      const all = lib
        ? await db.libraries.where('accountId').equals(lib.accountId).toArray()
        : []
      const affected = collectDescendants(all, id)
      for (const l of affected) {
        await db.fields.where('libraryId').equals(l.id).delete()
        await db.items.where('libraryId').equals(l.id).delete()
        await db.libraries.delete(l.id)
      }
    })
  }

  async reorderLibraries(_accountId: string, orderedIds: string[]): Promise<void> {
    await db.transaction('rw', db.libraries, async () => {
      const now = Date.now()
      await Promise.all(
        orderedIds.map((id, idx) => db.libraries.update(id, { sortOrder: idx, updatedAt: now })),
      )
    })
  }

  // —————— 字段模板 ——————
  async getTemplate(libraryId: string): Promise<FieldDef[]> {
    const fields = await db.fields
      .where('libraryId')
      .equals(libraryId)
      .and((f) => (f as FieldDef).deletedAt == null)
      .toArray()
    return fields.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  /**
   * 保存字段模板。
   *
   * 原来是「全删再全插」（delete where libraryId + bulkAdd）。这在单设备上没问题，
   * 但同步时删除无处可传：云端旧行还在（上传只 upsert 从不 delete），
   * 另一台设备下次同步会把这个字段当新字段插回来 —— 删掉的列重新长出来。
   *
   * 改为：按 id upsert 在册字段（顺带复活墓碑），并把本次不在册的字段标成墓碑。
   * 墓碑让删除能被同步出去，purgeLibrary 时才真正硬删。
   */
  async saveTemplate(libraryId: string, fields: FieldDef[]): Promise<void> {
    const now = Date.now()
    await db.transaction('rw', db.fields, async () => {
      const existing = await db.fields.where('libraryId').equals(libraryId).toArray()
      const keepIds = new Set(fields.map((f) => f.id))
      for (const f of fields) {
        await db.fields.put({
          ...f,
          libraryId,
          updatedAt: now,
          deletedAt: null,
        })
      }
      for (const old of existing) {
        if (keepIds.has(old.id)) continue
        const cur = await db.fields.get(old.id)
        if (!cur || (cur as FieldDef).deletedAt != null) continue // 已是墓碑，不动它
        await db.fields.update(old.id, { deletedAt: now, updatedAt: now })
      }
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
  async getItem(id: string): Promise<Item | null> {
    const it = await db.items.get(id)
    return it ?? null
  }

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

  /**
   * updateItem 只负责「改字段内容」。
   *
   * 原来写的是 `{ ...item }` —— 整条覆盖，deleted_at 也在里面。而调用方
   * （条目编辑器、表格内联编辑、AI 恢复）传进来的是**打开界面那一刻**的快照：
   *   用户打开条目 X 的编辑器 → 另一标签页/另一台设备把 X 删了 →
   *   用户点保存 → deletedAt: null 被写回去 → X 复活，回收站里也看不到墓碑了
   *
   * 所以这里只写 caller 真正有权改的字段；deletedAt / pinned / sortOrder /
   * createdAt / accountId / libraryId 都各有专用方法，不接受调用方传入。
   */
  async updateItem(item: Item): Promise<void> {
    await db.items.update(item.id, { fields: item.fields, updatedAt: Date.now() })
  }

  async deleteItem(id: string): Promise<void> {
    // deletedAt 和 updatedAt 必须一起刷新。同步的冲突判定比的是 updatedAt，
    // 只写 deletedAt 的话「删除」在时间轴上不可见，会被任何一次并发编辑
    // 整体覆盖掉 —— 用户删掉的条目在回收站里凭空复活。
    await db.items.update(id, { deletedAt: Date.now(), updatedAt: Date.now() })
  }

  async restoreItem(id: string): Promise<void> {
    await db.items.update(id, { deletedAt: null, updatedAt: Date.now() })
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

  /** 回收站自动清理：彻底删除软删时间超过 N 天的库（连同其模板与全部条目）和独立软删的过期条目 */
  async purgeExpiredTrash(accountId: string, olderThanDays: number): Promise<void> {
    const cutoff = Date.now() - olderThanDays * 86400000
    await db.transaction('rw', db.libraries, db.fields, db.items, async () => {
      const deadLibs = await db.libraries
        .where('accountId')
        .equals(accountId)
        .and((l) => l.deletedAt !== null && l.deletedAt < cutoff)
        .toArray()
      for (const l of deadLibs) {
        await db.fields.where('libraryId').equals(l.id).delete()
        await db.items.where('libraryId').equals(l.id).delete()
        await db.libraries.delete(l.id)
      }
      // 独立软删且过期的条目（含上面已删库的残留，一并兜底）
      await db.items
        .where('accountId')
        .equals(accountId)
        .and((i) => i.deletedAt !== null && i.deletedAt < cutoff)
        .delete()
    })
  }

  // —————— 备份 / 恢复 ——————
  async exportAll(accountId: string): Promise<BackupBlob> {
    const [libraries, items] = await Promise.all([
      db.libraries.where('accountId').equals(accountId).toArray(),
      db.items.where('accountId').equals(accountId).toArray(),
    ])
    const libIds = libraries.map((l) => l.id)
    // 备份不含字段墓碑：用户导出的是「我现在的字段」，
    // 墓碑只是同步用的内部状态，对备份没有意义。
    const fields = await db.fields
      .where('libraryId')
      .anyOf(libIds)
      .and((f) => (f as FieldDef).deletedAt == null)
      .toArray()
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
}
