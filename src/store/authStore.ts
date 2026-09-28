import { create } from 'zustand'
import { apiLogin, apiMe, apiRegister, clearToken, getToken, ApiError } from '@/lib/serverApi'
import { track } from '@/utils/track'

const SESSION_KEY = 'info-mgmt-account-id'

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
    input: { username: string; password: string; contact?: string },
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
      set({ account: acc, loading: false })
    } catch (e) {
      clearStoredId()
      if (!(e instanceof ApiError)) clearToken()
      set({
        loading: false,
        logoutReason:
          e instanceof ApiError && (e.status === 401 || e.status === 403) ? e.message : null,
      })
    }
  },

  async login(username, password, remember = false) {
    const acc = await apiLogin(username, password, remember)
    track('login')
    writeStoredId(acc.id, remember)
    set({ account: acc, loading: false, logoutReason: null })
    return acc
  },

  async register(input, remember = false) {
    const acc = await apiRegister(input, remember)
    track('login')
    writeStoredId(acc.id, remember)
    set({ account: acc, loading: false, logoutReason: null })
    return acc
  },

  logout(reason) {
    clearToken()
    clearStoredId()
    set({ account: null, logoutReason: reason ?? null })
  },

  clearLogoutReason() {
    set({ logoutReason: null })
  },

  setAccount(a) {
    set({ account: a })
  },
}))
