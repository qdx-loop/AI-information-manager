// 结构化 AI 记忆系统：按账号隔离，支持单条增删改
// 存储于 localStorage（键按账号隔离），旧版纯文本记忆自动迁移

import { newId } from '@/utils/id'

export interface MemoryEntry {
  id: string
  text: string
  at: number // 创建时间戳
}

const KEY_PREFIX = 'ai-memory-v2:'

function storageKey(accountId: string): string {
  return `${KEY_PREFIX}${accountId}`
}

function loadRaw(accountId: string): MemoryEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(accountId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((e) => e && typeof e.text === 'string') : []
  } catch {
    return []
  }
}

function save(accountId: string, entries: MemoryEntry[]) {
  localStorage.setItem(storageKey(accountId), JSON.stringify(entries))
}

// 首次使用 v2 时，把旧版 settings.ai.memory 的纯文本按行迁移进来
export function importLegacyMemory(accountId: string, legacy: string) {
  if (!legacy?.trim()) return
  if (loadRaw(accountId).length > 0 || localStorage.getItem(storageKey(accountId))) return
  const lines = legacy
    .split('\n')
    .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(Boolean)
  if (lines.length === 0) return
  save(
    accountId,
    lines.map((text) => ({ id: newId(), text, at: Date.now() })),
  )
}

export function listMemory(accountId: string): MemoryEntry[] {
  return loadRaw(accountId)
}

// 新增记忆条目（自动去重：完全相同文本不重复添加）。返回实际新增的条数。
export function addMemory(accountId: string, texts: string[]): number {
  const entries = loadRaw(accountId)
  const existing = new Set(entries.map((e) => e.text))
  let added = 0
  for (const raw of texts) {
    const text = String(raw ?? '').trim()
    if (!text || existing.has(text)) continue
    entries.push({ id: newId(), text, at: Date.now() })
    existing.add(text)
    added++
  }
  if (added > 0) save(accountId, entries)
  return added
}

export function updateMemory(accountId: string, id: string, text: string): boolean {
  const entries = loadRaw(accountId)
  const target = entries.find((e) => e.id === id)
  if (!target) return false
  target.text = text.trim()
  target.at = Date.now()
  save(accountId, entries)
  return true
}

export function removeMemory(accountId: string, ids: string[]): number {
  const entries = loadRaw(accountId)
  const set = new Set(ids)
  const next = entries.filter((e) => !set.has(e.id))
  save(accountId, next)
  return entries.length - next.length
}

// 按 id 或文本内容删除（AI 常用文本指代要删除的记忆）
export function removeMemoryByContent(accountId: string, texts: string[]): number {
  const entries = loadRaw(accountId)
  const set = new Set(texts.map((t) => t.trim()))
  const next = entries.filter((e) => !set.has(e.text))
  save(accountId, next)
  return entries.length - next.length
}

export function replaceAllMemory(accountId: string, texts: string[]) {
  const now = Date.now()
  save(
    accountId,
    texts
      .map((t) => String(t).trim())
      .filter(Boolean)
      .map((text) => ({ id: newId(), text, at: now })),
  )
}

// 按「编号(提示词里的序号，从1开始)或原文」删除记忆。返回删除条数。
export function removeMemoryByIdxOrText(accountId: string, refs: string[]): number {
  const entries = loadRaw(accountId)
  const toRemove = new Set<string>()
  for (const rawRef of refs) {
    const s = String(rawRef).trim()
    if (!s) continue
    const n = Number(s.replace(/^#/, ''))
    if (Number.isInteger(n) && n >= 1 && n <= entries.length) {
      toRemove.add(entries[n - 1].id)
      continue
    }
    for (const e of entries) {
      if (e.text === s || e.text.includes(s) || s.includes(e.text)) toRemove.add(e.id)
    }
  }
  if (toRemove.size === 0) return 0
  save(
    accountId,
    entries.filter((e) => !toRemove.has(e.id)),
  )
  return toRemove.size
}

// 按「编号或原文」修改单条记忆
export function updateMemoryByIdxOrText(accountId: string, ref: string, newText: string): boolean {
  const entries = loadRaw(accountId)
  let target: MemoryEntry | undefined
  const s = String(ref).trim()
  const n = Number(s.replace(/^#/, ''))
  if (Number.isInteger(n) && n >= 1 && n <= entries.length) {
    target = entries[n - 1]
  } else {
    target = entries.find((e) => e.text === s || e.text.includes(s))
  }
  if (!target) return false
  target.text = newText.trim()
  target.at = Date.now()
  save(accountId, entries)
  return true
}

export function clearMemory(accountId: string) {
  localStorage.removeItem(storageKey(accountId))
}

// 导出为注入提示词的文本（编号列表）；无记忆返回 null
export function memoryPrompt(accountId: string): string | null {
  const entries = loadRaw(accountId)
  if (entries.length === 0) return null
  const lines = entries.map((e, i) => `${i + 1}. ${e.text}`)
  return `以下是你此前保存的长期记忆（共 ${entries.length} 条），回答时请参考：\n${lines.join('\n')}`
}
