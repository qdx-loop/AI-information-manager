import { create } from 'zustand'
import { DEFAULT_SETTINGS, type Settings } from '@/types'

const STORAGE_KEY = 'info-mgmt-settings'

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed, cloud: { ...DEFAULT_SETTINGS.cloud, ...parsed.cloud }, ai: { ...DEFAULT_SETTINGS.ai, ...parsed.ai } }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function persist(s: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

interface AppState {
  settings: Settings
  setStorageMode: (mode: Settings['storageMode']) => void
  setCloud: (c: Partial<Settings['cloud']>) => void
  setAI: (a: Partial<Settings['ai']>) => void
  setTheme: (t: 'light' | 'dark') => void
  reset: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: load(),

  setStorageMode(mode) {
    const next = { ...get().settings, storageMode: mode }
    persist(next)
    set({ settings: next })
  },

  setCloud(c) {
    const next = { ...get().settings, cloud: { ...get().settings.cloud, ...c } }
    persist(next)
    set({ settings: next })
  },

  setAI(a) {
    const next = { ...get().settings, ai: { ...get().settings.ai, ...a } }
    persist(next)
    set({ settings: next })
  },

  setTheme(t) {
    const next = { ...get().settings, theme: t }
    persist(next)
    set({ settings: next })
  },

  reset() {
    persist({ ...DEFAULT_SETTINGS })
    set({ settings: { ...DEFAULT_SETTINGS } })
  },
}))
