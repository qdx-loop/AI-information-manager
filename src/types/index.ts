// 字段类型
export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'rating'

// 条目字段值（联合类型）
export type FieldValue = string | number | boolean | null

// 账户
export interface Account {
  id: string
  username: string
  passwordHash: string
  salt: string
  createdAt: number
}

// 管理库
export interface Library {
  id: string
  accountId: string
  name: string
  category: string
  sortOrder: number
  deletedAt: number | null
}

// 字段定义（模板）
export interface FieldDef {
  id: string
  libraryId: string
  key: string          // 字段键（程序用，唯一于库内）
  label: string        // 显示名
  type: FieldType
  options: string[]    // select 选项
  required: boolean
  visible: boolean
  sortOrder: number
}

// 条目
export interface Item {
  id: string
  libraryId: string
  accountId: string
  fields: Record<string, FieldValue>
  pinned: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

// 回收站条目
export type TrashEntry =
  | { kind: 'library'; record: Library; deletedAt: number }
  | { kind: 'item'; record: Item; libraryName: string; deletedAt: number }

// 存储模式
export type StorageMode = 'local' | 'cloud'

// AI 作用域
export type AIScope = 'current' | 'all'

// 应用设置
export interface Settings {
  storageMode: StorageMode
  cloud: {
    url: string
    anonKey: string
  }
  ai: {
    baseUrl: string
    apiKey: string
    model: string
    scope: AIScope
    memory: string           // AI 永久记忆（跨会话保留，注入每次对话）
    customPrompt: string     // 自定义系统提示词（空则使用内置默认）
  }
  theme: 'light' | 'dark'
}

// 备份结构
export interface BackupBlob {
  version: number
  exportedAt: number
  accountId: string
  libraries: Library[]
  fields: FieldDef[]
  items: Item[]
}

// 默认设置
export const DEFAULT_SETTINGS: Settings = {
  storageMode: 'local',
  cloud: { url: '', anonKey: '' },
  ai: { baseUrl: '', apiKey: '', model: '', scope: 'current', memory: '', customPrompt: '' },
  theme: 'light',
}
