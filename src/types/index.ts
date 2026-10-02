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
  parentId?: string | null   // 父管理库 ID；空=顶级库（支持子库层级）
  /**
   * 最后修改时间。
   *
   * 合并冲突判定必须靠它。之前这个字段根本不存在，于是合并对库只能
   * 「一律保留本地」（怕覆盖离线改名），紧接着的上传又拿本地值覆盖云端：
   * A 设备改名 → B 设备同步（丢弃）→ 再上传（B 的旧名字写回云端）
   * → A 下次同步又拉回旧名。改名被彻底抹掉，而且三方一致地错。
   *
   * 可选是为了兼容旧数据：老库里没有这个字段，按 0（最旧）处理。
   */
  updatedAt?: number
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
  /** 同 Library.updatedAt：字段的改名/改类型/改选项靠它才能正确合并 */
  updatedAt?: number
  /**
   * 软删墓碑。
   *
   * 以前 saveTemplate 是「全删再全插」，被删掉的字段在云端没有留下任何痕迹，
   * 别的设备下次同步会把它当新字段重新插回来 —— 删掉的列在另一台设备上
   * 重新长出来。改成墓碑后删除才能传播出去。
   */
  deletedAt?: number | null
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
  language?: 'zh' | 'en'    // 界面语言；未设置时按浏览器语言自动识别
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
    usePlatformAI?: boolean  // 平台代管模式：走服务端代理，买家零配置
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

// 数据回溯快照
export type SnapshotTrigger = 'manual' | 'transfer' | 'import' | 'pre-restore'

export interface SnapshotRecord {
  id: string
  accountId: string
  createdAt: number
  trigger: SnapshotTrigger
  data: BackupBlob
}

// 默认设置
export const DEFAULT_SETTINGS: Settings = {
  storageMode: 'local',
  cloud: { url: '', anonKey: '' },
  ai: { baseUrl: '', apiKey: '', model: '', scope: 'current', memory: '', customPrompt: '', usePlatformAI: false },
  theme: 'light',
}
