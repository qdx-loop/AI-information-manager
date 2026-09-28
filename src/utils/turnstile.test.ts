// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import {
  verifyTurnstile,
  isConfigured,
  expectedHostnames,
} from '../../functions/lib/turnstile'

/** 记录写入的 attempts 行，模拟 login_attempts 表 */
function makeDb(state: { health?: { count: number; window_start: number }; tableMissing?: boolean } = {}) {
  const rows = new Map<string, { count: number; window_start: number }>()
  if (state.health) rows.set('turnstile:health', { ...state.health })
  return {
    prepare(sql: string) {
      return {
        bind(...a: unknown[]) {
          return {
            async first() {
              if (state.tableMissing) throw new Error('no such table: login_attempts')
              if (sql.includes('FROM login_attempts')) return rows.get(String(a[0])) ?? null
              return null
            },
            async run() {
              if (state.tableMissing) throw new Error('no such table: login_attempts')
              if (sql.includes('INSERT INTO login_attempts')) {
                rows.set(String(a[0]), { count: Number(a[1]), window_start: Number(a[2]) })
              } else if (sql.includes('DELETE FROM login_attempts')) {
                rows.delete(String(a[0]))
              }
            },
          }
        },
      }
    },
    rows,
  }
}

const ENV = {
  TURNSTILE_SECRET: '0x-secret',
  TURNSTILE_HOSTNAMES: 'aiim.de5.net,info-manager.pages.dev',
}

describe('expectedHostnames / isConfigured', () => {
  it('按逗号切分并去空白', () => {
    expect([...expectedHostnames(ENV)]).toEqual(['aiim.de5.net', 'info-manager.pages.dev'])
  })
  it('缺少 secret 或 hostnames 任一都算未配置', () => {
    expect(isConfigured(ENV)).toBe(true)
    expect(isConfigured({ ...ENV, TURNSTILE_SECRET: '' })).toBe(false)
    expect(isConfigured({ ...ENV, TURNSTILE_HOSTNAMES: '' })).toBe(false)
  })
  it('空白项被忽略，全空白则视为未配置', () => {
    expect(isConfigured({ ...ENV, TURNSTILE_HOSTNAMES: ' , , ' })).toBe(false)
  })
})

describe('verifyTurnstile：未配置时', () => {
  it('直接放行（本地开发/未部署），交给 IP 限速兜底', async () => {
    const db = makeDb()
    const r = await verifyTurnstile({ DB: db } as never, undefined, 'signup', '1.2.3.4')
    expect(r.ok).toBe(true)
    expect(r.degraded).toBe(true)
    expect(r.reason).toBe('not_configured')
  })
})

describe('verifyTurnstile：正常路径（mock fetch）', () => {
  const realFetch = globalThis.fetch
  const setFetch = (impl: unknown) => {
    // @ts-expect-error 测试桩
    globalThis.fetch = impl
  }
  const siteverify = (body: unknown, ok = true) =>
    setFetch(async () => ({ ok, json: async () => body }))

  it('success + action 匹配 + host 白名单 → 放行，且清零故障计数', async () => {
    const db = makeDb({ health: { count: 2, window_start: Date.now() } })
    siteverify({ success: true, action: 'signup', hostname: 'aiim.de5.net' })
    const r = await verifyTurnstile({ ...ENV, DB: db } as never, 'tok', 'signup', '1.2.3.4')
    expect(r).toMatchObject({ ok: true, degraded: false })
    expect(db.rows.get('turnstile:health')).toBeUndefined()
  })

  it('success:false 是「判定」不是故障 → 必须拒绝', async () => {
    const db = makeDb()
    siteverify({ success: false, 'error-codes': ['invalid-input-response'] })
    const r = await verifyTurnstile({ ...ENV, DB: db } as never, 'tok', 'signup', '1.2.3.4')
    expect(r.ok).toBe(false)
    expect(r.code).toBe('TURNSTILE_FAILED')
  })

  it('action 不匹配 → 拒绝', async () => {
    const db = makeDb()
    siteverify({ success: true, action: 'contact', hostname: 'aiim.de5.net' })
    const r = await verifyTurnstile({ ...ENV, DB: db } as never, 'tok', 'signup', '1.2.3.4')
    expect(r.ok).toBe(false)
    expect(r.code).toBe('TURNSTILE_ACTION')
  })

  it('hostname 不在白名单 → 拒绝', async () => {
    const db = makeDb()
    siteverify({ success: true, action: 'signup', hostname: 'evil.example.com' })
    const r = await verifyTurnstile({ ...ENV, DB: db } as never, 'tok', 'signup', '1.2.3.4')
    expect(r.ok).toBe(false)
    expect(r.code).toBe('TURNSTILE_HOST')
  })

  it('siteverify 传输故障（抛错）→ 放行并累计一次故障', async () => {
    const db = makeDb()
    setFetch(async () => {
      throw new Error('network down')
    })
    const r = await verifyTurnstile({ ...ENV, DB: db } as never, 'tok', 'signup', '1.2.3.4')
    expect(r).toMatchObject({ ok: true, degraded: true, reason: 'verify_unavailable' })
    expect(db.rows.get('turnstile:health')?.count).toBe(1)
  })

  it('siteverify 非 2xx → 同样按故障放行', async () => {
    const db = makeDb()
    siteverify({}, false)
    const r = await verifyTurnstile({ ...ENV, DB: db } as never, 'tok', 'signup', '1.2.3.4')
    expect(r.ok).toBe(true)
    expect(db.rows.get('turnstile:health')?.count).toBe(1)
  })

  it('健康计数表缺失时仍能校验（fail-open 降级不阻断）', async () => {
    const db = makeDb({ tableMissing: true })
    siteverify({ success: true, action: 'signup', hostname: 'aiim.de5.net' })
    const r = await verifyTurnstile({ ...ENV, DB: db } as never, 'tok', 'signup', '1.2.3.4')
    expect(r.ok).toBe(true)
  })

  afterEach(() => setFetch(realFetch))
})

describe('verifyTurnstile：缺 token 时不能被机器人白嫖', () => {
  const env = (health?: { count: number; window_start: number }) => {
    const db = makeDb(health ? { health } : {})
    return { env: { ...ENV, DB: db } as never, db }
  }

  it('健康时缺 token → 拒绝（机器人无法靠不传 token 绕过）', async () => {
    const { env: e } = env()
    const r = await verifyTurnstile(e, '', 'signup', '1.2.3.4')
    expect(r.ok).toBe(false)
    expect(r.code).toBe('TURNSTILE_REQUIRED')
  })

  it('超长 token → 拒绝', async () => {
    const { env: e } = env()
    const r = await verifyTurnstile(e, 'x'.repeat(2049), 'signup', '1.2.3.4')
    expect(r.ok).toBe(false)
    expect(r.code).toBe('TURNSTILE_INVALID')
  })

  it('连续故障未达阈值 → 仍然拒绝缺 token', async () => {
    const { env: e } = env({ count: 2, window_start: Date.now() })
    const r = await verifyTurnstile(e, '', 'signup', '1.2.3.4')
    expect(r.ok).toBe(false)
    expect(r.code).toBe('TURNSTILE_REQUIRED')
  })

  it('已达阈值且在窗口内 → 降级放行（真人不会被第三方故障挡住）', async () => {
    const { env: e } = env({ count: 3, window_start: Date.now() })
    const r = await verifyTurnstile(e, '', 'signup', '1.2.3.4')
    expect(r).toMatchObject({ ok: true, degraded: true, reason: 'degraded' })
  })

  it('故障数够但已超出降级窗口 → 恢复强制校验（防止永久降级）', async () => {
    const { env: e } = env({ count: 99, window_start: Date.now() - 61 * 60_000 })
    const r = await verifyTurnstile(e, '', 'signup', '1.2.3.4')
    expect(r.ok).toBe(false)
    expect(r.code).toBe('TURNSTILE_REQUIRED')
  })
})
