import type { Library, Item } from '@/types'
import { getProvider } from '@/db/providerFactory'
import { getReminderAt, getReminderRepeat, nextOccurrence, todayLocalISO, isoToLocalTs } from './reminder'

const DAY = 86400000

export interface ReminderEntry {
  item: Item
  libraryId: string
  libraryName: string
  /** 提醒时间戳（毫秒） */
  at: number
}

export interface DateAlert {
  item: Item
  libraryId: string
  libraryName: string
  fieldLabel: string
  /** 日期字段的时间戳（毫秒） */
  at: number
}

export interface InsightData {
  totalLibs: number
  totalItems: number
  itemsThisWeek: number
  /** 未来 daysAhead 天内到期的提醒（含已逾期），按时间升序 */
  reminders: ReminderEntry[]
  /** 未来 daysAhead 天内到期的日期字段（含已逾期），按时间升序 */
  dateAlerts: DateAlert[]
}

// 日期字段值可能是时间戳或 'YYYY-MM-DD' 字符串，统一解析为毫秒时间戳
/**
 * 日期字段值 → 时间戳。
 *
 * 日期字段存的是 'YYYY-MM-DD'，语义是「某个日历日」。
 * 但 Date.parse 按 ES 规范把 date-only 字符串解析成 **UTC 午夜**，
 * 于是在 UTC-5 的设备上 dayjs 渲染出的是前一天 ——
 * 结果同一个字段值，表格里显示 10-05、提醒列表里显示 10-04。
 * 改为按本地午夜解析，与 FieldRenderer 的展示口径一致。
 */
/** 导出仅为测试：日期解析的口径直接影响「表格显示」与「提醒列表显示」是否一致 */
export const parseDateValueForTest = parseDateValue

function parseDateValue(v: unknown): number | null {
  if (typeof v === 'number' && v > 0) return v
  if (typeof v === 'string' && v.trim()) {
    const s = v.trim()
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
    if (m) {
      const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
      return Number.isNaN(dt.getTime()) ? null : dt.getTime()
    }
    const t = Date.parse(s)
    return Number.isNaN(t) ? null : t
  }
  return null
}

// ———— 缓存：dataVersion 不变则不重算，避免每次进首页都全量遍历所有库 ————
interface CacheEntry {
  key: string
  at: number
  data: InsightData
}
let cache: CacheEntry | null = null
const CACHE_TTL_MS = 5 * 60_000 // 兜底 TTL：即使版本未变，超过 5 分钟也重算（跨设备合并等旁路更新）

export function invalidateInsightsCache(): void {
  cache = null
}

/**
 * 汇总「使用回顾 + 智能提醒」所需的本地数据（规则引擎，免费不烧 AI 额度）。
 * 遍历当前账户所有库，加载条目与字段模板，产出统计与到期事项。
 * 结果按 accountId+dataVersion 缓存，写操作会自增版本号使缓存失效。
 */
export async function gatherInsights(
  libraries: Library[],
  opts?: { daysAhead?: number; maxEntries?: number; accountId?: string; dataVersion?: number },
): Promise<InsightData> {
  const key = `${opts?.accountId ?? ''}#${opts?.dataVersion ?? 0}#${libraries.length}`
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data
  }
  const data = await computeInsights(libraries, opts)
  cache = { key, at: Date.now(), data }
  return data
}

async function computeInsights(
  libraries: Library[],
  opts?: { daysAhead?: number; maxEntries?: number },
): Promise<InsightData> {
  const daysAhead = opts?.daysAhead ?? 7
  const maxEntries = opts?.maxEntries ?? 30
  const provider = getProvider()
  const now = Date.now()
  const weekAgo = now - 7 * DAY
  const horizon = now + daysAhead * DAY
  // 提醒日期是日历日（'YYYY-MM-DD'），比较也必须在日历日层面做，
  // 否则时区会让「未来 7 天」的边界差一天。
  const todayISO = todayLocalISO(now)
  const horizonISO = todayLocalISO(horizon)

  let totalItems = 0
  let itemsThisWeek = 0
  const reminders: ReminderEntry[] = []
  const dateAlerts: DateAlert[] = []

  for (const lib of libraries) {
    let items: Item[] = []
    let dateFieldLabels: Array<{ key: string; label: string }> = []
    try {
      const [fields, its] = await Promise.all([provider.getTemplate(lib.id), provider.listItems(lib.id)])
      items = its
      dateFieldLabels = fields.filter((f) => f.type === 'date').map((f) => ({ key: f.key, label: f.label }))
    } catch {
      continue // 单个库读取失败不影响整体概览
    }
    totalItems += items.length
    for (const it of items) {
      if (it.createdAt >= weekAgo) itemsThisWeek++
      const r = getReminderAt(it)
      if (r != null) {
        // 重复提醒（每天/每周/每月）按规则递进到最近一次触发，提醒列表始终可见。
        // 提醒日期是 'YYYY-MM-DD' 日历日，与「日期字段」不同：
        // 日期字段走 parseDateValue → 时间戳（用于和 horizon 比）。
        const occ = nextOccurrence(r, getReminderRepeat(it), todayISO)
        // horizon 只用来限制「7 天内」，这里换算成日历日上限再比
        if (occ <= horizonISO) {
          reminders.push({ item: it, libraryId: lib.id, libraryName: lib.name, at: isoToLocalTs(occ) })
        }
      }
      for (const df of dateFieldLabels) {
        const ts = parseDateValue(it.fields[df.key])
        if (ts != null && ts <= horizon) {
          dateAlerts.push({ item: it, libraryId: lib.id, libraryName: lib.name, fieldLabel: df.label, at: ts })
        }
      }
    }
  }

  reminders.sort((a, b) => a.at - b.at)
  dateAlerts.sort((a, b) => a.at - b.at)

  return {
    totalLibs: libraries.length,
    totalItems,
    itemsThisWeek,
    reminders: reminders.slice(0, maxEntries),
    dateAlerts: dateAlerts.slice(0, maxEntries),
  }
}

/** 条目展示名：取第一个非空文本字段，兜底用「条目」 */
export function itemDisplayName(item: Item): string {
  for (const v of Object.values(item.fields)) {
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number') return String(v)
  }
  return '—'
}
