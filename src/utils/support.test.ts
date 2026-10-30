// 赞赏入口投放状态机的规则测试（R1/R2/R4/R5/R6/R7/R8/R9/R10）。
//
// 全部注入固定时间戳（函数签名都接受 now），不依赖真实时钟，也不 sleep；
// 每个用例前清空 localStorage，保证账号之间/用例之间零残留。
import { describe, it, expect, beforeEach } from 'vitest'

// 测试环境（jsdom 的不透明 origin）没有可用的 localStorage，
// 用内存版替代——与 `onboarding.test.ts` 的做法一致，且必须在调用 support 的函数前装好。
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
  canShowNudge,
  ensureSeen,
  noteSession,
  markMilestone,
  markNudgeShown,
  snoozeNudge,
  muteNudge,
  markSupported,
  isSupported,
  evaluateNudge,
  loadSupportState,
  noteBackupExported,
  currentAccountId,
  supportKey,
  resetForTests,
  MAX_NUDGES,
} from './support'

const ACC = 'acc-A'
const OTHER = 'acc-B'
const DAY = 86_400_000
const MIN = 60_000
/** 固定基准时刻：2026-01-10 10:00 本地时间（本地日界与「同一天」判定都基于它） */
const T0 = new Date(2026, 0, 10, 10, 0, 0).getTime()

const at = (days: number, ms = 0) => T0 + days * DAY + ms

/** 造一个「除了正在测的那条，其余规则全部满足」的账号 */
function seedEligible(accountId = ACC) {
  ensureSeen(accountId, T0) // R1 起点
  noteSession(accountId, T0 + 31 * MIN) // R2：>30min → sessions=2
  markMilestone(accountId, 'onboardingDone', T0) // R3：M1
}

beforeEach(() => {
  localStorage.clear()
  resetForTests()
})

describe('存储与隔离（R10）', () => {
  it('单键 info-mgmt-support-<accountId>，换账号互不影响', () => {
    expect(supportKey(ACC)).toBe('info-mgmt-support-acc-A')
    seedEligible(ACC)
    expect(localStorage.getItem('info-mgmt-support-acc-A')).toBeTruthy()
    expect(localStorage.getItem('info-mgmt-support-acc-B')).toBeNull()

    // A 满足全部条件，B 从没进过应用 → 只有 A 可能看到
    expect(canShowNudge(ACC, at(3))).toBe(true)
    expect(canShowNudge(OTHER, at(3))).toBe(false)
    expect(loadSupportState(OTHER).firstSeenAt).toBe(0)
  })

  it('A 已支持不污染 B；B 的静音也不影响 A 的账号记录', () => {
    seedEligible(ACC)
    markSupported(ACC, at(3))
    expect(isSupported(ACC)).toBe(true)
    expect(isSupported(OTHER)).toBe(false)

    ensureSeen(OTHER, at(3))
    noteSession(OTHER, at(3, 31 * MIN))
    markMilestone(OTHER, 'backupExported', at(3))
    expect(canShowNudge(OTHER, at(3, 3 * DAY))).toBe(true)
  })

  it('localStorage 里是坏 JSON / 未知版本时安全降级，不抛错', () => {
    localStorage.setItem(supportKey(ACC), '{not json')
    expect(() => loadSupportState(ACC)).not.toThrow()
    expect(loadSupportState(ACC).firstSeenAt).toBe(0)
    expect(canShowNudge(ACC, at(3))).toBe(false)

    // 版本不符 → 当作没有记录；ensureSeen 会重新建档
    localStorage.setItem(supportKey(ACC), JSON.stringify({ v: 2, firstSeenAt: T0 }))
    expect(loadSupportState(ACC).firstSeenAt).toBe(0)
    ensureSeen(ACC, T0)
    expect(loadSupportState(ACC).firstSeenAt).toBe(T0)
    expect(loadSupportState(ACC).v).toBe(1)
  })
})

describe('R1 首见 ≥ 3 天', () => {
  it('第 3 天前一律不出现，第 3 天整开始才可能', () => {
    seedEligible()
    expect(canShowNudge(ACC, at(3) - 1)).toBe(false)
    expect(evaluateNudge(ACC, at(3) - 1).reason).toBe('too-early')
    expect(canShowNudge(ACC, at(3))).toBe(true)
    expect(evaluateNudge(ACC, at(3)).reason).toBeNull()
  })
})

describe('R2 ≥ 2 次会话（间隔 > 30 分钟）', () => {
  it('只有 1 次会话 → 不出现；连续活跃不会把会话数刷上去', () => {
    ensureSeen(ACC, T0)
    markMilestone(ACC, 'onboardingDone', T0)
    expect(loadSupportState(ACC).sessions).toBe(1)
    expect(canShowNudge(ACC, at(10))).toBe(false)
    expect(evaluateNudge(ACC, at(10)).reason).toBe('sessions')

    // 每 5 分钟来一次、连续活跃 1 小时：仍算同一个会话
    for (let m = 5; m <= 60; m += 5) noteSession(ACC, T0 + m * MIN)
    expect(loadSupportState(ACC).sessions).toBe(1)
    expect(canShowNudge(ACC, at(10))).toBe(false)
  })

  it('间隔恰好 30 分钟不算新会话；超过 30 分钟才算', () => {
    ensureSeen(ACC, T0)
    markMilestone(ACC, 'onboardingDone', T0)
    noteSession(ACC, T0 + 30 * MIN) // gap = 30min，不是 > 30min
    expect(loadSupportState(ACC).sessions).toBe(1)
    expect(canShowNudge(ACC, at(10))).toBe(false)

    noteSession(ACC, T0 + 60 * MIN + 1) // 距上次 30min+1ms → 新会话
    expect(loadSupportState(ACC).sessions).toBe(2)
    expect(canShowNudge(ACC, at(10))).toBe(true)
  })

  it('直接隔 31 分钟即计为第 2 次会话', () => {
    ensureSeen(ACC, T0)
    markMilestone(ACC, 'backupExported', T0)
    noteSession(ACC, T0 + 31 * MIN)
    expect(loadSupportState(ACC).sessions).toBe(2)
    expect(canShowNudge(ACC, at(3))).toBe(true)
  })
})

describe('R3 里程碑（M1 或 M2，先到者）', () => {
  it('两个里程碑都没有 → 不出现；M1 或 M2 任一达成即可', () => {
    ensureSeen(ACC, T0)
    noteSession(ACC, T0 + 31 * MIN)
    expect(evaluateNudge(ACC, at(3)).reason).toBe('milestone')

    markMilestone(ACC, 'backupExported', at(3))
    expect(canShowNudge(ACC, at(3))).toBe(true)

    // 另一账号只完成 M1，同样满足
    ensureSeen(OTHER, T0)
    noteSession(OTHER, T0 + 31 * MIN)
    markMilestone(OTHER, 'onboardingDone', at(3))
    expect(canShowNudge(OTHER, at(3))).toBe(true)
  })
})

describe('里程碑写入辅助（M2 / 集成入口）', () => {
  it('noteBackupExported 显式 accountId：写入 M2 并自动建档', () => {
    noteBackupExported(ACC)
    const st = loadSupportState(ACC)
    expect(st.milestones.backupExported).toBe(true)
    expect(st.firstSeenAt).toBeGreaterThan(0)
  })

  it('noteBackupExported 缺省 accountId：从 info-mgmt-account-id 读取', () => {
    localStorage.setItem('info-mgmt-account-id', ACC)
    expect(currentAccountId()).toBe(ACC)
    noteBackupExported()
    expect(loadSupportState(ACC).milestones.backupExported).toBe(true)
  })

  it('没有登录账号时 noteBackupExported 安全 no-op，不写任何键', () => {
    expect(currentAccountId()).toBe('')
    expect(() => noteBackupExported()).not.toThrow()
    expect(loadSupportState(ACC).firstSeenAt).toBe(0)
  })
})

describe('R4 距上次展示 ≥ 30 天', () => {
  it('29 天不行、30 天整可以', () => {
    seedEligible()
    const shownAt = at(3)
    expect(markNudgeShown(ACC, shownAt)).toBe(true)
    expect(loadSupportState(ACC).shownCount).toBe(1)

    expect(canShowNudge(ACC, shownAt + 29 * DAY)).toBe(false)
    expect(evaluateNudge(ACC, shownAt + 29 * DAY).reason).toBe('cooldown')
    expect(canShowNudge(ACC, shownAt + 30 * DAY)).toBe(true)
  })
})

describe('R5 主动提示累计 ≤ 2 次', () => {
  it('第 2 次展示后进入永久静默（muted），此后 10 年也不再出现', () => {
    seedEligible()
    expect(markNudgeShown(ACC, at(3))).toBe(true)
    expect(markNudgeShown(ACC, at(3) + 35 * DAY)).toBe(true)
    expect(loadSupportState(ACC).shownCount).toBe(MAX_NUDGES)
    expect(loadSupportState(ACC).muted).toBe(true)

    expect(canShowNudge(ACC, at(3) + 3650 * DAY)).toBe(false)
    expect(evaluateNudge(ACC, at(3) + 3650 * DAY).reason).toBe('muted')
  })
})

describe('R6「稍后」顺延 90 天且只 1 次', () => {
  it('顺延 89 天不出现、满 90 天可再出现；第二次顺延即用尽', () => {
    seedEligible()
    const snoozedAt = at(3)
    snoozeNudge(ACC, snoozedAt)
    expect(loadSupportState(ACC).snoozeUsed).toBe(true)

    expect(canShowNudge(ACC, snoozedAt + 90 * DAY - 1)).toBe(false)
    expect(evaluateNudge(ACC, snoozedAt + 90 * DAY - 1).reason).toBe('snoozed')
    expect(canShowNudge(ACC, snoozedAt + 90 * DAY)).toBe(true)

    // 第二次「稍后」→ 视为用尽，永久静默
    snoozeNudge(ACC, snoozedAt + 91 * DAY)
    expect(loadSupportState(ACC).muted).toBe(true)
    expect(canShowNudge(ACC, snoozedAt + 1000 * DAY)).toBe(false)
  })
})

describe('R7「不再提示」永久静默', () => {
  it('mute 之后永远不会再出现，后续会话/里程碑也不会解除', () => {
    seedEligible()
    muteNudge(ACC, at(3))
    expect(canShowNudge(ACC, at(3) + 1 * DAY)).toBe(false)
    expect(evaluateNudge(ACC, at(3) + 1 * DAY).reason).toBe('muted')

    // 一年后再进应用、再达成里程碑，仍然是 muted
    noteSession(ACC, at(365))
    markMilestone(ACC, 'backupExported', at(365))
    ensureSeen(ACC, at(365))
    expect(canShowNudge(ACC, at(3650))).toBe(false)
  })
})

describe('R8 已支持永久静默', () => {
  it('markSupported 后 isSupported=true 且永不主动提示', () => {
    seedEligible()
    markSupported(ACC, at(3))
    expect(isSupported(ACC)).toBe(true)
    expect(loadSupportState(ACC).muted).toBe(true)
    expect(canShowNudge(ACC, at(3) + 3650 * DAY)).toBe(false)
    expect(evaluateNudge(ACC, at(3) + 3650 * DAY).reason).toBe('supported')
  })
})

describe('R9 一天最多 1 次（且由宿主在空闲回调后渲染）', () => {
  it('同一天重复 markNudgeShown 不重复计数，也不允许当天再次展示', () => {
    seedEligible()
    const morning = at(3) // 10:00
    const sameDayLater = at(3) + 60 * MIN // 11:00，同一本地日历日
    expect(markNudgeShown(ACC, morning)).toBe(true)
    expect(markNudgeShown(ACC, sameDayLater)).toBe(false)
    expect(loadSupportState(ACC).shownCount).toBe(1)

    expect(canShowNudge(ACC, sameDayLater)).toBe(false)
    expect(evaluateNudge(ACC, sameDayLater).reason).toBe('same-day')
  })

  it('跨过本地午夜（23:59 → 次日 00:01）即算新的一天', () => {
    // 以本地 23:59 为基准，避免测试受运行时区影响
    const lateNight = new Date(2026, 0, 12, 23, 59, 0).getTime()
    ensureSeen(ACC, lateNight - 3 * DAY)
    noteSession(ACC, lateNight - 3 * DAY + 31 * MIN)
    markMilestone(ACC, 'onboardingDone', lateNight - 3 * DAY)
    expect(markNudgeShown(ACC, lateNight)).toBe(true)
    expect(canShowNudge(ACC, lateNight + 2 * MIN)).toBe(false) // 仍然同一天
    expect(canShowNudge(ACC, lateNight + 2 * DAY)).toBe(false) // 次日，但 R4 未满 30 天
    expect(evaluateNudge(ACC, lateNight + 2 * DAY).reason).toBe('cooldown')
  })
})
