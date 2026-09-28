// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  issueUserToken,
  verifyToken,
  requireUser,
  checkWindowCount,
  validateRegistration,
  publicAccount,
  MIN_PASSWORD,
} from '../../functions/lib/_auth'

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
          contact: null,
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

// ———— 自助注册参数校验 ————
describe('validateRegistration', () => {
  it('接受合法用户名/密码，并裁掉首尾空白', () => {
    const r = validateRegistration({ username: '  zhangsan_01  ', password: 'abcd1234' })
    expect(r.ok).toBe(true)
    expect(r.value).toEqual({ username: 'zhangsan_01', password: 'abcd1234', contact: null })
  })
  it('联系方式选填：非字符串与超长都处理掉', () => {
    expect(validateRegistration({ username: 'a_b1', password: 'abcd1234' }).value!.contact).toBeNull()
    expect(validateRegistration({ username: 'a_b1', password: 'abcd1234', contact: '  ' }).value!.contact).toBeNull()
    const long = 'x'.repeat(121)
    const r = validateRegistration({ username: 'a_b1', password: 'abcd1234', contact: long })
    expect(r.ok).toBe(false)
    expect(r.field).toBe('contact')
  })
  it('拒绝空用户名', () => {
    const r = validateRegistration({ username: '   ', password: 'abcd1234' })
    expect(r.ok).toBe(false)
    expect(r.field).toBe('username')
  })
  it('拒绝非法用户名：太短 / 空格 / 中文 / 符号 / 超长', () => {
    for (const u of ['ab', 'has space', '用户名', 'a-b', 'x'.repeat(21)]) {
      const r = validateRegistration({ username: u, password: 'abcd1234' })
      expect(r.ok, u).toBe(false)
      expect(r.field).toBe('username')
    }
  })
  it('拒绝短于下限的密码（自助注册下限高于登录的 6 位）', () => {
    const short = 'a'.repeat(MIN_PASSWORD - 1)
    const r = validateRegistration({ username: 'zhangsan', password: short })
    expect(r.ok).toBe(false)
    expect(r.field).toBe('password')
    expect(validateRegistration({ username: 'zhangsan', password: 'a'.repeat(MIN_PASSWORD) }).ok).toBe(true)
  })
  it('拒绝空密码与超长密码', () => {
    expect(validateRegistration({ username: 'zhangsan', password: '' }).ok).toBe(false)
    expect(validateRegistration({ username: 'zhangsan', password: 'a'.repeat(201) }).ok).toBe(false)
  })
  it('非字符串输入不会抛异常', () => {
    for (const body of [null, undefined, {}, { username: 123, password: {} }, { username: 'ok_user', password: ['a'] }]) {
      const r = validateRegistration(body)
      expect(typeof r.ok).toBe('boolean')
      if (!r.ok) expect(typeof r.message).toBe('string')
    }
  })
})

// ———— 账户不再有过期时间 ————
describe('publicAccount（无到期字段）', () => {
  it('只暴露身份字段，不含 expiresAt', () => {
    const acc = publicAccount({
      id: 'acc-1',
      username: 'zhangsan',
      contact: 'a@b.com',
      created_at: 111,
      last_login: 222,
      disabled: 1,
    })
    expect(acc).toEqual({
      id: 'acc-1',
      username: 'zhangsan',
      contact: 'a@b.com',
      createdAt: 111,
      disabled: true,
      lastLogin: 222,
    })
    expect('expiresAt' in acc).toBe(false)
  })
})
