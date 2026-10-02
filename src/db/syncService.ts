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
/**
 * 分页拉全量行。
 *
 * Supabase / PostgREST 对单次 select 有 1000 行的默认上限，而且不带 ORDER BY 时
 * 返回哪 1000 行是不确定的。原来只有一句 `.select("*").eq("account_id", ...)`，
 * 于是账号条目一超过 1000，第 1001 条之后**永远不会下拉到任何设备**；
 * 其中包含墓碑行，所以另一台设备删掉的条目在另一台上不会消失，看起来「删不掉」。
 * 每次同步的结果都显示成功，用户完全无从察觉。
 *
 * 按主键排序保证分页边界稳定，否则翻页时会漏行/重复行。
 */
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

  // —— 条目：按「是否被删除」分四种情况 ——
  //
  // 原来只有一条 `incoming.updatedAt > local.updatedAt → 整条覆盖`。
  // 而 deleteItem 只写 deletedAt、不刷新 updatedAt，于是：
  //   A 删除条目 X（deletedAt=T，updatedAt 仍是旧的 U）
  //   B 编辑条目 X（updatedAt=T+5）
  //   合并时 T+5 > U → 整条覆盖，连 deletedAt 一起被写成 null
  // 结果是**用户删掉的条目在回收站里凭空复活**，而且没有任何提示。
  // deleteItem / restoreItem 现在都会刷新 updatedAt（见 localProvider），
  // 时间比较才有意义；这里再把删除单独拿出来处理。
  for (const inc of incoming.items) {
    const local = await db.items.get(inc.id)
    const incomingItem: Item = { ...inc, accountId }
    if (!local) {
      result.addedItems++
      await db.items.put(incomingItem)
      continue
    }
    const incAlive = inc.deletedAt == null
    const localAlive = local.deletedAt == null
    const incNewer = (inc.updatedAt ?? 0) > (local.updatedAt ?? 0)

    if (!localAlive && !incAlive) {
      // 两边都是墓碑：取更早的那个删除时间。
      // 说明书承诺「回收站内容 30 天后自动彻底删除」，
      // 保留期必须从**第一次**删除算起，否则两台设备反复同步会把
      // 删除时间往后推，条目实际存活远超 30 天。
      if ((inc.deletedAt ?? 0) < (local.deletedAt ?? 0)) await db.items.put(incomingItem)
    } else if (!localAlive && incAlive) {
      // 本地已删、对方说还活着 → 保留墓碑，不复活。
      // 同步是 last-write-wins，删和改撞在一起时无法区分
      // 「对方是在看到删除之前改的」和「对方真想把它改回来」。
      // 选墓碑优先的两个理由：
      //   1. 用户对「我删掉的东西又冒出来」的容忍度，远低于
      //      「另一台设备的改动还没同步过来」——后者有 3 分钟延迟兜底且可见；
      //   2. 墓碑优先是**收敛**的（两台设备最终都变成已删），
      //      而单纯比时间会来回翻转。
    } else if (localAlive && !incAlive) {
      // 对方删了、本地还在 → 传播删除，但要比时间：
      // restoreItem 会把 deletedAt 置空并刷新 updatedAt，
      // 不比时间的话「A 删除 → B 恢复」会被 B 的恢复反过来盖掉删除。
      if ((inc.updatedAt ?? inc.deletedAt ?? 0) > (local.updatedAt ?? 0)) {
        result.updatedItems++
        await db.items.put(incomingItem)
      }
    } else if (incNewer) {
      // 都活着：新者胜
      result.updatedItems++
      await db.items.put(incomingItem)
    }
    // 其余情况保留本地
  }

  return result
}

// ——————————————————————————————
// 合并式拉取：云端(Supabase) → 本地。先把云端行映射为本地原生类型，再走统一合并核心。
// ——————————————————————————————

const PAGE = 1000

async function fetchAllRows(
  client: SupabaseClient,
  table: string,
  accountId: string,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  let from = 0
  // 上限只是防呆：正常数据量下几十页就到底了
  for (let guard = 0; guard < 1000; guard++) {
    const res = await client
      .from(table)
      .select("*")
      .eq("account_id", accountId)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1)
    if (res.error) {
      throw new Error(friendlyDbError(`读取云端${table === 'items' ? '条目' : '管理库'}失败：${res.error.message}`))
    }
    const rows = (res.data ?? []) as Record<string, unknown>[]
    out.push(...rows)
    if (rows.length < PAGE) return out
    from += PAGE
  }
  return out
}

export async function mergeCloudToLocal(accountId: string, cloud: CloudConfig): Promise<MergeResult> {
  const client = makeClient(cloud)

  const [libs, itemRows] = await Promise.all([
    fetchAllRows(client, "libraries", accountId),
    fetchAllRows(client, "items", accountId),
  ])
  const cloudLibs = libs

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

  const items: Item[] = itemRows.map((row) => ({
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
