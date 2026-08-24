// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'

// Node 26 的实验性全局 localStorage 会遮蔽 jsdom 提供的实现（需 --localstorage-file），
// 测试中统一替换为内存版；真实浏览器不受影响。
function installMemoryLocalStorage() {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      return {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k),
        clear: () => void store.clear(),
      }
    },
  })
}
import {
  importLegacyMemory,
  listMemory,
  addMemory,
  removeMemoryByIdxOrText,
  updateMemoryByIdxOrText,
  replaceAllMemory,
  clearMemory,
  memoryPrompt,
} from '@/ai/memory'

const ACC = 'test-account'

describe('结构化记忆模块', () => {
  beforeEach(() => {
    installMemoryLocalStorage()
    clearMemory(ACC)
  })

  it('新增记忆并自动去重', () => {
    const n1 = addMemory(ACC, ['偏好表格', '喜欢简洁'])
    expect(n1).toBe(2)
    // 完全相同的内容不重复
    const n2 = addMemory(ACC, ['偏好表格', '新的记忆'])
    expect(n2).toBe(1)
    expect(listMemory(ACC)).toHaveLength(3)
  })

  it('旧版纯文本记忆按行迁移（幂等）', () => {
    importLegacyMemory(ACC, '- 记忆一\n* 记忆二\n\n1. 记忆三')
    const entries = listMemory(ACC)
    expect(entries.map((e) => e.text)).toEqual(['记忆一', '记忆二', '记忆三'])
    // 再次迁移不重复
    importLegacyMemory(ACC, '别的内容')
    expect(listMemory(ACC)).toHaveLength(3)
  })

  it('按编号删除记忆', () => {
    replaceAllMemory(ACC, ['第一条', '第二条', '第三条'])
    const n = removeMemoryByIdxOrText(ACC, ['#2'])
    expect(n).toBe(1)
    expect(listMemory(ACC).map((e) => e.text)).toEqual(['第一条', '第三条'])
  })

  it('按原文删除记忆', () => {
    replaceAllMemory(ACC, ['用户喜欢表格', '日期用 ISO'])
    const n = removeMemoryByIdxOrText(ACC, ['用户喜欢表格'])
    expect(n).toBe(1)
    expect(listMemory(ACC)[0].text).toBe('日期用 ISO')
  })

  it('按编号修改单条记忆', () => {
    replaceAllMemory(ACC, ['甲', '乙'])
    expect(updateMemoryByIdxOrText(ACC, '2', '乙改')).toBe(true)
    expect(listMemory(ACC)[1].text).toBe('乙改')
  })

  it('memoryPrompt 输出编号列表，空记忆返回 null', () => {
    expect(memoryPrompt(ACC)).toBeNull()
    addMemory(ACC, ['A', 'B'])
    const p = memoryPrompt(ACC)!
    expect(p).toContain('1. A')
    expect(p).toContain('2. B')
  })
})
