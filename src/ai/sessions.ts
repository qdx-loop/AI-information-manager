// AI 会话存储层：多会话 + 删除，全部落在 localStorage（零迁移、本地优先）。
// 结构：
//   ai-sessions-{accountId}  → SessionMeta[]（id/title/updatedAt）
//   ai-chat-{sessionId}       → 该会话的消息数组
// 兼容：旧版单会话存在 ai-chat-{accountId}，首次访问自动迁移为「默认会话」。

export interface StoredMessage {
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  steps?: string[]
  chart?: unknown
  undo?: never // 运行期撤回句柄不落盘
}

export interface SessionMeta {
  id: string
  title: string
  updatedAt: number
  /** AI 已智能命名过（true 后不再被任何自动逻辑覆盖，仅手动重命名可改） */
  titled?: boolean
}

const LIST_KEY = (accountId: string) => `ai-sessions-${accountId}`
const MSG_KEY = (sessionId: string) => `ai-chat-${sessionId}`
/** 旧版单会话的存储键（迁移用） */
export const LEGACY_KEY = (accountId: string) => `ai-chat-${accountId}`

function readList(accountId: string): SessionMeta[] {
  try {
    const raw = localStorage.getItem(LIST_KEY(accountId))
    if (!raw) return []
    const arr = JSON.parse(raw) as SessionMeta[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function writeList(accountId: string, list: SessionMeta[]): void {
  try {
    localStorage.setItem(LIST_KEY(accountId), JSON.stringify(list))
  } catch {
    /* 忽略配额错误 */
  }
}

/** 旧版 ai-chat-{accountId} 消息迁移为默认会话；迁移后清除旧键 */
function migrateLegacy(accountId: string): SessionMeta[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY(accountId))
    if (!raw) return []
    const messages = JSON.parse(raw) as StoredMessage[]
    if (!Array.isArray(messages) || messages.length === 0) return []
    const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const meta: SessionMeta = { id, title: '默认会话', updatedAt: Date.now() }
    localStorage.setItem(MSG_KEY(id), JSON.stringify(messages))
    localStorage.removeItem(LEGACY_KEY(accountId))
    return [meta]
  } catch {
    return []
  }
}

/** 取会话列表（首访问自动迁移旧单会话数据） */
export function listSessions(accountId: string): SessionMeta[] {
  let list = readList(accountId)
  if (list.length === 0 && !localStorage.getItem(LIST_KEY(accountId))) {
    const migrated = migrateLegacy(accountId)
    if (migrated.length > 0) {
      list = migrated
      writeList(accountId, list)
    }
  }
  return list.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function newSession(): SessionMeta {
  return {
    id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    updatedAt: Date.now(),
  }
}

/** 新建并保存会话（空消息也占位，保证切换器可见） */
export function saveSession(accountId: string, meta: SessionMeta, messages: StoredMessage[]): void {
  const list = readList(accountId)
  const existing = list.findIndex((s) => s.id === meta.id)
  // 保留已有的 titled 标记（消息频繁保存时防止 AI 命名状态被旧 meta 冲掉）
  const prev = existing >= 0 ? list[existing] : null
  const next: SessionMeta = {
    ...meta,
    title: meta.title || '新会话',
    titled: meta.titled ?? prev?.titled,
    updatedAt: Date.now(),
  }
  if (existing >= 0) list[existing] = next
  else list.unshift(next)
  writeList(accountId, list)
  try {
    localStorage.setItem(MSG_KEY(meta.id), JSON.stringify(messages))
  } catch {
    /* 忽略 */
  }
}

export function loadMessages(sessionId: string): StoredMessage[] {
  try {
    const raw = localStorage.getItem(MSG_KEY(sessionId))
    if (!raw) return []
    const arr = JSON.parse(raw) as StoredMessage[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/** 删除会话（含其消息）；返回剩余列表 */
export function deleteSession(accountId: string, sessionId: string): SessionMeta[] {
  const list = readList(accountId).filter((s) => s.id !== sessionId)
  writeList(accountId, list)
  try {
    localStorage.removeItem(MSG_KEY(sessionId))
  } catch {
    /* 忽略 */
  }
  return list.sort((a, b) => b.updatedAt - a.updatedAt)
}

/** 首条用户消息懒取名兜底（在 AI 命名到达前的临时标题；titled 的不被覆盖） */
export function touchSessionTitle(accountId: string, sessionId: string, firstUserText: string): void {
  const list = readList(accountId)
  const idx = list.findIndex((s) => s.id === sessionId)
  if (idx < 0) return
  const s = list[idx]
  if (!s.title || s.title === '新会话' || s.title === 'New chat') {
    if (!s.titled) {
      const title = firstUserText.trim().slice(0, 20) || '新会话'
      list[idx] = { ...s, title }
    }
  }
  list[idx] = { ...list[idx], updatedAt: Date.now() }
  writeList(accountId, list)
}

/** AI 智能命名：写入标题并标记 titled（之后的自动逻辑不再覆盖） */
export function renameSession(accountId: string, sessionId: string, title: string): void {
  const list = readList(accountId)
  const idx = list.findIndex((s) => s.id === sessionId)
  if (idx < 0) return
  const clean = title.trim().slice(0, 30) || list[idx].title
  list[idx] = { ...list[idx], title: clean, titled: true, updatedAt: Date.now() }
  writeList(accountId, list)
}

/** 会话是否已 AI 命名过（供去重：同会话只生成一次） */
export function isSessionTitled(accountId: string, sessionId: string): boolean {
  const s = readList(accountId).find((x) => x.id === sessionId)
  return !!s?.titled
}
