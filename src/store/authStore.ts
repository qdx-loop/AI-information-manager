import { create } from 'zustand'
import type { Account } from '@/types'
import { getProvider } from '@/db/providerFactory'

const SESSION_KEY = 'info-mgmt-account-id'

// 读取登录态：优先 localStorage（记住），回退 sessionStorage（会话级）
function readStoredId(): string | null {
  return localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY)
}

// 写入登录态：remember=true 用 localStorage（关闭浏览器仍保持），否则 sessionStorage
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
  account: Account | null
  loading: boolean
  init: () => Promise<void>
  register: (username: string, password: string, remember?: boolean) => Promise<void>
  login: (username: string, password: string, remember?: boolean) => Promise<void>
  logout: () => void
  setAccount: (a: Account | null) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  account: null,
  loading: true,

  async init() {
    const id = readStoredId()
    if (!id) {
      set({ loading: false })
      return
    }
    try {
      const provider = getProvider()
      // 安全：按 id 查询单个账户，避免拉取所有账户的密码哈希
      const acc = await provider.getAccountById(id)
      // 若登录/注册已在 init 完成前设置了 account，则不覆盖
      if (get().account) {
        set({ loading: false })
        return
      }
      if (!acc) {
        clearStoredId()
      }
      set({ account: acc, loading: false })
    } catch {
      clearStoredId()
      set({ loading: false })
    }
  },

  async register(username, password, remember = false) {
    const acc = await getProvider().registerAccount(username, password)
    writeStoredId(acc.id, remember)
    set({ account: acc, loading: false })
  },

  async login(username, password, remember = false) {
    const acc = await getProvider().loginAccount(username, password)
    writeStoredId(acc.id, remember)
    set({ account: acc, loading: false })
  },

  logout() {
    clearStoredId()
    set({ account: null })
  },

  setAccount(a) {
    set({ account: a })
  },
}))
