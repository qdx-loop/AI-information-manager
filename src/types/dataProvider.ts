import type {
  Account,
  Library,
  FieldDef,
  Item,
  TrashEntry,
  BackupBlob,
} from '@/types'

// 存储抽象层接口：Local 与 Supabase 两个实现均遵守此契约
export interface DataProvider {
  // —— 账户 ——
  registerAccount(username: string, password: string): Promise<Account>
  loginAccount(username: string, password: string): Promise<Account>
  // 列表查询：仅返回非敏感字段（id/username/createdAt），passwordHash/salt 为空字符串
  listAccounts(): Promise<Account[]>
  // 按 id 查询单个账户的完整信息（含 passwordHash/salt），用于登录态恢复、云端拉取等场景
  getAccountById(accountId: string): Promise<Account | null>
  updatePassword(accountId: string, newPassword: string): Promise<void>
  deleteAccount(accountId: string): Promise<void>

  // —— 管理库 ——
  listLibraries(accountId: string): Promise<Library[]>
  createLibrary(lib: Library): Promise<Library>
  renameLibrary(id: string, name: string): Promise<void>
  setLibraryCategory(id: string, category: string): Promise<void>
  deleteLibrary(id: string): Promise<void>        // 软删除 → 回收站
  restoreLibrary(id: string): Promise<void>
  purgeLibrary(id: string): Promise<void>          // 永久删除
  reorderLibraries(accountId: string, orderedIds: string[]): Promise<void>

  // —— 字段模板 ——
  getTemplate(libraryId: string): Promise<FieldDef[]>
  saveTemplate(libraryId: string, fields: FieldDef[]): Promise<void>
  cloneTemplate(srcLibraryId: string, dstLibraryId: string): Promise<void>

  // —— 条目 ——
  listItems(libraryId: string): Promise<Item[]>
  createItem(item: Item): Promise<Item>
  updateItem(item: Item): Promise<void>
  deleteItem(id: string): Promise<void>            // 软删除 → 回收站
  restoreItem(id: string): Promise<void>
  purgeItem(id: string): Promise<void>
  pinItem(id: string, pinned: boolean): Promise<void>
  reorderItems(libraryId: string, orderedIds: string[]): Promise<void>

  // —— 回收站 ——
  listTrash(accountId: string): Promise<TrashEntry[]>

  // —— 备份 / 恢复 ——
  exportAll(accountId: string): Promise<BackupBlob>
  importAll(accountId: string, blob: BackupBlob): Promise<void>

  // —— 云端同步（仅 cloud 实现有意义；local 直接 no-op）——
  syncFromCloud(accountId: string): Promise<void>
  syncToCloud(accountId: string): Promise<void>
}
