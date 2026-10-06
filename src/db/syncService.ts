import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { TRASH_RETENTION_DAYS } from "@/utils/retentionDays"
import type { FieldDef, Item, Library } from "@/types"
import { db } from "./dexie"
import { friendlyDbError } from "@/utils/dbErrors"

export interface CloudConfig {
  url: string
  anonKey: string
}

export interface MergeResult {
  addedLibraries: number
  updatedLibraries: number
  addedFields: number
  updatedFields: number
  addedItems: number
  updatedItems: number
}

/**
 * 判断一条墓碑是否已经「过了保留期」。
 *
 * 云端 purge 改成保留空壳行（id + deleted_at）之后，这条判定就决定了
 * 一台设备遇到墓碑时该做什么：
 *   - 还在保留期内 → 正常插入本地，于是这条删除在**所有设备**的回收站里
 *     都看得见、可以恢复（和删除前一致）
 *   - 已过保留期   → 说明它早该被彻底清除了，绝不能重新落地本地
 *
 * 判断基准用 deletedAt（第一次删除的时刻），而不是 updatedAt：
 * 保留期承诺的是「删除后 30 天」，与后续有没有人改过它无关。
 */
function isPastRetention(deletedAt: number | null | undefined, now: number): boolean {
  if (deletedAt == null) return false
  return deletedAt + TRASH_RETENTION_DAYS * 86400000 < now
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
        // 必带：合并裁决靠它。不带的话对端拿不到「这个库在什么时候被改过」，
        // 改名/分类/排序就只能靠本地猜，结果是互相覆盖。
        updated_at: l.updatedAt ?? 0,
      })),
    )
    if (error) throw new Error(friendlyDbError(`上传管理库失败：${error.message}`))
  }

  const libIds = libs.map((l) => l.id)
  if (libIds.length) {
    // 注意这里**包含墓碑行**。以前只上传在册字段（或干脆只 upsert 不删），
    // 于是被删掉的字段在云端永远留着旧行，下一台设备同步时它本地不存在
    // → 被当成新字段插入 → 删掉的列在另一台设备上重新长出来。
    const fields = await db.fields.where("libraryId").anyOf(libIds).toArray()
    if (fields.length) {
      const { error } = await client.from("fields").upsert(
        fields.map((f) => ({
          id: f.id, library_id: f.libraryId, key: f.key, label: f.label,
          type: f.type, options: f.options, required: f.required,
          visible: f.visible, sort_order: f.sortOrder,
          updated_at: f.updatedAt ?? 0, deleted_at: f.deletedAt ?? null,
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
  // 整个合并放进一个事务。
  //
  // 原来是逐条 await db.*.put，没有任何事务边界。合并是 read-then-write 的
  // 逐条循环，写到第 N 条失败（QuotaExceededError、DataCloneError、用户直接关窗）
  // 就留下一个「部分应用」的库：前半段是对端的数据，后半段还是本地的，
  // 而用户只看到一个笼统的「对端数据格式不对」，完全不知道自己的库已经被改了一半。
  //
  // 有了事务，中途失败会整体回滚，本地保持合并前的状态 ——
  // 要么全成功，要么什么都没有。
  return db.transaction('rw', db.libraries, db.fields, db.items, async () => {
    const result: MergeResult = {
    addedLibraries: 0, updatedLibraries: 0,
    addedFields: 0, updatedFields: 0,
    addedItems: 0, updatedItems: 0,
  }

  // —— 管理库：墓碑感知 + 新者胜 ——
  //
  // 原来是「并集 + 只传播删除，其余一律保留本地」。保留本地是为了不覆盖离线改名，
  // 但 Library 当时根本没有 updatedAt，改名/分类/排序在时间轴上不可见，
  // 于是这个保护变成了「对端的改名永远输」：
  //   A 改名 → B 同步（丢弃）→ 上传又用 B 的旧名字覆盖云端
  //   → A 下次同步拉回旧名。改名被彻底抹掉，三方一致地错。
  // 现在有了 updatedAt，就按和条目一致的四情况规则裁决。
  const localLibs = await db.libraries.where("accountId").equals(accountId).toArray()
  const localLibMap = new Map(localLibs.map((l) => [l.id, l]))
  for (const inc of incoming.libraries) {
    const local = localLibMap.get(inc.id)
    const incomingLib: Library = { ...inc, accountId }
    if (!local) {
      // 本地没有 + 对端是已过保留期的墓碑 → 不插入。
      // 云端 purge 现在保留空壳行，所以墓碑会一直存在；无条件插入的话，
      // 「本机已彻底删除」和「本机从没见过」成了同一件事，
      // 另一台设备一推，删掉的数据就整条回来了。
      // 保留期内的墓碑仍然插入（见 isPastRetention 的说明）。
      if (inc.deletedAt != null && isPastRetention(inc.deletedAt, Date.now())) continue
      result.addedLibraries++
      await db.libraries.put(incomingLib)
      continue
    }
    const incAlive = inc.deletedAt == null
    const localAlive = local.deletedAt == null
    const incNewer = (inc.updatedAt ?? 0) > (local.updatedAt ?? 0)

    if (!localAlive && !incAlive) {
      // 两边都是墓碑：取更早的删除时间，保证 30 天保留期从第一次删除算起
      if ((inc.deletedAt ?? 0) < (local.deletedAt ?? 0)) await db.libraries.put(incomingLib)
    } else if (!localAlive && incAlive) {
      // 本地已删、对方说还活着 → 保留墓碑（理由同条目，见下）
    } else if (localAlive && !incAlive) {
      if ((inc.updatedAt ?? inc.deletedAt ?? 0) > (local.updatedAt ?? 0)) {
        await db.libraries.put(incomingLib)
      }
    } else if (incNewer) {
      // 都活着：新者胜 —— 这一条让改名/分类/排序终于能跨设备生效
      result.updatedLibraries++
      await db.libraries.put(incomingLib)
    }
  }

  // —— 字段模板：墓碑感知 + 新者胜 ——
  //
  // 原来只做并集插入，所以：改 label/type/options 对端永远看不到；
  // 删掉字段则会在对端「重新长出来」（上传只 upsert，云端旧行还在，
  // 对端同步时它不存在于本地 → 被当新字段插入）。
  const libIdSet = new Set<string>(localLibs.map((l) => l.id))
  for (const inc of incoming.libraries) libIdSet.add(inc.id)
  for (const inc of incoming.fields) {
    if (!libIdSet.has(inc.libraryId)) continue // 字段所属库不属于该账号，跳过脏数据
    const local = await db.fields.get(inc.id)
    if (!local) {
      // 同上：已过保留期的墓碑不重新落地；保留期内的照常插入，
      // 这样「在别的设备删掉的东西」仍然会出现在本机回收站里，可以恢复
      if (inc.deletedAt != null && isPastRetention(inc.deletedAt, Date.now())) continue
      result.addedFields++
      await db.fields.put({ ...inc })
      continue
    }
    const incAlive = inc.deletedAt == null
    const localAlive = local.deletedAt == null
    const incNewer = (inc.updatedAt ?? 0) > (local.updatedAt ?? 0)

    if (!localAlive && !incAlive) {
      if ((inc.deletedAt ?? 0) < (local.deletedAt ?? 0)) await db.fields.put({ ...inc })
    } else if (!localAlive && incAlive) {
      // 本地已删、对方说还在 → 保留墓碑，不复活
    } else if (localAlive && !incAlive) {
      if ((inc.updatedAt ?? inc.deletedAt ?? 0) > (local.updatedAt ?? 0)) {
        result.updatedFields++
        await db.fields.put({ ...inc })
      }
    } else if (incNewer) {
      result.updatedFields++
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
      // 同 libraries：已过保留期的墓碑不重新落地；保留期内的照常插入
      if (inc.deletedAt != null && isPastRetention(inc.deletedAt, Date.now())) continue
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
  })
}

// ——————————————————————————————
// 合并式拉取：云端(Supabase) → 本地。先把云端行映射为本地原生类型，再走统一合并核心。
// ——————————————————————————————

const PAGE = 1000

/**
 * 把云端行里的数值安全地转成 number。
 *
 * 原来的 `Number(row.updated_at)` 有个很难查的坑：PostgREST 对 **timestamptz**
 * 列返回的是 ISO 字符串（"2026-10-02T09:15:00+00:00"），Number() 得到 NaN。
 * 而 `NaN > 任何数字` 恒为 false —— 该条目的云端更新**永远不会下拉**；
 * 更糟的是首次插入分支会把 NaN 写进 IndexedDB，从此该记录在本设备永久冻结，
 * 还会把 NaN 推回云端污染所有设备。
 *
 * 用户自己建表时把时间列建成 timestamptz 是 Postgres 里的默认直觉选法，
 * 所以这里必须兜住。无法解析时回落到 row.created_at，再回落到 now。
 */
function num(row: Record<string, unknown>, key: string, fallback = 0): number {
  const v = row[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    // 纯数字串
    const n = Number(v)
    if (Number.isFinite(n)) return n
    // ISO 时间串 → 取毫秒
    const t = Date.parse(v)
    if (Number.isFinite(t)) return t
  }
  if (v instanceof Date) return v.getTime()
  return fallback
}

/** 可空数值（deleted_at 允许 null） */
function nullableNum(row: Record<string, unknown>, key: string): number | null {
  const v = row[key]
  if (v === null || v === undefined) return null
  return num(row, key, 0)
}

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
  const cloudFieldRows: Array<Record<string, unknown>> = []
  if (visibleLibIds.size > 0) {
    // 分页：fields 同样有 1000 行上限，而且一个库的模板列数通常远不到，
    // 但多库累积起来会超。带墓碑行也要拉，否则删除传播不出去。
    const ids = [...visibleLibIds]
    for (let from = 0; ; from += PAGE) {
      const res = await client
        .from("fields")
        .select("*")
        .in("library_id", ids)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1)
      if (res.error)
        throw new Error(friendlyDbError(`读取云端字段模板失败：${res.error.message}`))
      const rows = (res.data ?? []) as Array<Record<string, unknown>>
      cloudFieldRows.push(...rows)
      if (rows.length < PAGE) break
    }
  }

  // 映射为本地原生类型，交给统一合并核心
  const libraries: Library[] = cloudLibs.map((row) => ({
    id: String(row.id),
    accountId,
    name: String(row.name ?? "未命名"),
    category: String(row.category ?? ""),
    sortOrder: num(row, "sort_order", 0),
    deletedAt: nullableNum(row, "deleted_at"),
    parentId: (row.parent_id as string | null) ?? null,
    updatedAt: num(row, "updated_at", 0),
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
    sortOrder: num(row, "sort_order", 0),
    updatedAt: num(row, "updated_at", 0),
    deletedAt: nullableNum(row, "deleted_at"),
  }))

  const items: Item[] = itemRows.map((row) => ({
    id: String(row.id),
    libraryId: String(row.library_id),
    accountId,
    fields: (row.fields as Item["fields"]) ?? {},
    pinned: !!row.pinned,
    sortOrder: num(row, "sort_order", 0),
    createdAt: num(row, "created_at", Date.now()),
    updatedAt: num(row, "updated_at", num(row, "created_at", Date.now())),
    deletedAt: nullableNum(row, "deleted_at"),
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
