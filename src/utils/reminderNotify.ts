// 到期提醒的浏览器通知：应用打开期间，当天应触发的提醒弹一次系统通知（按日去重）。
// 纯浏览器 Notification API，无推送服务依赖（关闭网页不会推送——这一定位与「本地优先」架构一致）。
import type { Library, Item } from '@/types'
import { getProvider } from '@/db/providerFactory'
import { getReminderAt, getReminderRepeat, nextOccurrence, todayLocalISO, type ReminderRepeat } from './reminder'
import { isAndroidApp } from './platform'

const DEDUP_PREFIX = 'info-mgmt-notified-'

export function notificationSupported(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  // App 壳内不支持通知（PWA 添加到主屏没有 UA 标记，通知功能完好）
  if (isAndroidApp()) return false
  return true
}

export async function requestNotifyPermission(): Promise<NotificationPermission> {
  if (!notificationSupported()) return 'denied'
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return Notification.permission
  return Notification.requestPermission()
}

/**
 * 去重键。
 *
 * 原来从「触发时刻」取本地年月日。现在触发本身就是一个日历日
 * （'YYYY-MM-DD'），直接用它当键即可 —— 这样两台处在不同时区的设备
 * 算出的是同一个键，不会一台弹过另一台又弹一次。
 */

function alreadyNotifiedToday(accountId: string, itemId: string, occDate: string): boolean {
  try {
    return localStorage.getItem(`${DEDUP_PREFIX}${accountId}-${itemId}`) === occDate
  } catch {
    return false
  }
}

function markNotifiedToday(accountId: string, itemId: string, occDate: string): void {
  try {
    localStorage.setItem(`${DEDUP_PREFIX}${accountId}-${itemId}`, occDate)
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
  /** 本次触发的日历日 'YYYY-MM-DD'，同时用作去重键 */
  occDate: string
  repeat: ReminderRepeat
}

/** 找出今天应触发（含已逾期未处理）的提醒 */
export async function collectDueReminders(libraries: Library[], now = Date.now()): Promise<DueReminder[]> {
  const out: DueReminder[] = []
  // 全部比较都在日历日层面做。用「今天及更早」判定，而不是
  // 「今天 23:59 之前」—— 后者在跨时区场景下会把边界差一天。
  const todayISO = todayLocalISO(now)
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
      const occ = nextOccurrence(r, repeat, todayISO)
      // 触发日 <= 今天 → 应提醒（含逾期未处理的）
      if (occ <= todayISO) {
        out.push({ item: it, libraryId: lib.id, libraryName: lib.name, occDate: occ, repeat })
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
    if (alreadyNotifiedToday(accountId, d.item.id, d.occDate)) continue
    try {
      const n = new Notification('信息管理 · 今日提醒', {
        body: `「${d.libraryName}」${titleOf(d.item)}${d.repeat === 'none' ? '' : '（重复提醒）'}`,
        tag: d.item.id, // 同一条目当天多条不重复弹
      })
      n.onclick = () => {
        window.focus()
        n.close()
      }
      markNotifiedToday(accountId, d.item.id, d.occDate)
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
    // 不要静默吞掉：检查失败 = 用户当天收不到提醒，而界面上完全看不出原因。
    // 和首页概览那处是同一类问题。
    void checkAndNotify(accId, getLibraries()).catch((e: unknown) => {
      console.warn('[reminder] 检查提醒失败:', e)
    })
  }
  const timer = setInterval(run, 30 * 60_000) // 每 30 分钟检查一次
  const kickoff = setTimeout(run, 4000) // 启动 4 秒后先跑一次（等库列表加载）
  // 两个都要清。原来只清了 interval：组件在 4 秒内卸载（快速切换页面、
  // 立刻登出）时，这次 kickoff 仍会带着旧的 getLibraries 闭包执行。
  return () => {
    clearInterval(timer)
    clearTimeout(kickoff)
  }
}
