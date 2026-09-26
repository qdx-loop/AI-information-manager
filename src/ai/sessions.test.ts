import { describe, it, expect, beforeEach } from 'vitest'

// 内存版 localStorage（测试环境无浏览器实现）
const store = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => void store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  },
})

import {
  listSessions,
  newSession,
  saveSession,
  loadMessages,
  deleteSession,
  touchSessionTitle,
  renameSession,
  isSessionTitled,
  LEGACY_KEY,
} from './sessions'

const ACC = 'acc-1'

describe('AI 会话存储', () => {
  beforeEach(() => store.clear())

  it('旧版单会话自动迁移为默认会话', () => {
    localStorage.setItem(LEGACY_KEY(ACC), JSON.stringify([{ role: 'user', content: 'hi' }]))
    const list = listSessions(ACC)
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('默认会话')
    expect(loadMessages(list[0].id)).toEqual([{ role: 'user', content: 'hi' }])
    // 旧键已清除，不会重复迁移
    expect(localStorage.getItem(LEGACY_KEY(ACC))).toBeNull()
    expect(listSessions(ACC)).toHaveLength(1)
  })

  it('新建/保存/懒取名', () => {
    const s = newSession()
    saveSession(ACC, s, [{ role: 'user', content: '帮我统计客户' }])
    expect(listSessions(ACC)).toHaveLength(1)
    touchSessionTitle(ACC, s.id, '帮我统计客户')
    const list = listSessions(ACC)
    expect(list[0].title).toBe('帮我统计客户')
    // 已有标题不覆盖
    touchSessionTitle(ACC, s.id, '另一句话')
    expect(listSessions(ACC)[0].title).toBe('帮我统计客户')
  })

  it('多会话按 updatedAt 倒序', () => {
    const a = newSession()
    const b = newSession()
    saveSession(ACC, a, [])
    saveSession(ACC, b, [])
    const list = listSessions(ACC)
    expect(list).toHaveLength(2)
    expect(list[0].id).toBe(b.id) // 最新在前
  })

  it('删除会话：移除消息并从列表消失', () => {
    const a = newSession()
    saveSession(ACC, a, [{ role: 'user', content: 'x' }])
    const rest = deleteSession(ACC, a.id)
    expect(rest).toHaveLength(0)
    expect(loadMessages(a.id)).toEqual([])
  })

  it('AI 命名：renameSession 写入并标记 titled，之后的懒取名不再覆盖', () => {
    const s = newSession()
    saveSession(ACC, s, [{ role: 'user', content: '帮我把客户数据做个统计图' }])
    expect(isSessionTitled(ACC, s.id)).toBe(false)

    renameSession(ACC, s.id, '客户数据统计')
    expect(isSessionTitled(ACC, s.id)).toBe(true)
    expect(listSessions(ACC)[0].title).toBe('客户数据统计')

    // 懒取名（截取式）不能覆盖 AI 命名
    touchSessionTitle(ACC, s.id, '帮我把客户数据做个统计图')
    expect(listSessions(ACC)[0].title).toBe('客户数据统计')
  })

  it('saveSession 频繁保存不丢失 titled 标记', () => {
    const s = newSession()
    saveSession(ACC, s, [])
    renameSession(ACC, s.id, '已命名')
    // 模拟消息更新时的保存（meta 来自旧列表快照，无 titled 字段）
    const stale = listSessions(ACC)[0]
    saveSession(ACC, { ...stale, titled: undefined }, [])
    expect(isSessionTitled(ACC, s.id)).toBe(true)
    expect(listSessions(ACC)[0].title).toBe('已命名')
  })

  it('AI 命名后新建同名会话不受影响（titled 按会话隔离）', () => {
    const a = newSession()
    const b = newSession()
    saveSession(ACC, a, [])
    saveSession(ACC, b, [])
    renameSession(ACC, a.id, '第一个')
    expect(isSessionTitled(ACC, b.id)).toBe(false)
  })

  it('消息超出字段（undo/chart 之外的运行期字段）不影响落盘', () => {
    const s = newSession()
    saveSession(ACC, s, [{ role: 'assistant', content: 'done', thinking: 't', steps: ['s1'] }])
    const loaded = loadMessages(s.id)
    expect(loaded[0].steps).toEqual(['s1'])
    expect(loaded[0].thinking).toBe('t')
  })
})
