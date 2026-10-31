// 「关于与支持」的本地状态（v3 简化版）。
//
// 历史：v2 曾在这里实现一套 R1–R6 的「延迟/冷却/频次」投放状态机（首见 3 天、2 次会话、
// 30 天冷却、最多 2 次、90 天顺延…），用于「一行式轻提示」。用户已明确改为「注册后直接
// 显示一次」（见 `redesign-brief/05-first-run-support.md` §0 与 TOKENS-v3 §6），
// 那套延迟策略按指示作废，且唯一宿主组件（SupportNudge / 新手任务）已删除。
// 为避免后人误以为还有一套投放逻辑，这里删除 R1–R6 及其测试，只保留：
//   1) 已支持终态 `isSupported / markSupported`（设置页改致谢态，不再显示码）；
//   2) 首次成功导出备份的里程碑记录 `noteBackupExported`（设置页导出成功后调用一行，
//      仅作本地记录，不再触发任何提示）。
//
// 存储沿用原键 `info-mgmt-support-${accountId}`（单键 JSON，整份覆盖写），
// 读取时对 v2 旧结构保持兼容（只取 supported / milestones.backupExported，忽略已废字段），
// 因此升级后「我已经支持过了」这个终态不会丢。所有读写包 try/catch（隐私模式不抛错）。

const PREFIX = 'info-mgmt-support'
/** 登录态本地缓存键（与 authStore 的 SESSION_KEY 一致；remember 存 localStorage，否则 sessionStorage） */
const ACCOUNT_ID_KEY = 'info-mgmt-account-id'

export interface SupportState {
  /** 结构版本，未来迁移时判断 */
  v: 1
  /** 已支持（终态）：永久不再显示二维码，改显示致谢 */
  supported: boolean
  /** 首次成功导出备份的本地记录（只写不读，供将来使用） */
  milestones: {
    backupExported: boolean
  }
}

export function supportKey(accountId: string): string {
  return `${PREFIX}-${accountId}`
}

function emptyState(): SupportState {
  return { v: 1, supported: false, milestones: { backupExported: false } }
}

/** 把不可信 JSON 收敛成当前结构；v2 旧数据里多出来的字段直接忽略（不迁移、不报错）。 */
function coerce(raw: unknown): SupportState | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.v !== 1) return null
  const m = (r.milestones ?? {}) as Record<string, unknown>
  return {
    v: 1,
    supported: r.supported === true,
    milestones: { backupExported: m.backupExported === true },
  }
}

function load(accountId: string): SupportState {
  if (!accountId) return emptyState()
  try {
    const raw = localStorage.getItem(supportKey(accountId))
    if (!raw) return emptyState()
    return coerce(JSON.parse(raw) as unknown) ?? emptyState()
  } catch {
    // localStorage 不可用（隐私模式）或 JSON 损坏：当作没有记录，绝不抛错
    return emptyState()
  }
}

function save(accountId: string, state: SupportState): void {
  if (!accountId) return
  try {
    localStorage.setItem(supportKey(accountId), JSON.stringify(state))
  } catch {
    // 写不进去（隐私模式 / 配额满）时静默降级：不影响功能
  }
}

/** 读「当前登录账号 id」的本地兜底（与 authStore 的 SESSION_KEY 一致）。 */
function currentAccountId(): string {
  try {
    return localStorage.getItem(ACCOUNT_ID_KEY) ?? sessionStorage.getItem(ACCOUNT_ID_KEY) ?? ''
  } catch {
    return ''
  }
}

/** 该账号是否点过「我已经支持过了」（终态：设置页显示致谢、不再显示码）。 */
export function isSupported(accountId: string): boolean {
  return load(accountId).supported
}

/** 「我已经支持过了」：写入终态，永久静默。幂等。 */
export function markSupported(accountId: string): void {
  if (!accountId) return
  const state = load(accountId)
  if (state.supported) return
  save(accountId, { ...state, supported: true })
}

/**
 * 首次成功导出备份后调用（设置页导出成功回调里一行）。
 * 不传 accountId 时从登录态本地缓存读；读不到就静默 no-op（不阻断导出）。
 */
export function noteBackupExported(accountId?: string): void {
  const id = accountId ?? currentAccountId()
  if (!id) return
  const state = load(id)
  if (state.milestones.backupExported) return
  save(id, { ...state, milestones: { backupExported: true } })
}
