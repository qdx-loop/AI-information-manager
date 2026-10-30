// 赞赏入口「投放状态机」——纯本地判定，无网络、无埋点。
//
// 规则编号与 brief `redesign-brief/02-donation-research.md` §C.2 严格对齐：
//   R1  首次进入应用 ≥ 3 天才可能出现
//   R2  ≥ 2 次会话（间隔 > 30 分钟记一次新会话）
//   R3  里程碑：M1 新手清单 4/4 完成，或 M2 首次成功导出备份（先到者）
//   R4  距上次主动提示 ≥ 30 天
//   R5  主动提示累计 ≤ 2 次，用尽即永久静默（muted）
//   R6  「稍后」顺延 90 天，且只允许顺延 1 次；第二次即视为用尽 → muted
//   R7  「不再提示」永久静默（muted，直到用户清除浏览器数据）
//   R8  已支持（supported）永久静默
//   R9  一天内最多出现 1 次；「空闲回调之后才渲染」由宿主组件负责（这里只管计数/日界）
//   R10 按 accountId 分 key，换账号互不影响
//
// 存储：localStorage 单键 `info-mgmt-support-${accountId}`，整份 JSON 覆盖写；
// 所有读写都包 try/catch（隐私模式 / 存储被禁用时会抛错，范式同 `utils/onboarding.ts`）。
// 所有函数接受可选 `now`（默认 Date.now()），方便单测注入时间、不依赖真实时钟。

const PREFIX = 'info-mgmt-support'
/** 登录态本地缓存键（与 authStore 的 SESSION_KEY 一致；remember 存 localStorage，否则 sessionStorage） */
const ACCOUNT_ID_KEY = 'info-mgmt-account-id'

/** R1：首次进入应用后的最小天数 */
export const MIN_ACCOUNT_AGE_DAYS = 3
/** R2：至少几次会话 */
export const MIN_SESSIONS = 2
/** R2：会话间隔阈值（> 30 分钟算新会话） */
export const SESSION_GAP_MS = 30 * 60 * 1000
/** R4：两次主动提示的最小间隔 */
export const SHOW_COOLDOWN_DAYS = 30
/** R5：全生命周期最多主动提示几次 */
export const MAX_NUDGES = 2
/** R6：「稍后」顺延多少天 */
export const SNOOZE_DAYS = 90

const DAY = 86_400_000

export type SupportMilestone = 'onboardingDone' | 'backupExported'

export interface SupportMilestones {
  /** M1：新手清单 4/4 完成 */
  onboardingDone: boolean
  /** M2：首次成功导出备份 */
  backupExported: boolean
}

export interface SupportState {
  /** 结构版本，未来迁移时判断 */
  v: 1
  /** R1 的基准：首次进入应用的时间（SessionAccount 没有 createdAt，只能本地记） */
  firstSeenAt: number
  /** R2：会话次数 */
  sessions: number
  lastSessionAt: number
  /** R3：里程碑 */
  milestones: SupportMilestones
  /** R5：主动提示已出现次数 */
  shownCount: number
  /** R4 / R9：最近一次出现时间 */
  lastShownAt: number | null
  /** R6：顺延到什么时候 */
  snoozedUntil: number | null
  /** R7 / R8 / R5 用尽：永久静默 */
  muted: boolean
  /** R8：已支持（终态，设置页改致谢态） */
  supported: boolean
  /** R6：是否已经用过那唯一一次「稍后」 */
  snoozeUsed: boolean
}

function emptyState(): SupportState {
  return {
    v: 1,
    firstSeenAt: 0,
    sessions: 0,
    lastSessionAt: 0,
    milestones: { onboardingDone: false, backupExported: false },
    shownCount: 0,
    lastShownAt: null,
    snoozedUntil: null,
    muted: false,
    supported: false,
    snoozeUsed: false,
  }
}

export function supportKey(accountId: string): string {
  return `${PREFIX}-${accountId}`
}

function finiteOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function nullableTs(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** 把不可信的 localStorage JSON 收敛成完整结构；版本/必填项不对就当没有记录。 */
function coerce(raw: unknown): SupportState | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.v !== 1) return null
  const firstSeenAt = finiteOr(r.firstSeenAt, 0)
  if (firstSeenAt <= 0) return null
  const ms = (r.milestones ?? {}) as Record<string, unknown>
  return {
    v: 1,
    firstSeenAt,
    sessions: Math.max(0, Math.floor(finiteOr(r.sessions, 0))),
    lastSessionAt: finiteOr(r.lastSessionAt, firstSeenAt),
    milestones: {
      onboardingDone: ms.onboardingDone === true,
      backupExported: ms.backupExported === true,
    },
    shownCount: Math.max(0, Math.floor(finiteOr(r.shownCount, 0))),
    lastShownAt: nullableTs(r.lastShownAt),
    snoozedUntil: nullableTs(r.snoozedUntil),
    muted: r.muted === true,
    supported: r.supported === true,
    snoozeUsed: r.snoozeUsed === true,
  }
}

function readRaw(accountId: string): unknown {
  try {
    const raw = localStorage.getItem(supportKey(accountId))
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    // localStorage 不可用（隐私模式）或 JSON 坏了：当作「没有记录」，绝不抛错
    return null
  }
}

/** 读取当前账号状态；没有记录 / 记录损坏时返回空白结构（firstSeenAt=0，不满足 R1）。 */
export function loadSupportState(accountId: string): SupportState {
  const parsed = coerce(readRaw(accountId))
  return parsed ?? emptyState()
}

function save(accountId: string, state: SupportState): void {
  try {
    localStorage.setItem(supportKey(accountId), JSON.stringify(state))
  } catch {
    // 写不进去（隐私模式 / 配额满）时静默降级：本次会话内不展示提示，不影响功能
  }
}

/** 首次进入应用时记一笔（幂等）。R1 / R2 的起点。 */
export function ensureSeen(accountId: string, now: number = Date.now()): SupportState {
  const state = loadSupportState(accountId)
  if (state.firstSeenAt > 0) return state
  const next: SupportState = {
    ...emptyState(),
    firstSeenAt: now,
    sessions: 1,
    lastSessionAt: now,
  }
  save(accountId, next)
  return next
}

/**
 * 记一次「进入应用」。规则：距上次 > 30 分钟才算新会话。
 * 每次调用都会刷新 lastSessionAt（连续活跃不会被反复计成新会话），
 * 只有真的隔了 > 30 分钟才 sessions++。
 */
export function noteSession(accountId: string, now: number = Date.now()): SupportState {
  const state = ensureSeen(accountId, now)
  const gap = now - state.lastSessionAt
  const isNewSession = gap > SESSION_GAP_MS
  const next: SupportState = {
    ...state,
    sessions: isNewSession ? state.sessions + 1 : Math.max(1, state.sessions),
    lastSessionAt: Math.max(now, state.lastSessionAt),
  }
  save(accountId, next)
  return next
}

/** R3：里程碑达成（幂等）。M1 = onboardingDone，M2 = backupExported。 */
export function markMilestone(
  accountId: string,
  milestone: SupportMilestone,
  now: number = Date.now(),
): SupportState {
  const state = ensureSeen(accountId, now)
  if (state.milestones[milestone]) return state
  const next: SupportState = {
    ...state,
    milestones: { ...state.milestones, [milestone]: true },
  }
  save(accountId, next)
  return next
}

/**
 * 读「当前登录账号 id」的本地兜底（与 authStore 的 SESSION_KEY 一致：
 * 勾选"记住登录"时在 localStorage，否则在 sessionStorage）。
 * 集成方（设置页导出成功回调 / SupportNudge 挂载）不想依赖 store 时可用它。
 */
export function currentAccountId(): string {
  try {
    return localStorage.getItem(ACCOUNT_ID_KEY) ?? sessionStorage.getItem(ACCOUNT_ID_KEY) ?? ''
  } catch {
    // 隐私模式：两个 Storage 都可能不可用
    return ''
  }
}

/**
 * R3 的 M2：设置页「首次成功导出备份」后调用（导出成功回调里一行）。
 * 不传 accountId 时从登录态本地缓存读；读不到就静默 no-op（不阻断导出）。
 */
export function noteBackupExported(accountId?: string): void {
  const id = accountId ?? currentAccountId()
  if (!id) return
  markMilestone(id, 'backupExported')
}

/** 本地日历日（用于 R9「一天最多 1 次」；不用 UTC 日界，避免时区错位） */
function sameLocalDay(a: number, b: number): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

export type NudgeBlockReason =
  | 'supported' // R8 已支持
  | 'muted' // R7 / R5 用尽
  | 'limit' // R5 已达 2 次
  | 'too-early' // R1 账号太新
  | 'sessions' // R2 会话数不够
  | 'milestone' // R3 还没有里程碑
  | 'same-day' // R9 今天已经出现过
  | 'cooldown' // R4 距上次不足 30 天
  | 'snoozed' // R6 还在 90 天顺延中
  | null // 可以出现

/**
 * 判定「现在能不能主动提示」，并给出不能的原因（原因只用于单测与调试，不进 UI）。
 * 判定顺序与 §C.2 / §G.2 一致；任何一条不满足即 false。
 */
export function evaluateNudge(
  accountId: string,
  now: number = Date.now(),
): { ok: boolean; reason: NudgeBlockReason; state: SupportState } {
  const state = loadSupportState(accountId)
  const blocked = (reason: Exclude<NudgeBlockReason, null>) => ({ ok: false, reason, state })

  if (state.supported) return blocked('supported') // R8
  if (state.muted) return blocked('muted') // R7
  if (state.shownCount >= MAX_NUDGES) return blocked('limit') // R5
  if (state.firstSeenAt <= 0 || now - state.firstSeenAt < MIN_ACCOUNT_AGE_DAYS * DAY) {
    return blocked('too-early') // R1
  }
  if (state.sessions < MIN_SESSIONS) return blocked('sessions') // R2
  if (!state.milestones.onboardingDone && !state.milestones.backupExported) {
    return blocked('milestone') // R3
  }
  if (state.lastShownAt != null) {
    if (sameLocalDay(state.lastShownAt, now)) return blocked('same-day') // R9
    if (now - state.lastShownAt < SHOW_COOLDOWN_DAYS * DAY) return blocked('cooldown') // R4
  }
  if (state.snoozedUntil != null && now < state.snoozedUntil) return blocked('snoozed') // R6
  return { ok: true, reason: null, state }
}

/** R1–R9 全通过才为 true。 */
export function canShowNudge(accountId: string, now: number = Date.now()): boolean {
  return evaluateNudge(accountId, now).ok
}

/**
 * 记一次「主动提示已出现」。
 * - R9：同一本地日历日内最多记 1 次（组件挂载后再点链接调用一次也不会重复计数）
 * - R5：记满 MAX_NUDGES 次即 muted，之后永不再提示
 * @returns 本次是否真的计入了（同一天重复调用返回 false）
 */
export function markNudgeShown(accountId: string, now: number = Date.now()): boolean {
  const state = loadSupportState(accountId)
  if (state.firstSeenAt <= 0) return false
  if (state.lastShownAt != null && sameLocalDay(state.lastShownAt, now)) return false
  const shownCount = state.shownCount + 1
  const next: SupportState = {
    ...state,
    shownCount,
    lastShownAt: now,
    muted: state.muted || shownCount >= MAX_NUDGES,
  }
  save(accountId, next)
  return true
}

/**
 * R6：「以后再说」。只允许一次：顺延 90 天。
 * 第二次调用视为把机会用完 → muted（§C.2：「第二次被拒即视为 R5 用尽」）。
 */
export function snoozeNudge(accountId: string, now: number = Date.now()): SupportState {
  const state = loadSupportState(accountId)
  if (state.firstSeenAt <= 0) return state
  const next: SupportState = state.snoozeUsed
    ? { ...state, muted: true }
    : { ...state, snoozeUsed: true, snoozedUntil: now + SNOOZE_DAYS * DAY }
  save(accountId, next)
  return next
}

/** R7：「不再提示」= 永久静默（设置页常驻入口不受影响，仍可主动进入）。 */
export function muteNudge(accountId: string, _now: number = Date.now()): SupportState {
  const state = loadSupportState(accountId)
  if (state.firstSeenAt <= 0) return state
  const next: SupportState = { ...state, muted: true }
  save(accountId, next)
  return next
}

/** R8：「我已经支持过了」= 终态，永久静默 + 设置页切致谢态。 */
export function markSupported(accountId: string, now: number = Date.now()): SupportState {
  const state = ensureSeen(accountId, now)
  const next: SupportState = { ...state, supported: true, muted: true }
  save(accountId, next)
  return next
}

export function isSupported(accountId: string): boolean {
  return loadSupportState(accountId).supported
}

/**
 * 测试用：清掉本账号（或全部账号）的投放状态。
 * 生产代码不要调用——用户想重置只能自己清除浏览器数据（§H.3 的既定行为）。
 */
export function resetForTests(accountId?: string): void {
  try {
    if (accountId) {
      localStorage.removeItem(supportKey(accountId))
      return
    }
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(`${PREFIX}-`)) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* 忽略 */
  }
}
