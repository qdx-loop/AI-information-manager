import { create } from 'zustand'
import type { Library, FieldDef, Item, TrashEntry } from '@/types'
import { getProvider } from '@/db/providerFactory'
import { useAuthStore } from './authStore'
import { newId } from '@/utils/id'
import { track } from '@/utils/track'
import { scheduleAutoSync } from '@/utils/autoSync'
import { markObStep } from '@/utils/onboarding'

// 统一的写操作收尾：bump 派生数据版本号（首页概览缓存失效键）+ 防抖云同步
function touchData() {
  useLibraryStore.setState((s) => ({ dataVersion: s.dataVersion + 1 }))
  scheduleAutoSync()
}

interface LibraryState {
  libraries: Library[]
  currentLibraryId: string | null
  fields: FieldDef[]
  items: Item[]
  trash: TrashEntry[]
  focusItemId: string | null
  loading: boolean
  /** 每次任一数据写操作后自增；首页概览等派生计算用它做缓存失效键 */
  dataVersion: number

  loadLibraries: () => Promise<void>
  selectLibrary: (id: string | null) => Promise<void>
  refreshCurrent: () => Promise<void>

  createLibrary: (name: string, category?: string, parentId?: string | null) => Promise<string>
  renameLibrary: (id: string, name: string) => Promise<void>
  setLibraryCategory: (id: string, category: string) => Promise<void>
  deleteLibrary: (id: string) => Promise<void>
  restoreLibrary: (id: string) => Promise<void>
  purgeLibrary: (id: string) => Promise<void>
  reorderLibraries: (orderedIds: string[]) => Promise<void>

  saveTemplate: (libraryId: string, fields: FieldDef[]) => Promise<void>
  cloneTemplate: (srcId: string, dstId: string) => Promise<void>

  createItem: (fields: Record<string, unknown>) => Promise<Item>
  updateItem: (item: Item) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  restoreItem: (id: string) => Promise<void>
  purgeItem: (id: string) => Promise<void>
  pinItem: (id: string, pinned: boolean) => Promise<void>
  reorderItems: (orderedIds: string[]) => Promise<void>

  loadTrash: () => Promise<void>
  focusItem: (id: string | null) => void
  /** 旁路数据变更（云同步/P2P 合并/备份导入）后手动失效派生缓存（首页智能提醒等） */
  bumpDataVersion: () => void
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  libraries: [],
  dataVersion: 0,
  currentLibraryId: null,
  fields: [],
  items: [],
  trash: [],
  focusItemId: null,
  loading: false,

  async loadLibraries() {
    const acc = useAuthStore.getState().account
    if (!acc) return
    const libs = await getProvider().listLibraries(acc.id)
    set({ libraries: libs })
  },

  async selectLibrary(id) {
    if (!id) {
      set({ currentLibraryId: null, fields: [], items: [] })
      return
    }
    set({ currentLibraryId: id, loading: true })
    try {
      const [fields, items] = await Promise.all([
        getProvider().getTemplate(id),
        getProvider().listItems(id),
      ])
      // 竞态保护：若期间又切换了库，丢弃本次结果
      if (get().currentLibraryId !== id) return
      set({ fields, items, loading: false })
    } catch (e) {
      set({ loading: false })
      throw e
    }
  },

  async refreshCurrent() {
    const id = get().currentLibraryId
    if (!id) return
    const [fields, items] = await Promise.all([
      getProvider().getTemplate(id),
      getProvider().listItems(id),
    ])
    set({ fields, items })
  },

  async createLibrary(name, category = '默认', parentId?: string | null) {
    const acc = useAuthStore.getState().account
    if (!acc) throw new Error('未登录，无法创建管理库')
    const order = get().libraries.reduce((m, l) => Math.max(m, l.sortOrder), -1) + 1
    const lib: Library = {
      id: newId(),
      accountId: acc.id,
      name,
      category,
      sortOrder: order,
      deletedAt: null,
      parentId: parentId ?? null,
    }
    await getProvider().createLibrary(lib)
    track('library_created', { name })
    await get().loadLibraries()
    touchData()
    return lib.id
  },

  async renameLibrary(id, name) {
    await getProvider().renameLibrary(id, name)
    await get().loadLibraries()
    touchData()
  },

  async setLibraryCategory(id, category) {
    await getProvider().setLibraryCategory(id, category)
    await get().loadLibraries()
    touchData()
  },

  async deleteLibrary(id) {
    await getProvider().deleteLibrary(id)
    if (get().currentLibraryId === id) set({ currentLibraryId: null, fields: [], items: [] })
    await get().loadLibraries()
    touchData()
  },

  async restoreLibrary(id) {
    await getProvider().restoreLibrary(id)
    await get().loadLibraries()
    await get().loadTrash()
    touchData()
  },

  async purgeLibrary(id) {
    await getProvider().purgeLibrary(id)
    await get().loadTrash()
    touchData()
  },

  async reorderLibraries(orderedIds) {
    const acc = useAuthStore.getState().account
    if (!acc) throw new Error('未登录，无法重排管理库')
    await getProvider().reorderLibraries(acc.id, orderedIds)
    await get().loadLibraries()
    touchData()
  },

  async saveTemplate(libraryId, fields) {
    await getProvider().saveTemplate(libraryId, fields)
    if (get().currentLibraryId === libraryId) {
      set({ fields: await getProvider().getTemplate(libraryId) })
    }
    touchData()
  },

  async cloneTemplate(srcId, dstId) {
    await getProvider().cloneTemplate(srcId, dstId)
    touchData()
  },

  async createItem(fieldsValues) {
    const acc = useAuthStore.getState().account
    if (!acc) throw new Error('未登录，无法创建条目')
    const libId = get().currentLibraryId
    if (!libId) throw new Error('未选择管理库，无法创建条目')
    const order = get().items.reduce((m, i) => Math.max(m, i.sortOrder), -1) + 1
    const item: Item = {
      id: newId(),
      libraryId: libId,
      accountId: acc.id,
      fields: fieldsValues as Item['fields'],
      pinned: false,
      sortOrder: order,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
    }
    await getProvider().createItem(item)
    set({ items: [...get().items, item] })
    markObStep(acc.id, 'item')
    touchData()
    return item
  },

  async updateItem(item) {
    await getProvider().updateItem(item)
    set({ items: get().items.map((i) => (i.id === item.id ? { ...item, updatedAt: Date.now() } : i)) })
    touchData()
  },

  async deleteItem(id) {
    await getProvider().deleteItem(id)
    set({ items: get().items.filter((i) => i.id !== id) })
    touchData()
  },

  async restoreItem(id) {
    await getProvider().restoreItem(id)
    await get().loadTrash()
    await get().refreshCurrent()
    touchData()
  },

  async purgeItem(id) {
    await getProvider().purgeItem(id)
    await get().loadTrash()
    await get().refreshCurrent()
    touchData()
  },

  async pinItem(id, pinned) {
    await getProvider().pinItem(id, pinned)
    set({ items: get().items.map((i) => (i.id === id ? { ...i, pinned } : i)) })
    touchData()
  },

  async reorderItems(orderedIds) {
    const libId = get().currentLibraryId
    if (!libId) throw new Error('未选择管理库，无法重排条目')
    await getProvider().reorderItems(libId, orderedIds)
    set({
      items: get().items.map((i) => {
        const idx = orderedIds.indexOf(i.id)
        return idx >= 0 ? { ...i, sortOrder: idx } : i
      }),
    })
    touchData()
  },

  async loadTrash() {
    const acc = useAuthStore.getState().account
    if (!acc) return
    const trash = await getProvider().listTrash(acc.id)
    set({ trash })
  },

  focusItem(id) {
    set({ focusItemId: id })
  },

  bumpDataVersion() {
    set((s) => ({ dataVersion: s.dataVersion + 1 }))
  },
}))
