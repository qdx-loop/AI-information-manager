// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { issueUserToken, verifyToken, requireUser, checkWindowCount } from '../../functions/lib/_auth'

// 最小 D1 mock：按 SQL 子串路由，内存保存 accounts / login_attempts 状态
interface DbState {
  pwdEpoch?: number
  pwdEpochColumnMissing?: boolean
  attemptsTableMissing?: boolean
  account?: Record<string, unknown> | null
}
function makeDb(state: DbState = {}) {
  const attempts = new Map<string, { count: number; window_start: number }>()
  const account =
    state.account === undefined
      ? {
          id: 'acc-1',
          username: 'tiger4821',
          password_hash: 'pbkdf2$x',
          expires_at: Date.now() + 86_400_000,
          disabled: 0,
          created_at: Date.now(),
          last_login: null,
        }
      : state.account
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first() {
              if (sql.includes('SELECT pwd_epoch FROM accounts')) {
                if (state.pwdEpochColumnMissing) throw new Error('no such column: pwd_epoch')
                return { pwd_epoch: state.pwdEpoch ?? 0 }
              }
              if (sql.includes('FROM accounts WHERE id')) return account
              if (sql.includes('SELECT count, window_start FROM login_attempts')) {
                if (state.attemptsTableMissing) throw new Error('no such table: login_attempts')
                return attempts.get(String(args[0])) ?? null
              }
              return null
            },
            async run() {
              if (state.attemptsTableMissing) throw new Error('no such table: login_attempts')
              if (sql.includes('INSERT INTO login_attempts')) {
                attempts.set(String(args[0]), { count: 1, window_start: Number(args[1]) })
              } else if (sql.includes('UPDATE login_attempts SET count = count + 1')) {
                const cur = attempts.get(String(args[0]))
                if (cur) cur.count += 1
              }
              return {}
            },
            async all() {
              return { results: [] }
            },
          }
        },
      }
    },
  }
  return { db, attempts }
}

function makeRequest(token: string | null) {
  return {
    headers: {
      get(name: string) {
        if (name === 'Authorization') return token ? `Bearer ${token}` : null
        return null
      },
    },
  }
}

const SECRET = 'test-auth-secret'
const freshAccount = () => ({ id: 'acc-1', expires_at: Date.now() + 86_400_000 })

describe('改密吊销令牌（pwd_epoch 纪元）', () => {
  it('签发的令牌携带当前密码纪元', async () => {
    const { db } = makeDb({ pwdEpoch: 3 })
    const token = await issueUserToken(freshAccount(), SECRET, { DB: db })
    const payload = await verifyToken(token, SECRET)
    expect(payload?.pe).toBe(3)
  })

  it('纪元一致时放行', async () => {
    const state = { pwdEpoch: 2 }
    const { db } = makeDb(state)
    const env = { DB: db, AUTH_SECRET: SECRET }
    const token = await issueUserToken(freshAccount(), SECRET, env)
    const res = await requireUser(makeRequest(token), env)
    expect(res.account).toBeDefined()
    expect(res.error).toBeUndefined()
  })

  it('改密后（纪元 +1）旧令牌被拒绝', async () => {
    const state = { pwdEpoch: 0 }
    const { db } = makeDb(state)
    const env = { DB: db, AUTH_SECRET: SECRET }
    const token = await issueUserToken(freshAccount(), SECRET, env) // 签发时 pe=0
    state.pwdEpoch = 1 // 模拟改密递增纪元
    const res = await requireUser(makeRequest(token), env)
    expect(res.error).toBeDefined()
    expect(res.account).toBeUndefined()
  })

  it('改密后重新登录得到的新令牌可用', async () => {
    const state = { pwdEpoch: 0 }
    const { db } = makeDb(state)
    const env = { DB: db, AUTH_SECRET: SECRET }
    state.pwdEpoch = 1 // 已改密
    const newToken = await issueUserToken(freshAccount(), SECRET, env) // 新令牌 pe=1
    const res = await requireUser(makeRequest(newToken), env)
    expect(res.account).toBeDefined()
  })

  it('pwd_epoch 列缺失（未迁移）时 fail-open，不阻断登录', async () => {
    const state = { pwdEpochColumnMissing: true }
    const { db } = makeDb(state)
    const env = { DB: db, AUTH_SECRET: SECRET }
    const token = await issueUserToken(freshAccount(), SECRET, env) // pe=0（fail-open）
    const res = await requireUser(makeRequest(token), env)
    expect(res.account).toBeDefined()
    expect(res.error).toBeUndefined()
  })
})

describe('通用窗口限速 checkWindowCount', () => {
  it('允许到上限，超出后拒绝并给出等待分钟', async () => {
    const { db } = makeDb()
    const env = { DB: db }
    const key = 'ai:acc-1'
    for (let i = 0; i < 3; i++) {
      const r = await checkWindowCount(env, key, 3, 60_000)
      expect(r.allowed).toBe(true)
    }
    const blocked = await checkWindowCount(env, key, 3, 60_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.waitMin).toBeGreaterThanOrEqual(1)
  })

  it('不同 key 互不影响', async () => {
    const { db } = makeDb()
    const env = { DB: db }
    for (let i = 0; i < 3; i++) await checkWindowCount(env, 'ai:a', 3, 60_000)
    expect((await checkWindowCount(env, 'ai:a', 3, 60_000)).allowed).toBe(false)
    expect((await checkWindowCount(env, 'ai:b', 3, 60_000)).allowed).toBe(true)
  })

  it('窗口过期后计数重置', async () => {
    const { db, attempts } = makeDb()
    const env = { DB: db }
    const key = 'ai:acc-1'
    for (let i = 0; i < 3; i++) await checkWindowCount(env, key, 3, 60_000)
    expect((await checkWindowCount(env, key, 3, 60_000)).allowed).toBe(false)
    // 把窗口起点拨到过去，模拟窗口过期
    attempts.get(key)!.window_start = Date.now() - 120_000
    expect((await checkWindowCount(env, key, 3, 60_000)).allowed).toBe(true)
  })

  it('login_attempts 表缺失（未迁移）时 fail-open 放行', async () => {
    const { db } = makeDb({ attemptsTableMissing: true })
    const env = { DB: db }
    const r = await checkWindowCount(env, 'ai:acc-1', 1, 60_000)
    expect(r.allowed).toBe(true)
  })
})
