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
    throw new ApiError(data.error || `请求失败 (${res.status})`, res.status, data.code)
  }
  return data as T
}

// ———— 账户类型（权限层） ————

export interface ServerAccount {
  id: string
  username: string
  createdAt?: number
  expiresAt?: number
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

export async function apiMe(): Promise<ServerAccount> {
  return (await request<{ account: ServerAccount }>('/api/auth/me', { method: 'GET' }, true)).account
}

export async function apiChangePassword(oldPassword: string, newPassword: string): Promise<void> {
  await request('/api/auth/password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) }, true)
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

// 生成账号：传 { cardType } 选固定卡种，或 { days } 自定义天数（后端限制 1~3650）
export async function adminCreateAccount(
  payload: { cardType?: string; days?: number },
): Promise<{ account: AdminAccountRow; credentials: { username: string; password: string }; days: number }> {
  return adminRequest('/api/admin/accounts', { method: 'POST', body: JSON.stringify(payload) })
}

export type AdminOp =
  | { op: 'renew'; cardType?: string; days?: number }
  | { op: 'disable' }
  | { op: 'enable' }
  | { op: 'resetPassword'; newPassword: string }
  | { op: 'delete' }

export async function adminAccountOp(accountId: string, payload: AdminOp): Promise<{ expiresAt?: number }> {
  return adminRequest('/api/admin/account', { method: 'POST', body: JSON.stringify({ accountId, ...payload }) })
}
