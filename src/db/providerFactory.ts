import type { DataProvider } from '@/types/dataProvider'
import type { Settings } from '@/types'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { LocalDataProvider } from './localProvider'
import { SupabaseDataProvider } from './supabaseProvider'
import { db } from './dexie'

// 单例：当前活动的 provider
let current: DataProvider | null = null

export function getProvider(): DataProvider {
  if (!current) current = new LocalDataProvider()
  return current
}

export function setProvider(p: DataProvider): void {
  current = p
}

export function resetProvider(): void {
  current = null
}

// 根据设置初始化 provider（应用启动时调用）
export function initFromSettings(settings: Settings): DataProvider {
  if (settings.storageMode === 'cloud' && settings.cloud.url && settings.cloud.anonKey) {
    current = new SupabaseDataProvider(settings.cloud.url, settings.cloud.anonKey)
  } else {
    current = new LocalDataProvider()
  }
  return current
}

// 从本地切换到云端：上传当前浏览器全部账户与数据到 Supabase
// 复用 pushLocalToCloud 的上传逻辑，避免重复代码
export async function migrateLocalToCloud(settings: Settings): Promise<void> {
  const accounts = await db.accounts.toArray()
  for (const acc of accounts) {
    try {
      await pushLocalToCloud(acc.id, settings.cloud)
    } catch (e) {
      console.error(`[migrateLocalToCloud] 上传账户 ${acc.username} 数据失败:`, e)
      throw e
    }
  }
  current = new SupabaseDataProvider(settings.cloud.url, settings.cloud.anonKey)
}

// 从云端切回本地：先拉取云端全部数据到本地 Dexie，再切换 provider
export async function migrateCloudToLocal(): Promise<void> {
  if (current) {
    // 安全：listAccounts 只返回 id/username，不拉取密码哈希
    const accounts = await current.listAccounts()
    for (const acc of accounts) {
      try {
        await pullCloudToLocal(acc.id)
      } catch (e) {
        console.error(`[migrateCloudToLocal] 拉取账户 ${acc.username} 数据失败:`, e)
      }
    }
  }
  current = new LocalDataProvider()
}

// 从云端拉取指定账户的数据到本地 Dexie（不切换 provider）
// cloudSettings 可选：若未提供则使用当前 provider（需为 SupabaseDataProvider）
export async function pullCloudToLocal(
  accountId: string,
  cloudSettings?: { url: string; anonKey: string },
): Promise<void> {
  let provider: DataProvider
  if (cloudSettings) {
    provider = new SupabaseDataProvider(cloudSettings.url, cloudSettings.anonKey)
  } else {
    provider = getProvider()
  }

  // 安全：按 id 查询单个账户完整数据（含 hash/salt，写入本地以支持离线登录验证）
  const acc = await provider.getAccountById(accountId)
  if (acc) {
    await db.accounts.put(acc)
  }

  // 通过 exportAll 获取该账户的全部数据
  const blob = await provider.exportAll(accountId)

  // 写入本地 Dexie（put = upsert，按主键覆盖）
  for (const lib of blob.libraries) {
    await db.libraries.put(lib)
  }
  for (const field of blob.fields) {
    await db.fields.put(field)
  }
  for (const item of blob.items) {
    await db.items.put(item)
  }
}

// 从本地推送指定账户的数据到云端（不切换 provider）
export async function pushLocalToCloud(
  accountId: string,
  cloudSettings: { url: string; anonKey: string },
): Promise<void> {
  const client: SupabaseClient = createClient(cloudSettings.url, cloudSettings.anonKey, {
    auth: { persistSession: false },
  })

  // 账户：按 username 查重，不存在则插入
  const localAcc = await db.accounts.get(accountId)
  if (!localAcc) throw new Error('本地账户不存在')
  const { data: existAcc } = await client
    .from('accounts')
    .select('id')
    .eq('username', localAcc.username)
    .maybeSingle()
  if (!existAcc) {
    const { error } = await client.from('accounts').insert({
      id: localAcc.id,
      username: localAcc.username,
      password_hash: localAcc.passwordHash,
      salt: localAcc.salt,
      created_at: localAcc.createdAt,
    })
    if (error) throw new Error(error.message)
  }

  // 管理库
  const libs = await db.libraries.where('accountId').equals(accountId).toArray()
  for (const l of libs) {
    const { error } = await client.from('libraries').upsert({
      id: l.id,
      account_id: l.accountId,
      name: l.name,
      category: l.category,
      sort_order: l.sortOrder,
      deleted_at: l.deletedAt,
    })
    if (error) throw new Error(error.message)
  }

  // 字段
  const libIds = libs.map((l) => l.id)
  if (libIds.length) {
    const fields = await db.fields.where('libraryId').anyOf(libIds).toArray()
    for (const f of fields) {
      const { error } = await client.from('fields').upsert({
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
      if (error) throw new Error(error.message)
    }
  }

  // 条目
  const items = await db.items.where('accountId').equals(accountId).toArray()
  for (const it of items) {
    const { error } = await client.from('items').upsert({
      id: it.id,
      library_id: it.libraryId,
      account_id: it.accountId,
      fields: it.fields,
      pinned: it.pinned,
      sort_order: it.sortOrder,
      created_at: it.createdAt,
      updated_at: it.updatedAt,
      deleted_at: it.deletedAt,
    })
    if (error) throw new Error(error.message)
  }
}
