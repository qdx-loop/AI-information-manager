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
export async function migrateLocalToCloud(settings: Settings): Promise<void> {
  const client: SupabaseClient = createClient(settings.cloud.url, settings.cloud.anonKey, {
    auth: { persistSession: false },
  })
  const accounts = await db.accounts.toArray()
  for (const acc of accounts) {
    const { data: exist } = await client.from('accounts').select('id').eq('username', acc.username).maybeSingle()
    if (!exist) {
      const { error } = await client.from('accounts').insert({
        id: acc.id, username: acc.username, password_hash: acc.passwordHash,
        salt: acc.salt, created_at: acc.createdAt,
      })
      if (error) throw new Error(error.message)
    }
    const libs = await db.libraries.where('accountId').equals(acc.id).toArray()
    for (const l of libs) {
      const { error } = await client.from('libraries').upsert({
        id: l.id, account_id: l.accountId, name: l.name, category: l.category,
        sort_order: l.sortOrder, deleted_at: l.deletedAt,
      })
      if (error) throw new Error(error.message)
    }
    const libIds = libs.map((l) => l.id)
    if (libIds.length) {
      const fields = await db.fields.where('libraryId').anyOf(libIds).toArray()
      for (const f of fields) {
        const { error } = await client.from('fields').upsert({
          id: f.id, library_id: f.libraryId, key: f.key, label: f.label, type: f.type,
          options: f.options, required: f.required, visible: f.visible, sort_order: f.sortOrder,
        })
        if (error) throw new Error(error.message)
      }
    }
    const items = await db.items.where('accountId').equals(acc.id).toArray()
    for (const it of items) {
      const { error } = await client.from('items').upsert({
        id: it.id, library_id: it.libraryId, account_id: it.accountId, fields: it.fields,
        pinned: it.pinned, sort_order: it.sortOrder, created_at: it.createdAt,
        updated_at: it.updatedAt, deleted_at: it.deletedAt,
      })
      if (error) throw new Error(error.message)
    }
  }
  current = new SupabaseDataProvider(settings.cloud.url, settings.cloud.anonKey)
}

// 从云端切回本地：本地保留原 Dexie 数据
export async function migrateCloudToLocal(): Promise<void> {
  current = new LocalDataProvider()
}
