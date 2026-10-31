// 首次欢迎卡状态测试（一次性口令 pending + 按账号 seen）。
//
// 与 `onboarding.test.ts` 一致：测试环境（jsdom 不透明 origin）没有可用 Storage，
// 用内存版替代——必须在调用 welcome 的函数前装好（函数只在调用时读全局，不在模块加载时读）。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => void map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
    _map: map,
  }
}

const local = memoryStorage()
const session = memoryStorage()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: local })
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, writable: true, value: session })

import {
  consumeWelcomePending,
  isWelcomeSeen,
  markWelcomePending,
  markWelcomeSeen,
  resetWelcomeForTests,
  welcomeSeenKey,
} from './welcome'

const ACC = 'acc-A'
const OTHER = 'acc-B'

beforeEach(() => {
  local.clear()
  session.clear()
  resetWelcomeForTests()
})

afterEach(() => {
  // 每个用例结束后恢复为「不会抛错」的内存实现（异常用例里会临时替换全局）
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: local })
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, writable: true, value: session })
})

describe('一次性口令 pending（sessionStorage）', () => {
  it('没写过 pending → 不显示', () => {
    expect(consumeWelcomePending()).toBe(false)
  })

  it('写过 pending → 第一次 true，之后永远 false（幂等消费）', () => {
    markWelcomePending()
    expect(consumeWelcomePending()).toBe(true)
    expect(consumeWelcomePending()).toBe(false)
    expect(consumeWelcomePending()).toBe(false)
  })

  it('StrictMode 双挂载：两个实例先后消费，只有一个拿到 true', () => {
    markWelcomePending()
    const first = consumeWelcomePending() // 第一次 effect
    const second = consumeWelcomePending() // StrictMode 重放的第二个实例
    expect(first).toBe(true)
    expect(second).toBe(false)
    expect([first, second].filter(Boolean)).toHaveLength(1)
  })

  it('重复 mark 也只有一个一次性口令，且不会复活已消费的口令', () => {
    markWelcomePending()
    markWelcomePending()
    expect(consumeWelcomePending()).toBe(true)
    expect(consumeWelcomePending()).toBe(false)
  })

  it('pending 存在 sessionStorage 的固定键，消费后键消失', () => {
    markWelcomePending()
    expect(session.getItem('info-mgmt-welcome-pending')).toBe('1')
    consumeWelcomePending()
    expect(session.getItem('info-mgmt-welcome-pending')).toBeNull()
  })
})

describe('seen 记录（localStorage，按 accountId 隔离）', () => {
  it('未看过 → false；标记后 → true', () => {
    expect(isWelcomeSeen(ACC)).toBe(false)
    markWelcomeSeen(ACC)
    expect(isWelcomeSeen(ACC)).toBe(true)
  })

  it('键名沿用 info-mgmt-ob-welcome-${accountId}', () => {
    markWelcomeSeen(ACC)
    expect(welcomeSeenKey(ACC)).toBe('info-mgmt-ob-welcome-acc-A')
    expect(local.getItem('info-mgmt-ob-welcome-acc-A')).toBe('1')
  })

  it('账号之间互不影响（共用设备不串味）', () => {
    markWelcomeSeen(ACC)
    expect(isWelcomeSeen(ACC)).toBe(true)
    expect(isWelcomeSeen(OTHER)).toBe(false)

    markWelcomeSeen(OTHER)
    expect(isWelcomeSeen(OTHER)).toBe(true)
  })

  it('重复标记幂等，不会抛错', () => {
    markWelcomeSeen(ACC)
    expect(() => markWelcomeSeen(ACC)).not.toThrow()
    expect(isWelcomeSeen(ACC)).toBe(true)
  })

  it('空 accountId 不写、不读、不抛错', () => {
    expect(isWelcomeSeen('')).toBe(false)
    expect(() => markWelcomeSeen('')).not.toThrow()
    expect(local.length).toBe(0)
  })

  it('pending 与 seen 是两层独立兜底：seen 不影响口令消费，口令不影响 seen', () => {
    markWelcomeSeen(ACC)
    markWelcomePending()
    expect(consumeWelcomePending()).toBe(true) // 口令侧照常
    expect(isWelcomeSeen(ACC)).toBe(true) // seen 侧照常
  })
})

describe('存储不可用（隐私模式 / 配额）时不抛错', () => {
  it('sessionStorage.setItem 抛错 → mark 静默失败，consume 返回 false', () => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      writable: true,
      value: {
        getItem: () => {
          throw new Error('SecurityError')
        },
        setItem: () => {
          throw new Error('SecurityError')
        },
        removeItem: () => {
          throw new Error('SecurityError')
        },
      },
    })
    expect(() => markWelcomePending()).not.toThrow()
    expect(consumeWelcomePending()).toBe(false)
  })

  it('localStorage 读写抛错 → isWelcomeSeen 返回 false，markWelcomeSeen 不抛错', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      writable: true,
      value: {
        getItem: () => {
          throw new Error('SecurityError')
        },
        setItem: () => {
          throw new Error('SecurityError')
        },
        removeItem: () => {
          throw new Error('SecurityError')
        },
        key: () => null,
        length: 0,
      },
    })
    expect(isWelcomeSeen(ACC)).toBe(false)
    expect(() => markWelcomeSeen(ACC)).not.toThrow()
  })
})
