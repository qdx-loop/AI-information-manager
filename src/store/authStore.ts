import { create } from 'zustand'
import { apiLogin, apiMe, apiRegister, clearToken, getToken, ApiError } from '@/lib/serverApi'
import { track } from '@/utils/track'

const SESSION_KEY = 'info-mgmt-account-id'
// 账号缓存：断网时也要能显示用户名，否则无网启动会被当成未登录
const ACCOUNT_CACHE_KEY = 'info-mgmt-account-cache'

/**
 * 退出/被踢时需要清空 libraryStore，但 libraryStore 已经 import 了本文件，
 * 反向静态 import 会形成循环依赖。用「注册回调」打破：
 * libraryStore 在模块加载时把清理函数注册进来。
 */
type SessionResetter = () => void
let sessionResetter: SessionResetter | null = null
export function registerSessionResetter(fn: SessionResetter) {
  sessionResetter = fn
}
function runSessionReset() {
  try {
    sessionResetter?.()
  } catch (e) {
    console.error('[auth] 清理登录态失败:', e)
  }
}

function readCachedAccount(): SessionAccount | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_CACHE_KEY)
    return raw ? (JSON.parse(raw) as SessionAccount) : null
  } catch {
    return null
  }
}
function writeCachedAccount(a: SessionAccount | null) {
  try {
    if (a) localStorage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify(a))
    else localStorage.removeItem(ACCOUNT_CACHE_KEY)
  } catch {
    /* 隐私模式写不进去，忽略 */
  }
}

export interface SessionAccount {
  id: string
  username: string
  contact?: string | null
}

// 读取登录态：优先 localStorage（记住），回退 sessionStorage（会话级）
function readStoredId(): string | null {
  return localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY)
}

function writeStoredId(id: string, remember: boolean) {
  clearStoredId()
  if (remember) localStorage.setItem(SESSION_KEY, id)
  else sessionStorage.setItem(SESSION_KEY, id)
}

function clearStoredId() {
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SESSION_KEY)
}

interface AuthState {
  account: SessionAccount | null
  loading: boolean
  // 被强制登出的原因（到期/停用），由界面展示一次后清除
  logoutReason: string | null
  init: () => Promise<void>
  login: (username: string, password: string, remember?: boolean) => Promise<SessionAccount>
  register: (
    input: { username: string; password: string; contact?: string; turnstileToken?: string },
    remember?: boolean,
  ) => Promise<SessionAccount>
  logout: (reason?: string) => void
  clearLogoutReason: () => void
  setAccount: (a: SessionAccount | null) => void
}

let watcherStarted = false

// 账户永不过期（产品已改为永久免费自助注册），这里只需要定期与服务器核对，
// 让「停用」和「管理员重置密码」能在 10 分钟内、甚至切回窗口时立刻生效。
function startWatcher(get: () => AuthState, set: (p: Partial<AuthState>) => void) {
  if (watcherStarted || typeof window === 'undefined') return
  watcherStarted = true

  const kick = (reason: string) => {
    if (!get().account) return
    clearToken()
    clearStoredId()
    writeCachedAccount(null)
    runSessionReset()
    set({ account: null, logoutReason: reason })
  }

  const serverCheck = async () => {
    if (!get().account || !getToken()) return
    try {
      const acc = await apiMe()
      set({ account: acc })
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        kick(e.message)
      }
      // 网络抖动不登出，下次再试
    }
  }

  setInterval(serverCheck, 10 * 60_000)
  window.addEventListener('focus', serverCheck)
}

export const useAuthStore = create<AuthState>((set, get) => ({
  account: null,
  loading: true,
  logoutReason: null,

  async init() {
    startWatcher(get, set)
    const id = readStoredId()
    if (!id || !getToken()) {
      set({ loading: false })
      return
    }
    try {
      const acc = await apiMe()
      writeCachedAccount(acc)
      set({ account: acc, loading: false })
    } catch (e) {
      const denied = e instanceof ApiError && (e.status === 401 || e.status === 403)
      if (denied) {
        // 服务端明确拒绝：真的该登出
        clearStoredId()
        clearToken()
        writeCachedAccount(null)
        runSessionReset()
        set({ loading: false, logoutReason: (e as ApiError).message })
      } else {
        // 网络不可用（本地优先的产品在仓库/门店/地下环境很常见）：
        // 绝不能因为断网就抹掉「记住登录状态」。用缓存的账号信息先进入应用，
        // 本地数据照常可用；联网后 watcher 会再校验一次。
        const cached = readCachedAccount()
        set({
          account: cached,
          loading: false,
          logoutReason: null,
        })
      }
    }
  },

  async login(username, password, remember = false) {
    const acc = await apiLogin(username, password, remember)
    track('login')
    writeStoredId(acc.id, remember)
    writeCachedAccount(acc)
    set({ account: acc, loading: false, logoutReason: null })
    return acc
  },

  async register(input, remember = false) {
    const acc = await apiRegister(input, remember)
    track('login')
    writeStoredId(acc.id, remember)
    writeCachedAccount(acc)
    set({ account: acc, loading: false, logoutReason: null })
    return acc
  },

  logout(reason) {
    clearToken()
    clearStoredId()
    writeCachedAccount(null)
    // 关键：同时清空 libraryStore，否则会残留上一个账号的库/条目
    runSessionReset()
    set({ account: null, logoutReason: reason ?? null })
  },

  clearLogoutReason() {
    set({ logoutReason: null })
  },

  setAccount(a) {
    set({ account: a })
  },
}))
