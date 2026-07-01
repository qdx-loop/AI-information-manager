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

export const useAuthStore = create<AuthState>((set) => ({
  account: null,
  loading: true,

  async init() {
    const id = readStoredId()
    console.log('[authStore.init] 开始恢复登录态, readStoredId:', id, '存储:', {
      localStorage: localStorage.getItem(SESSION_KEY),
      sessionStorage: sessionStorage.getItem(SESSION_KEY),
    })
    if (!id) {
      console.log('[authStore.init] 无存储的 ID，跳过恢复')
      set({ loading: false })
      return
    }
    try {
      const provider = getProvider()
      const accounts = await provider.listAccounts()
      console.log('[authStore.init] listAccounts 返回:', accounts.length, '个账户, IDs:', accounts.map(a => a.id))
      const acc = accounts.find((a) => a.id === id) ?? null
      if (!acc) {
        console.log('[authStore.init] 未找到匹配账户，清除存储的 ID')
        clearStoredId()
      } else {
        console.log('[authStore.init] 成功恢复账户:', acc.username)
      }
      set({ account: acc, loading: false })
    } catch (e) {
      console.error('[authStore.init] 恢复登录态失败:', e, '存储状态:', {
        localStorage: localStorage.getItem(SESSION_KEY),
        sessionStorage: sessionStorage.getItem(SESSION_KEY),
      })
      set({ loading: false })
    }
  },

  async register(username, password, remember = false) {
    const acc = await getProvider().registerAccount(username, password)
    writeStoredId(acc.id, remember)
    console.log('[authStore.register] 登录态已写入, remember:', remember, 'id:', acc.id, '存储:', { localStorage: localStorage.getItem(SESSION_KEY), sessionStorage: sessionStorage.getItem(SESSION_KEY) })
    set({ account: acc })
  },

  async login(username, password, remember = false) {
    const acc = await getProvider().loginAccount(username, password)
    writeStoredId(acc.id, remember)
    console.log('[authStore.login] 登录态已写入, remember:', remember, 'id:', acc.id, '存储:', { localStorage: localStorage.getItem(SESSION_KEY), sessionStorage: sessionStorage.getItem(SESSION_KEY) })
    set({ account: acc })
  },

  logout() {
    clearStoredId()
    set({ account: null })
  },

  setAccount(a) {
    set({ account: a })
  },
}))
