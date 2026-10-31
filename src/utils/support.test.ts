// `utils/support.ts`（v3 简化版）测试：
// 只保留两项状态 —— 已支持终态、首次导出备份记录；v2 的 R1–R6 投放状态机已删除。
// 环境：jsdom 不透明 origin 没有可用 Storage，用内存版替代（同 onboarding.test.ts 范式）。
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
  }
}

const local = memoryStorage()
const session = memoryStorage()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: local })
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, writable: true, value: session })

import { isSupported, markSupported, noteBackupExported, supportKey } from './support'

const ACC = 'acc-A'
const OTHER = 'acc-B'

function raw(accountId: string): Record<string, unknown> {
  const v = local.getItem(supportKey(accountId))
  return v ? (JSON.parse(v) as Record<string, unknown>) : {}
}

beforeEach(() => {
  local.clear()
  session.clear()
})

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: local })
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, writable: true, value: session })
})

describe('已支持终态（isSupported / markSupported）', () => {
  it('默认未支持；标记后为 true', () => {
    expect(isSupported(ACC)).toBe(false)
    markSupported(ACC)
    expect(isSupported(ACC)).toBe(true)
  })

  it('存储键仍是 info-mgmt-support-<accountId>，且写入 v:1 结构', () => {
    markSupported(ACC)
    expect(supportKey(ACC)).toBe('info-mgmt-support-acc-A')
    expect(raw(ACC)).toMatchObject({ v: 1, supported: true, milestones: { backupExported: false } })
  })

  it('幂等：重复标记不抛错，值不变', () => {
    markSupported(ACC)
    expect(() => markSupported(ACC)).not.toThrow()
    expect(isSupported(ACC)).toBe(true)
  })

  it('按 accountId 隔离：A 支持不影响 B', () => {
    markSupported(ACC)
    expect(isSupported(ACC)).toBe(true)
    expect(isSupported(OTHER)).toBe(false)
    expect(local.getItem(supportKey(OTHER))).toBeNull()
  })

  it('空 accountId 不写、不读、不抛错', () => {
    expect(isSupported('')).toBe(false)
    expect(() => markSupported('')).not.toThrow()
    expect(local.length).toBe(0)
  })
})

describe('首次导出备份记录（noteBackupExported）', () => {
  it('显式 accountId：写入 milestones.backupExported', () => {
    noteBackupExported(ACC)
    expect(raw(ACC)).toMatchObject({ v: 1, milestones: { backupExported: true } })
  })

  it('不传 accountId：从 info-mgmt-account-id 读取', () => {
    local.setItem('info-mgmt-account-id', ACC)
    noteBackupExported()
    expect(raw(ACC)).toMatchObject({ milestones: { backupExported: true } })
  })

  it('登录态在 sessionStorage（未勾选"记住登录"）时也能读到', () => {
    session.setItem('info-mgmt-account-id', ACC)
    noteBackupExported()
    expect(raw(ACC)).toMatchObject({ milestones: { backupExported: true } })
  })

  it('没有登录账号时安全 no-op，不写任何键', () => {
    expect(() => noteBackupExported()).not.toThrow()
    expect(local.length).toBe(0)
  })

  it('幂等：重复调用不会覆盖已支持终态', () => {
    markSupported(ACC)
    noteBackupExported(ACC)
    noteBackupExported(ACC)
    expect(raw(ACC)).toMatchObject({ supported: true, milestones: { backupExported: true } })
  })
})

describe('v2 旧数据兼容（升级不丢"已支持"）', () => {
  it('旧结构里的 supported 仍能读出来（读路径兼容，不要求改写旧行）', () => {
    // v2 结构（含已废弃的 R1–R6 字段）——升级后这些字段应被忽略但不影响关键状态
    local.setItem(
      supportKey(ACC),
      JSON.stringify({
        v: 1,
        firstSeenAt: 1,
        sessions: 9,
        lastSessionAt: 2,
        milestones: { onboardingDone: true, backupExported: true },
        shownCount: 2,
        lastShownAt: 3,
        snoozedUntil: 4,
        muted: true,
        supported: true,
        snoozeUsed: true,
      }),
    )
    expect(isSupported(ACC)).toBe(true)
    // 同一行不会因为 markSupported 被回写成「未支持」
    markSupported(ACC)
    expect(isSupported(ACC)).toBe(true)
  })

  it('旧行里的废弃字段在下次写入时被丢弃，关键状态保留', () => {
    // 旧行存在但尚未支持 → 第一次 markSupported 会按新结构覆盖写
    local.setItem(
      supportKey(ACC),
      JSON.stringify({
        v: 1,
        firstSeenAt: 1,
        sessions: 9,
        milestones: { onboardingDone: true, backupExported: false },
        shownCount: 2,
        muted: true,
        supported: false,
      }),
    )
    markSupported(ACC)
    expect(raw(ACC)).toEqual({ v: 1, supported: true, milestones: { backupExported: false } })
  })

  it('损坏 JSON / 未知版本 → 当作没有记录，不抛错', () => {
    local.setItem(supportKey(ACC), '{not json')
    expect(() => isSupported(ACC)).not.toThrow()
    expect(isSupported(ACC)).toBe(false)

    local.setItem(supportKey(ACC), JSON.stringify({ v: 2, supported: true }))
    expect(isSupported(ACC)).toBe(false)
  })

  it('存储不可用（隐私模式）时不抛错、返回未支持', () => {
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
    expect(isSupported(ACC)).toBe(false)
    expect(() => markSupported(ACC)).not.toThrow()
    expect(() => noteBackupExported(ACC)).not.toThrow()
  })
})
