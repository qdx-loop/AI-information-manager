import { create } from 'zustand'
import type { Library, FieldDef, Item, TrashEntry } from '@/types'
import { getProvider } from '@/db/providerFactory'
import { useAuthStore } from './authStore'
import { newId } from '@/utils/id'

interface LibraryState {
  libraries: Library[]
  currentLibraryId: string | null
  fields: FieldDef[]
  items: Item[]
  trash: TrashEntry[]
  focusItemId: string | null
  loading: boolean

  loadLibraries: () => Promise<void>
  selectLibrary: (id: string | null) => Promise<void>
  refreshCurrent: () => Promise<void>

  createLibrary: (name: string, category?: string) => Promise<string>
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
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  libraries: [],
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
    const [fields, items] = await Promise.all([
      getProvider().getTemplate(id),
      getProvider().listItems(id),
    ])
    set({ fields, items, loading: false })
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

  async createLibrary(name, category = '默认') {
    const acc = useAuthStore.getState().account!
    const order = get().libraries.length
    const lib: Library = {
      id: newId(),
      accountId: acc.id,
      name,
      category,
      sortOrder: order,
      deletedAt: null,
    }
    await getProvider().createLibrary(lib)
    await get().loadLibraries()
    return lib.id
  },

  async renameLibrary(id, name) {
    await getProvider().renameLibrary(id, name)
    await get().loadLibraries()
  },

  async setLibraryCategory(id, category) {
    await getProvider().setLibraryCategory(id, category)
    await get().loadLibraries()
  },

  async deleteLibrary(id) {
    await getProvider().deleteLibrary(id)
    if (get().currentLibraryId === id) set({ currentLibraryId: null, fields: [], items: [] })
    await get().loadLibraries()
  },

  async restoreLibrary(id) {
    await getProvider().restoreLibrary(id)
    await get().loadLibraries()
    await get().loadTrash()
  },

  async purgeLibrary(id) {
    await getProvider().purgeLibrary(id)
    await get().loadTrash()
  },

  async reorderLibraries(orderedIds) {
    const acc = useAuthStore.getState().account!
    await getProvider().reorderLibraries(acc.id, orderedIds)
    await get().loadLibraries()
  },

  async saveTemplate(libraryId, fields) {
    await getProvider().saveTemplate(libraryId, fields)
    if (get().currentLibraryId === libraryId) {
      set({ fields: await getProvider().getTemplate(libraryId) })
    }
  },

  async cloneTemplate(srcId, dstId) {
    await getProvider().cloneTemplate(srcId, dstId)
  },

  async createItem(fieldsValues) {
    const acc = useAuthStore.getState().account!
    const libId = get().currentLibraryId!
    const order = get().items.length
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
    return item
  },

  async updateItem(item) {
    await getProvider().updateItem(item)
    set({ items: get().items.map((i) => (i.id === item.id ? { ...item, updatedAt: Date.now() } : i)) })
  },

  async deleteItem(id) {
    await getProvider().deleteItem(id)
    set({ items: get().items.filter((i) => i.id !== id) })
  },

  async restoreItem(id) {
    await getProvider().restoreItem(id)
    await get().loadTrash()
  },

  async purgeItem(id) {
    await getProvider().purgeItem(id)
    await get().loadTrash()
  },

  async pinItem(id, pinned) {
    await getProvider().pinItem(id, pinned)
    set({ items: get().items.map((i) => (i.id === id ? { ...i, pinned } : i)) })
  },

  async reorderItems(orderedIds) {
    const libId = get().currentLibraryId!
    await getProvider().reorderItems(libId, orderedIds)
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
}))
