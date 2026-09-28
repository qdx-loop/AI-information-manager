// 权限层 API 客户端：与 Cloudflare Pages Functions 通信
// 生产环境同源部署（/api 直接可达）；开发环境由 vite proxy 转发到 wrangler pages dev

export const API_BASE: string = (import.meta.env?.VITE_API_BASE as string) || ''

const USER_TOKEN_KEY = 'info-mgmt-token'

function saveToken(token: string, remember: boolean) {
  clearToken()
  if (remember) localStorage.setItem(USER_TOKEN_KEY, token)
  else sessionStorage.setItem(USER_TOKEN_KEY, token)
}

export function getToken(): string | null {
  return localStorage.getItem(USER_TOKEN_KEY) ?? sessionStorage.getItem(USER_TOKEN_KEY)
}

export function clearToken() {
  localStorage.removeItem(USER_TOKEN_KEY)
  sessionStorage.removeItem(USER_TOKEN_KEY)
}

// 常见错误码双语化：跟随浏览器语言（登录/踢出场景发生在语言切换语境之外）
const CODE_MSG: Record<string, [string, string]> = {
  INVALID_CREDENTIALS: ['用户名或密码错误', 'Incorrect username or password'],
  DISABLED: ['账户已被停用，请联系管理员', 'This account is disabled — contact your administrator'],
  EXPIRED: ['您的账户已到期，请联系管理员续费', 'Your account has expired — contact your administrator to renew'],
  RATE_LIMITED: ['尝试次数过多，请稍后再试', 'Too many attempts — please try again later'],
  NO_TOKEN: ['未登录', 'Not signed in'],
  BAD_TOKEN: ['登录已失效，请重新登录', 'Session expired — please sign in again'],
  NO_ACCOUNT: ['账户不存在', 'Account not found'],
  WRONG_ADMIN: ['管理密码错误', 'Incorrect admin password'],
  WEAK_PASSWORD: ['新密码至少 6 位', 'New password must be at least 6 characters'],
  WRONG_OLD: ['旧密码不正确', 'The old password is incorrect'],
  NETWORK: ['网络连接失败，请检查网络', 'Network error — check your connection'],
}

function prefersEnglish(): boolean {
  try {
    const langs = navigator.languages ?? [navigator.language || 'zh-CN']
    return !langs.some((l) => l.toLowerCase().startsWith('zh'))
  } catch {
    return false
  }
}

export class ApiError extends Error {
  code: string
  status: number
  constructor(message: string, status: number, code = 'ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init: RequestInit = {}, authHeader = false): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authHeader) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  } catch (e) {
    throw new ApiError('网络连接失败，请检查网络', 0, 'NETWORK')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const fallback = `请求失败 (${res.status})`
    const raw: string = data.error || fallback
    const msg = prefersEnglish() ? (data.code ? CODE_MSG[data.code]?.[1] ?? raw : raw) : raw
    throw new ApiError(msg, res.status, data.code)
  }
  return data as T
}

// ———— 账户类型（权限层） ————

export interface ServerAccount {
  id: string
  username: string
  contact?: string | null
  disabled?: boolean
  lastLogin?: number | null
}

// ———— 用户接口 ————

export async function apiLogin(username: string, password: string, remember: boolean): Promise<ServerAccount> {
  const r = await request<{ token: string; account: ServerAccount }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  saveToken(r.token, remember)
  return r.account
}

/** 注册是否开放（管理员可在被灌水时用 REGISTRATION_OPEN=0 紧急关闭） */
export async function apiRegistrationOpen(): Promise<boolean> {
  return (await request<{ open: boolean }>('/api/auth/register', { method: 'GET' })).open
}

/** 自助注册。成功后直接下发令牌，等同于已登录，省掉再登录一次。 */
export async function apiRegister(
  input: { username: string; password: string; contact?: string },
  remember: boolean,
): Promise<ServerAccount> {
  const r = await request<{ token: string; account: ServerAccount }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  saveToken(r.token, remember)
  return r.account
}

export async function apiMe(): Promise<ServerAccount> {
  return (await request<{ account: ServerAccount }>('/api/auth/me', { method: 'GET' }, true)).account
}

// 买家自助修改密码（需验证旧密码；管理员侧无重置能力）
export async function apiChangePassword(oldPassword: string, newPassword: string): Promise<void> {
  await request('/api/auth/password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) }, true)
}

// ———— 局域网同步信令（服务器只中转配对，数据走 WebRTC 直连） ————

export interface P2PSignalRow {
  id: string
  role: 'host' | 'guest'
  offer: string | null
  answer: string | null
  status: 'waiting' | 'done'
}

/** host：发布配对请求（含 WebRTC offer），返回 rowId */
export async function apiSignalHost(deviceId: string, offer: string): Promise<string> {
  const r = await request<{ rowId: string }>(
    '/api/sync/signal',
    { method: 'POST', body: JSON.stringify({ role: 'host', deviceId, offer }) },
    true,
  )
  return r.rowId
}

/** guest：对某条配对请求写入 answer，完成握手 */
export async function apiSignalGuest(deviceId: string, rowId: string, answer: string): Promise<void> {
  await request(
    '/api/sync/signal',
    { method: 'POST', body: JSON.stringify({ role: 'guest', deviceId, rowId, answer }) },
    true,
  )
}

/** 轮询：host 等 answer / guest 等 offer。pending=false 表示暂无 */
export async function apiSignalPoll(deviceId: string): Promise<{ pending: boolean; signal?: P2PSignalRow }> {
  return request(`/api/sync/signal?deviceId=${encodeURIComponent(deviceId)}`, { method: 'GET' }, true)
}

/** 作废本设备的等待中请求（关闭弹窗时调用） */
export async function apiSignalCancel(deviceId: string): Promise<void> {
  await request('/api/sync/signal', { method: 'DELETE', body: JSON.stringify({ deviceId }) }, true)
}

// ———— 管理后台接口 ————

const ADMIN_TOKEN_KEY = 'info-mgmt-admin-token'

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY)
}

async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAdminToken()
  if (!token) throw new ApiError('请先登录管理后台', 401, 'NO_ADMIN')
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error || `请求失败 (${res.status})`, res.status, data.code)
  return data as T
}

export async function adminLogin(password: string): Promise<void> {
  const r = await request<{ token: string }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
  sessionStorage.setItem(ADMIN_TOKEN_KEY, r.token)
}

export interface AdminAccountRow extends ServerAccount {
  createdAt?: number
}

export async function adminListAccounts(): Promise<AdminAccountRow[]> {
  return (await adminRequest<{ accounts: AdminAccountRow[] }>('/api/admin/accounts')).accounts
}

export type AdminOp =
  | { op: 'disable' }
  | { op: 'enable' }
  | { op: 'delete' }
  /** 重置密码；不传 newPassword 时由服务端生成临时密码，仅此一次返回 */
  | { op: 'resetPassword'; newPassword?: string }

export async function adminAccountOp(
  accountId: string,
  payload: AdminOp,
): Promise<{ ok: boolean; password?: string }> {
  return adminRequest('/api/admin/account', { method: 'POST', body: JSON.stringify({ accountId, ...payload }) })
}

// ———— 管理端操作审计 ————

export interface AuditEntry {
  action: string
  target: string
  detail: string
  ip: string
  created_at: number
}

export async function adminListAudit(): Promise<AuditEntry[]> {
  return (await adminRequest<{ logs: AuditEntry[] }>('/api/admin/audit')).logs
}

// ———— 运营概览 ————

export interface OpsStats {
  totalAccounts: number
  disabledAccounts: number
  signups7: number
  signups30: number
  activeUsers7: number
  events7: Array<{ name: string; count: number }>
  /** 近 30 天管理操作分布（admin_audit 按 action 聚合） */
  ops30: Array<{ action: string; count: number }>
}

export async function adminGetStats(): Promise<OpsStats> {
  return adminRequest<OpsStats>('/api/admin/stats')
}
