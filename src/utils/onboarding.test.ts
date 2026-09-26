import { describe, it, expect, beforeEach } from 'vitest'

// 测试环境无浏览器 localStorage，用内存版替代（须在调用 onboarding 函数前定义）
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
  markObStep,
  isObStepDone,
  dismissOb,
  isObDismissed,
  markTourDone,
  isTourDone,
  obKey,
} from './onboarding'

describe('onboarding 持久化', () => {
  beforeEach(() => store.clear())

  it('标记并可读取步骤完成', () => {
    expect(isObStepDone('a1', 'item')).toBe(false)
    markObStep('a1', 'item')
    expect(isObStepDone('a1', 'item')).toBe(true)
  })

  it('步骤按账号隔离', () => {
    markObStep('a1', 'ai')
    expect(isObStepDone('a1', 'ai')).toBe(true)
    expect(isObStepDone('a2', 'ai')).toBe(false)
  })

  it('dismiss 与 tour 标记独立', () => {
    expect(isObDismissed('a1')).toBe(false)
    dismissOb('a1')
    expect(isObDismissed('a1')).toBe(true)
    expect(isTourDone('a1')).toBe(false)
    markTourDone('a1')
    expect(isTourDone('a1')).toBe(true)
  })

  it('obKey 格式稳定', () => {
    expect(obKey('a1', 'item')).toBe('info-mgmt-ob-item-a1')
  })
})
