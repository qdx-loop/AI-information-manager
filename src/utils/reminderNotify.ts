// 到期提醒的浏览器通知：应用打开期间，当天应触发的提醒弹一次系统通知（按日去重）。
// 纯浏览器 Notification API，无推送服务依赖（关闭网页不会推送——这一定位与「本地优先」架构一致）。
import type { Library, Item } from '@/types'
import { getProvider } from '@/db/providerFactory'
import { getReminderAt, getReminderRepeat, nextOccurrence, type ReminderRepeat } from './reminder'

const DEDUP_PREFIX = 'info-mgmt-notified-'

export function notificationSupported(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  // TWA/APK 启动特征：referrer 带 android-app://（PWA 添加到主屏没有此标记，通知功能完好）
  if (typeof document !== 'undefined' && document.referrer.includes('android-app://')) return false
  return true
}

export async function requestNotifyPermission(): Promise<NotificationPermission> {
  if (!notificationSupported()) return 'denied'
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return Notification.permission
  return Notification.requestPermission()
}

function dayKey(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function alreadyNotifiedToday(accountId: string, itemId: string, occAt: number): boolean {
  try {
    return localStorage.getItem(`${DEDUP_PREFIX}${accountId}-${itemId}`) === dayKey(occAt)
  } catch {
    return false
  }
}

function markNotifiedToday(accountId: string, itemId: string, occAt: number): void {
  try {
    localStorage.setItem(`${DEDUP_PREFIX}${accountId}-${itemId}`, dayKey(occAt))
  } catch {
    /* 忽略 */
  }
}

/** 条目主标题：第一个非空文本字段 */
function titleOf(item: Item): string {
  for (const v of Object.values(item.fields)) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return '条目提醒'
}

export interface DueReminder {
  item: Item
  libraryId: string
  libraryName: string
  occAt: number
  repeat: ReminderRepeat
}

/** 找出今天应触发（含已逾期未处理）的提醒 */
export async function collectDueReminders(libraries: Library[], now = Date.now()): Promise<DueReminder[]> {
  const out: DueReminder[] = []
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)
  for (const lib of libraries) {
    let items: Item[] = []
    try {
      items = await getProvider().listItems(lib.id)
    } catch {
      continue
    }
    for (const it of items) {
      const r = getReminderAt(it)
      if (r == null) continue
      const repeat = getReminderRepeat(it)
      const occ = nextOccurrence(r, repeat, now)
      // 当天到期、或（重复提醒的）下次触发在今天内 → 应提醒
      if (occ <= endOfDay.getTime()) {
        out.push({ item: it, libraryId: lib.id, libraryName: lib.name, occAt: occ, repeat })
      }
    }
  }
  return out
}

/** 检查并弹通知；返回本次实际发出的条数（未授权/无到期返回 0） */
export async function checkAndNotify(accountId: string, libraries: Library[], now = Date.now()): Promise<number> {
  if (!notificationSupported() || Notification.permission !== 'granted') return 0
  const due = await collectDueReminders(libraries, now)
  let sent = 0
  for (const d of due) {
    if (alreadyNotifiedToday(accountId, d.item.id, d.occAt)) continue
    try {
      const n = new Notification('信息管理 · 今日提醒', {
        body: `「${d.libraryName}」${titleOf(d.item)}${d.repeat === 'none' ? '' : '（重复提醒）'}`,
        tag: d.item.id, // 同一条目当天多条不重复弹
      })
      n.onclick = () => {
        window.focus()
        n.close()
      }
      markNotifiedToday(accountId, d.item.id, d.occAt)
      sent++
      if (sent >= 5) break // 防止提醒风暴
    } catch {
      /* 部分环境 Notification 构造受限，忽略 */
    }
  }
  return sent
}

/** 早于 7 天的旧提醒：重复提醒的原始触发日已过去很久时，其"下次触发"永远在未来——无需清理 */
export function startReminderWatcher(accountId: () => string, getLibraries: () => Library[]): () => void {
  const run = () => {
    const accId = accountId()
    if (!accId) return
    void checkAndNotify(accId, getLibraries()).catch(() => {})
  }
  const timer = setInterval(run, 30 * 60_000) // 每 30 分钟检查一次
  setTimeout(run, 4000) // 启动 4 秒后先跑一次（等库列表加载）
  return () => clearInterval(timer)
}
