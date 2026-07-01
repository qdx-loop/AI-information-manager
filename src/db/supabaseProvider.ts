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
})
const libToRow = (l: Library): Omit<LibraryRow, never> => ({
  id: l.id,
  account_id: l.accountId,
  name: l.name,
  category: l.category,
  sort_order: l.sortOrder,
  deleted_at: l.deletedAt,
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
    const { data, error } = await this.client.from('accounts').select('*').order('created_at')
    if (error) throw new Error(error.message)
    return (data as AccountRow[]).map((r) => ({
      id: r.id,
      username: r.username,
      passwordHash: r.password_hash,
      salt: r.salt,
      createdAt: r.created_at,
    }))
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

  async deleteLibrary(id: string): Promise<void> {
    const now = Date.now()
    await this.client.from('libraries').update({ deleted_at: now }).eq('id', id)
    await this.client.from('items').update({ deleted_at: now }).eq('library_id', id)
  }

  async restoreLibrary(id: string): Promise<void> {
    await this.client.from('libraries').update({ deleted_at: null }).eq('id', id)
    await this.client.from('items').update({ deleted_at: null }).eq('library_id', id)
  }

  async purgeLibrary(id: string): Promise<void> {
    await this.client.from('items').delete().eq('library_id', id)
    await this.client.from('fields').delete().eq('library_id', id)
    await this.client.from('libraries').delete().eq('id', id)
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
    await this.client.from('fields').delete().eq('library_id', libraryId)
    if (fields.length) {
      const rows = fields.map((f) => fieldToRow({ ...f, libraryId }))
      const { error } = await this.client.from('fields').insert(rows)
      if (error) throw new Error(error.message)
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

  // —————— 云端同步：上传本地数据到云端 ——————
  async syncToCloud(accountId: string): Promise<void> {
    // 此方法在从本地切换到云端时由 factory 层调用，把本地 Dexie 数据上传
    // 实现见 initStorage 中调用
    void accountId
  }

  async syncFromCloud(_accountId: string): Promise<void> {}
}
