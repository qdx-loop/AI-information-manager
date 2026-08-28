import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { FieldDef, Item, Library } from "@/types"
import { db } from "./dexie"
import { friendlyDbError } from "@/utils/dbErrors"

export interface CloudConfig {
  url: string
  anonKey: string
}

export interface MergeResult {
  addedLibraries: number
  addedFields: number
  addedItems: number
  updatedItems: number
}

function makeClient(cloud: CloudConfig): SupabaseClient {
  return createClient(cloud.url, cloud.anonKey, {
    auth: { persistSession: false },
  })
}

// ——————————————————————————————
// 上传：本地 → 云端（按 ID 覆盖式 upsert；账户在收费系统里由服务器管理，不再同步）
// ——————————————————————————————

export async function pushLocalToCloud(accountId: string, cloud: CloudConfig): Promise<void> {
  const client = makeClient(cloud)

  const libs = await db.libraries.where("accountId").equals(accountId).toArray()
  if (libs.length) {
    const { error } = await client.from("libraries").upsert(
      libs.map((l) => ({
        id: l.id, account_id: l.accountId, name: l.name,
        category: l.category, sort_order: l.sortOrder, deleted_at: l.deletedAt,
        parent_id: l.parentId ?? null,
      })),
    )
    if (error) throw new Error(friendlyDbError(`上传管理库失败：${error.message}`))
  }

  const libIds = libs.map((l) => l.id)
  if (libIds.length) {
    const fields = await db.fields.where("libraryId").anyOf(libIds).toArray()
    if (fields.length) {
      const { error } = await client.from("fields").upsert(
        fields.map((f) => ({
          id: f.id, library_id: f.libraryId, key: f.key, label: f.label,
          type: f.type, options: f.options, required: f.required,
          visible: f.visible, sort_order: f.sortOrder,
        })),
      )
      if (error) throw new Error(friendlyDbError(`上传字段模板失败：${error.message}`))
    }
  }

  const items = await db.items.where("accountId").equals(accountId).toArray()
  // 分批上传，避免单次请求过大
  for (let i = 0; i < items.length; i += 200) {
    const batch = items.slice(i, i + 200)
    const { error } = await client.from("items").upsert(
      batch.map((it) => ({
        id: it.id, library_id: it.libraryId, account_id: it.accountId,
        fields: it.fields, pinned: it.pinned, sort_order: it.sortOrder,
        created_at: it.createdAt, updated_at: it.updatedAt, deleted_at: it.deletedAt,
      })),
    )
    if (error) throw new Error(friendlyDbError(`上传条目失败：${error.message}`))
  }
}

// ——————————————————————————————
// 合并核心：把一份外部数据（本地原生类型）按规则并入本机 IndexedDB。
//
// 冲突规则（应对"合并前本机也建了数据"的场景）：
// 1. 管理库/字段模板：按 ID 并集——本地没有的直接插入；已存在则保留本地版本，
//    仅当外部数据标记了软删除(deletedAt)时传播删除（墓碑机制，防止删掉的库复活）。
// 2. 条目：本地没有 → 插入；两边都有 → 比较 updatedAt，新的赢；
//    软删除同样按时间比较，保证"最近一次操作"生效。
// 这样换设备/互传时不会丢任何一边的数据；重复合并是幂等的。
//
// Supabase 云同步与「面对面互传」共用此函数，保证两条路径语义完全一致。
// ——————————————————————————————

export interface IncomingData {
  libraries: Library[]
  fields: FieldDef[]
  items: Item[]
}

export async function mergeNativeIntoLocal(accountId: string, incoming: IncomingData): Promise<MergeResult> {
  const result: MergeResult = { addedLibraries: 0, addedFields: 0, addedItems: 0, updatedItems: 0 }

  // —— 管理库：并集 + 墓碑 ——
  const localLibs = await db.libraries.where("accountId").equals(accountId).toArray()
  const localLibMap = new Map(localLibs.map((l) => [l.id, l]))
  for (const inc of incoming.libraries) {
    const local = localLibMap.get(inc.id)
    if (!local) {
      result.addedLibraries++
      await db.libraries.put({ ...inc, accountId })
    } else if (inc.deletedAt != null && local.deletedAt == null) {
      // 外部已删、本地还在 → 传播软删除
      await db.libraries.put({ ...local, deletedAt: inc.deletedAt })
    }
    // 其余情况保留本地（避免覆盖离线期间本地的重命名/分类修改）
  }

  // —— 字段模板：并集（只为属于本账号可见库的缺失字段插入）——
  const libIdSet = new Set<string>(localLibs.map((l) => l.id))
  for (const inc of incoming.libraries) libIdSet.add(inc.id)
  for (const inc of incoming.fields) {
    if (!libIdSet.has(inc.libraryId)) continue // 字段所属库不属于该账号，跳过脏数据
    const exists = await db.fields.get(inc.id)
    if (!exists) {
      result.addedFields++
      await db.fields.put({ ...inc })
    }
  }

  // —— 条目：新者胜 ——
  for (const inc of incoming.items) {
    const local = await db.items.get(inc.id)
    const incomingItem: Item = { ...inc, accountId }
    if (!local) {
      result.addedItems++
      await db.items.put(incomingItem)
    } else if ((inc.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
      result.updatedItems++
      await db.items.put(incomingItem)
    }
    // 本地较新或相等 → 保留本地
  }

  return result
}

// ——————————————————————————————
// 合并式拉取：云端(Supabase) → 本地。先把云端行映射为本地原生类型，再走统一合并核心。
// ——————————————————————————————

export async function mergeCloudToLocal(accountId: string, cloud: CloudConfig): Promise<MergeResult> {
  const client = makeClient(cloud)

  const [libsRes, itemsRes] = await Promise.all([
    client.from("libraries").select("*").eq("account_id", accountId),
    client.from("items").select("*").eq("account_id", accountId),
  ])
  if (libsRes.error) throw new Error(friendlyDbError(`读取云端管理库失败：${libsRes.error.message}`))
  if (itemsRes.error) throw new Error(friendlyDbError(`读取云端条目失败：${itemsRes.error.message}`))

  const cloudLibs = (libsRes.data ?? []) as Array<Record<string, unknown>>

  // 字段只拉取本账号可见库的（云端 ∪ 本地），不再把整张 fields 表
  // （含其他账号的模板）拉进浏览器（红队报告 P2）。
  const localLibs = await db.libraries.where("accountId").equals(accountId).toArray()
  const visibleLibIds = new Set<string>([
    ...cloudLibs.map((r) => String(r.id)),
    ...localLibs.map((l) => l.id),
  ])
  let cloudFieldRows: Array<Record<string, unknown>> = []
  if (visibleLibIds.size > 0) {
    const fieldsRes = await client.from("fields").select("*").in("library_id", [...visibleLibIds])
    if (fieldsRes.error)
      throw new Error(friendlyDbError(`读取云端字段模板失败：${fieldsRes.error.message}`))
    cloudFieldRows = fieldsRes.data ?? []
  }

  // 映射为本地原生类型，交给统一合并核心
  const libraries: Library[] = cloudLibs.map((row) => ({
    id: String(row.id),
    accountId,
    name: String(row.name ?? "未命名"),
    category: String(row.category ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
    deletedAt: (row.deleted_at as number | null) ?? null,
    parentId: (row.parent_id as string | null) ?? null,
  }))

  const fields: FieldDef[] = cloudFieldRows.map((row) => ({
    id: String(row.id),
    libraryId: String(row.library_id),
    key: String(row.key ?? `field_${String(row.id).slice(0, 8)}`),
    label: String(row.label ?? ""),
    type: (row.type as FieldDef["type"]) ?? "text",
    options: Array.isArray(row.options) ? (row.options as string[]) : [],
    required: !!row.required,
    visible: row.visible !== false,
    sortOrder: Number(row.sort_order ?? 0),
  }))

  const items: Item[] = ((itemsRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    libraryId: String(row.library_id),
    accountId,
    fields: (row.fields as Item["fields"]) ?? {},
    pinned: !!row.pinned,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: Number(row.created_at ?? Date.now()),
    updatedAt: Number(row.updated_at ?? row.created_at ?? Date.now()),
    deletedAt: (row.deleted_at as number | null) ?? null,
  }))

  return mergeNativeIntoLocal(accountId, { libraries, fields, items })
}

// ——————————————————————————————
// 双向安全同步：先合并云端到本地（新者胜/墓碑传播），再整体上传。
// 上传的永远是"两边合并后的最新状态"，杜绝旧设备用陈旧副本盲覆盖
// 云端新修改的回滚问题（红队报告 P1/P9）。所有自动与手动同步路径统一走这里。
// ——————————————————————————————
export async function syncBidirectional(accountId: string, cloud: CloudConfig): Promise<MergeResult> {
  const merged = await mergeCloudToLocal(accountId, cloud)
  await pushLocalToCloud(accountId, cloud)
  return merged
}
