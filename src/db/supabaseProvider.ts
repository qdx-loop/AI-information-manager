// Supabase 数据提供者：浏览器直连用户自有的 Supabase 项目
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { DataProvider } from '@/types/dataProvider'
import type {
  Account,
  Library,
  FieldDef,
  Item,
  TrashEntry,
  BackupBlob,
} from '@/types'
import { generateSalt, hashPassword, verifyPassword } from '@/utils/crypto'
import { newId } from '@/utils/id'
import { friendlyDbError } from '@/utils/dbErrors'

// DB 行类型（snake_case）
interface AccountRow {
  id: string
  username: string
  password_hash: string
  salt: string
  created_at: number
}
interface LibraryRow {
  id: string
  account_id: string
  name: string
  category: string
  sort_order: number
  deleted_at: number | null
  parent_id?: string | null
}
interface FieldRow {
  id: string
  library_id: string
  key: string
  label: string
  type: string
  options: string[]
  required: boolean
  visible: boolean
  sort_order: number
}
interface ItemRow {
  id: string
  library_id: string
  account_id: string
  fields: Record<string, unknown>
  pinned: boolean
  sort_order: number
  created_at: number
  updated_at: number
  deleted_at: number | null
}

const libFromRow = (r: LibraryRow): Library => ({
  id: r.id,
  accountId: r.account_id,
  name: r.name,
  category: r.category,
  sortOrder: r.sort_order,
  deletedAt: r.deleted_at,
  parentId: r.parent_id ?? null,
})
const libToRow = (l: Library): Omit<LibraryRow, never> => ({
  id: l.id,
  account_id: l.accountId,
  name: l.name,
  category: l.category,
  sort_order: l.sortOrder,
  deleted_at: l.deletedAt,
  parent_id: l.parentId ?? null,
})

const fieldFromRow = (r: FieldRow): FieldDef => ({
  id: r.id,
  libraryId: r.library_id,
  key: r.key,
  label: r.label,
  type: r.type as FieldDef['type'],
  options: r.options ?? [],
  required: !!r.required,
  visible: r.visible !== false,
  sortOrder: r.sort_order,
})
const fieldToRow = (f: FieldDef): FieldRow => ({
  id: f.id,
  library_id: f.libraryId,
  key: f.key,
  label: f.label,
  type: f.type,
  options: f.options,
  required: f.required,
  visible: f.visible,
  sort_order: f.sortOrder,
})

const itemFromRow = (r: ItemRow): Item => ({
  id: r.id,
  libraryId: r.library_id,
  accountId: r.account_id,
  fields: r.fields as Item['fields'],
  pinned: !!r.pinned,
  sortOrder: r.sort_order,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at,
})
const itemToRow = (i: Item): ItemRow => ({
  id: i.id,
  library_id: i.libraryId,
  account_id: i.accountId,
  fields: i.fields,
  pinned: i.pinned,
  sort_order: i.sortOrder,
  created_at: i.createdAt,
  updated_at: i.updatedAt,
  deleted_at: i.deletedAt,
})

export class SupabaseDataProvider implements DataProvider {
  private client: SupabaseClient

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey, { auth: { persistSession: false } })
  }

  // —————— 账户 ——————
  async registerAccount(username: string, password: string): Promise<Account> {
    const { data: existed } = await this.client
      .from('accounts')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    if (existed) throw new Error('用户名已存在')
    const salt = generateSalt()
    const passwordHash = await hashPassword(password, salt)
    const row: AccountRow = {
      id: newId(),
      username,
      password_hash: passwordHash,
      salt,
      created_at: Date.now(),
    }
    const { error } = await this.client.from('accounts').insert(row)
    if (error) throw new Error('注册失败：' + error.message)
    return { id: row.id, username, passwordHash, salt, createdAt: row.created_at }
  }

  async loginAccount(username: string, password: string): Promise<Account> {
    const { data, error } = await this.client
      .from('accounts')
      .select('*')
      .eq('username', username)
      .maybeSingle()
    if (error) throw new Error('查询失败：' + error.message)
    if (!data) throw new Error('账户不存在')
    const row = data as AccountRow
    const ok = await verifyPassword(password, row.salt, row.password_hash)
    if (!ok) throw new Error('密码错误')
    return {
      id: row.id,
      username: row.username,
      passwordHash: row.password_hash,
      salt: row.salt,
      createdAt: row.created_at,
    }
  }

  async listAccounts(): Promise<Account[]> {
    // 安全：仅 select 非敏感字段，passwordHash/salt 不传输到客户端
    const { data, error } = await this.client
      .from('accounts')
      .select('id, username, created_at')
      .order('created_at')
    if (error) throw new Error(error.message)
    return (data as AccountRow[]).map((r) => ({
      id: r.id,
      username: r.username,
      passwordHash: '',
      salt: '',
      createdAt: r.created_at,
    }))
  }

  async getAccountById(accountId: string): Promise<Account | null> {
    const { data, error } = await this.client
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    const r = data as AccountRow
    return {
      id: r.id,
      username: r.username,
      passwordHash: r.password_hash,
      salt: r.salt,
      createdAt: r.created_at,
    }
  }

  async updatePassword(accountId: string, newPassword: string): Promise<void> {
    const salt = generateSalt()
    const passwordHash = await hashPassword(newPassword, salt)
    const { error } = await this.client
      .from('accounts')
      .update({ salt, password_hash: passwordHash })
      .eq('id', accountId)
    if (error) throw new Error(error.message)
  }

  async deleteAccount(accountId: string): Promise<void> {
    // 先删关联数据再删账户
    await this.client.from('items').delete().eq('account_id', accountId)
    const { data: libs } = await this.client
      .from('libraries')
      .select('id')
      .eq('account_id', accountId)
    const libIds = (libs as LibraryRow[] | null)?.map((l) => l.id) ?? []
    if (libIds.length) {
      await this.client.from('fields').delete().in('library_id', libIds)
      await this.client.from('libraries').delete().eq('account_id', accountId)
    }
    await this.client.from('accounts').delete().eq('id', accountId)
  }

  // —————— 管理库 ——————
  async listLibraries(accountId: string): Promise<Library[]> {
    const { data, error } = await this.client
      .from('libraries')
      .select('*')
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .order('sort_order')
    if (error) throw new Error(error.message)
    return (data as LibraryRow[]).map(libFromRow)
  }

  async createLibrary(lib: Library): Promise<Library> {
    const { error } = await this.client.from('libraries').insert(libToRow(lib))
    if (error) throw new Error(error.message)
    return lib
  }

  async renameLibrary(id: string, name: string): Promise<void> {
    const { error } = await this.client.from('libraries').update({ name }).eq('id', id)
    if (error) throw new Error(error.message)
  }

  async setLibraryCategory(id: string, category: string): Promise<void> {
    const { error } = await this.client.from('libraries').update({ category }).eq('id', id)
    if (error) throw new Error(error.message)
  }

  /** 收集某库及其所有子孙库的 id 列表（含根） */
  private async collectDescendantIds(accountId: string, rootId: string): Promise<string[]> {
    const { data } = await this.client
      .from('libraries')
      .select('id, parent_id')
      .eq('account_id', accountId)
    const all = (data ?? []) as Array<{ id: string; parent_id: string | null }>
    const byParent = new Map<string | null, string[]>()
    for (const l of all) byParent.set(l.parent_id ?? null, [...(byParent.get(l.parent_id ?? null) ?? []), l.id])

    const result: string[] = []
    const walk = (pid: string) => {
      for (const cid of byParent.get(pid) ?? []) {
        result.push(cid)
        walk(cid)
      }
    }
    result.push(rootId)
    walk(rootId)
    return result
  }

  async deleteLibrary(id: string): Promise<void> {
    const now = Date.now()
    const lib = await this.client.from('libraries').select('account_id').eq('id', id).maybeSingle()
    const accountId = (lib.data as LibraryRow | null)?.account_id
    const ids = accountId ? await this.collectDescendantIds(accountId, id) : [id]
    // 软删该库及所有子孙库
    const { error: e1 } = await this.client
      .from('libraries')
      .update({ deleted_at: now })
      .in('id', ids)
    if (e1) throw new Error(e1.message)
    // 只级联删除尚未被单独删除的条目
    const { error: e2 } = await this.client
      .from('items')
      .update({ deleted_at: now })
      .in('library_id', ids)
      .is('deleted_at', null)
    if (e2) throw new Error(e2.message)
  }

  async restoreLibrary(id: string): Promise<void> {
    const lib = await this.client.from('libraries').select('account_id, deleted_at').eq('id', id).maybeSingle()
    const row = lib.data as LibraryRow | null
    if (!row) return
    const libDeletedAt = row.deleted_at ?? null
    const ids = await this.collectDescendantIds(row.account_id, id)
    const { error: e1 } = await this.client
      .from('libraries')
      .update({ deleted_at: null })
      .in('id', ids)
    if (e1) throw new Error(e1.message)
    if (libDeletedAt === null) return
    // 只恢复随库一起被级联删除的条目（deletedAt 与库相同）
    const { error: e2 } = await this.client
      .from('items')
      .update({ deleted_at: null })
      .in('library_id', ids)
      .eq('deleted_at', libDeletedAt)
    if (e2) throw new Error(e2.message)
  }

  async purgeLibrary(id: string): Promise<void> {
    const lib = await this.client.from('libraries').select('account_id').eq('id', id).maybeSingle()
    const accountId = (lib.data as LibraryRow | null)?.account_id
    const ids = accountId ? await this.collectDescendantIds(accountId, id) : [id]
    await this.client.from('items').delete().in('library_id', ids)
    await this.client.from('fields').delete().in('library_id', ids)
    await this.client.from('libraries').delete().in('id', ids)
  }

  async reorderLibraries(accountId: string, orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await this.client
        .from('libraries')
        .update({ sort_order: i })
        .eq('id', orderedIds[i])
      if (error) throw new Error(error.message)
    }
    void accountId
  }

  // —————— 字段模板 ——————
  async getTemplate(libraryId: string): Promise<FieldDef[]> {
    const { data, error } = await this.client
      .from('fields')
      .select('*')
      .eq('library_id', libraryId)
      .order('sort_order')
    if (error) throw new Error(error.message)
    return (data as FieldRow[]).map(fieldFromRow)
  }

  async saveTemplate(libraryId: string, fields: FieldDef[]): Promise<void> {
    // 差量保存：先 upsert 目标模板行（幂等），再删除被移除的旧行。
    // 任一步中断都不会出现"模板被清空"的窗口，重试即可收敛（红队报告 P5）。
    const existing = await this.client.from('fields').select('id').eq('library_id', libraryId)
    if (existing.error) throw new Error(friendlyDbError(existing.error.message))
    const existingIds = new Set(((existing.data ?? []) as Array<{ id: string }>).map((r) => r.id))
    const nextIds = new Set(fields.map((f) => f.id))

    if (fields.length) {
      const { error } = await this.client
        .from('fields')
        .upsert(fields.map((f) => fieldToRow({ ...f, libraryId })))
      if (error) throw new Error(friendlyDbError(error.message))
    }
    const stale = [...existingIds].filter((id) => !nextIds.has(id))
    if (stale.length) {
      const { error } = await this.client.from('fields').delete().in('id', stale)
      if (error) throw new Error(friendlyDbError(error.message))
    }
  }

  async cloneTemplate(srcLibraryId: string, dstLibraryId: string): Promise<void> {
    const src = await this.getTemplate(srcLibraryId)
    const cloned = src.map((f, idx) => ({
      ...f,
      id: newId(),
      libraryId: dstLibraryId,
      sortOrder: idx,
    }))
    await this.saveTemplate(dstLibraryId, cloned)
  }

  // —————— 条目 ——————
  async listItems(libraryId: string): Promise<Item[]> {
    const { data, error } = await this.client
      .from('items')
      .select('*')
      .eq('library_id', libraryId)
      .is('deleted_at', null)
      .order('sort_order')
    if (error) throw new Error(error.message)
    const items = (data as ItemRow[]).map(itemFromRow)
    return items.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return a.sortOrder - b.sortOrder
    })
  }

  async createItem(item: Item): Promise<Item> {
    const { error } = await this.client.from('items').insert(itemToRow(item))
    if (error) throw new Error(error.message)
    return item
  }

  async updateItem(item: Item): Promise<void> {
    const { error } = await this.client
      .from('items')
      .update({ ...itemToRow(item), updated_at: Date.now() })
      .eq('id', item.id)
    if (error) throw new Error(error.message)
  }

  async deleteItem(id: string): Promise<void> {
    const { error } = await this.client.from('items').update({ deleted_at: Date.now() }).eq('id', id)
    if (error) throw new Error(error.message)
  }

  async restoreItem(id: string): Promise<void> {
    const { error } = await this.client.from('items').update({ deleted_at: null }).eq('id', id)
    if (error) throw new Error(error.message)
  }

  async purgeItem(id: string): Promise<void> {
    const { error } = await this.client.from('items').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  async pinItem(id: string, pinned: boolean): Promise<void> {
    const { error } = await this.client.from('items').update({ pinned }).eq('id', id)
    if (error) throw new Error(error.message)
  }

  async reorderItems(libraryId: string, orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.client.from('items').update({ sort_order: i }).eq('id', orderedIds[i])
    }
    void libraryId
  }

  // —————— 回收站 ——————
  async listTrash(accountId: string): Promise<TrashEntry[]> {
    const [libsRes, itemsRes] = await Promise.all([
      this.client.from('libraries').select('*').eq('account_id', accountId).not('deleted_at', 'is', null),
      this.client.from('items').select('*').eq('account_id', accountId).not('deleted_at', 'is', null),
    ])
    if (libsRes.error) throw new Error(libsRes.error.message)
    if (itemsRes.error) throw new Error(itemsRes.error.message)
    const libs = (libsRes.data as LibraryRow[]).map(libFromRow)
    const items = (itemsRes.data as ItemRow[]).map(itemFromRow)
    const libMap = new Map(libs.map((l) => [l.id, l.name]))
    const entries: TrashEntry[] = [
      ...libs.map((l) => ({ kind: 'library' as const, record: l, deletedAt: l.deletedAt as number })),
      ...items.map((i) => ({
        kind: 'item' as const,
        record: i,
        libraryName: libMap.get(i.libraryId) ?? '（已删除的库）',
        deletedAt: i.deletedAt as number,
      })),
    ]
    return entries.sort((a, b) => b.deletedAt - a.deletedAt)
  }

  /** 回收站自动清理：彻底删除软删时间超过 N 天的库（连同其模板与全部条目）和独立软删的过期条目 */
  async purgeExpiredTrash(accountId: string, olderThanDays: number): Promise<void> {
    const cutoff = Date.now() - olderThanDays * 86400000
    // 1) 过期软删的库 → 连同其字段与全部条目彻底删除
    const deadLibs = await this.client
      .from('libraries')
      .select('id')
      .eq('account_id', accountId)
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoff)
    if (deadLibs.error) throw new Error(deadLibs.error.message)
    const ids = ((deadLibs.data ?? []) as Array<{ id: string }>).map((r) => r.id)
    if (ids.length) {
      await this.client.from('items').delete().in('library_id', ids)
      await this.client.from('fields').delete().in('library_id', ids)
      await this.client.from('libraries').delete().in('id', ids)
    }
    // 2) 独立软删且过期的条目（父库仍存在）
    await this.client
      .from('items')
      .delete()
      .eq('account_id', accountId)
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoff)
  }

  // —————— 备份 / 恢复 ——————
  async exportAll(accountId: string): Promise<BackupBlob> {
    const [libsRes, itemsRes] = await Promise.all([
      this.client.from('libraries').select('*').eq('account_id', accountId),
      this.client.from('items').select('*').eq('account_id', accountId),
    ])
    if (libsRes.error) throw new Error(libsRes.error.message)
    if (itemsRes.error) throw new Error(itemsRes.error.message)
    const libraries = (libsRes.data as LibraryRow[]).map(libFromRow)
    const items = (itemsRes.data as ItemRow[]).map(itemFromRow)
    const libIds = libraries.map((l) => l.id)
    const { data: fieldsData, error: fe } = await this.client
      .from('fields')
      .select('*')
      .in('library_id', libIds.length ? libIds : ['__none__'])
    if (fe) throw new Error(fe.message)
    const fields = (fieldsData as FieldRow[]).map(fieldFromRow)
    return { version: 1, exportedAt: Date.now(), accountId, libraries, fields, items }
  }

  async importAll(accountId: string, blob: BackupBlob): Promise<void> {
    // 失败前快照：导入中断/失败时尽力回滚，绝不留下"半删除"状态（红队报告 P5）
    const snapshot = await this.exportAll(accountId)
    try {
      await this.rawImportAll(accountId, blob)
    } catch (e) {
      let rolledBack = false
      try {
        await this.rawImportAll(accountId, snapshot)
        rolledBack = true
      } catch {
        /* 回滚失败时在错误信息中明确告知用户 */
      }
      throw new Error(
        `导入失败${rolledBack ? '，已自动恢复到导入前的数据，请重试' : '且回滚未完全成功——请立即「导出备份」核对数据'}：${friendlyDbError(e)}`,
      )
    }
  }

  private async rawImportAll(accountId: string, blob: BackupBlob): Promise<void> {
    // 清空当前账户数据
    await this.client.from('items').delete().eq('account_id', accountId)
    const { data: existLibs } = await this.client
      .from('libraries')
      .select('id')
      .eq('account_id', accountId)
    const existIds = (existLibs as LibraryRow[] | null)?.map((l) => l.id) ?? []
    if (existIds.length) {
      await this.client.from('fields').delete().in('library_id', existIds)
      await this.client.from('libraries').delete().eq('account_id', accountId)
    }
    // 写入备份
    if (blob.libraries.length) {
      await this.client
        .from('libraries')
        .insert(blob.libraries.map((l) => libToRow({ ...l, accountId })))
    }
    if (blob.fields.length) {
      await this.client.from('fields').insert(blob.fields.map(fieldToRow))
    }
   if (blob.items.length) {
     await this.client
       .from('items')
       .insert(blob.items.map((i) => itemToRow({ ...i, accountId })))
   }
 }
}
