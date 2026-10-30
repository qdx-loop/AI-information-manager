// @vitest-environment node
// handler 级集成测试：直接调用 Functions 的 onRequestPost/onRequest，用内存 mock 顶替 env.DB。
//
// 为什么必须测 handler：functions/** 不参与 tsc（tsconfig 只 include src），lib 级测试
// 发现不了「handler 用了 requireUser 没返回的字段」这类缺陷——P1-1（改密 100% 失败）
// 就是这样从 CI 眼皮底下溜过去的。这里把审计里的复现步骤固化成回归网。
import { describe, it, expect } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  issueUserToken,
} from '../../functions/lib/_auth'

// functions/api/**.js 没有 .d.ts、也不在 tsc 的 include 里；运行时由 vitest/esbuild 解析 .js。
// 类型层面显式放行（否则 tsc -b 会以 TS7016 报错）。
// @ts-expect-error - 无类型声明的 Pages Functions 处理器
import { onRequestPost as changePassword } from '../../functions/api/auth/password.js'
// @ts-expect-error - 无类型声明的 Pages Functions 处理器
import { onRequestPost as login } from '../../functions/api/auth/login.js'
// @ts-expect-error - 无类型声明的 Pages Functions 处理器
import { onRequestPost as register } from '../../functions/api/auth/register.js'
// @ts-expect-error - 无类型声明的 Pages Functions 处理器
import { onRequestPost as adminLogin } from '../../functions/api/admin/login.js'
// @ts-expect-error - 无类型声明的 Pages Functions 处理器
import { onRequestPost as track } from '../../functions/api/track.js'
// @ts-expect-error - 无类型声明的 Pages Functions 处理器
import { onRequestPost as fetchUrl } from '../../functions/api/ai/fetch.js'
// @ts-expect-error - 无类型声明的 Pages Functions 处理器
import { onRequest as signal } from '../../functions/api/sync/signal.js'

const SECRET = 'handler-test-secret-0123456789abcdef' // 34 字符，满足 MIN_AUTH_SECRET_LEN
const IP = '203.0.113.7'

// ———— 最小 D1 mock：按 SQL 分支路由，账户/限速桶/信令表都在内存里 ————

type Row = Record<string, any>

interface DbSeed {
  accounts?: Row[]
  signals?: Row[]
  /** 让 p2p_signals 相关语句抛一个「原始 DB 错误」，用于验证错误信息不泄露 */
  throwOnSignal?: boolean
}

// 按 SELECT 子句里的列名投影，保证「SELECT 漏列」的缺陷能被测出来（而不是 mock 全量返回蒙混过关）
function project(sql: string, row: Row | null | undefined) {
  if (!row) return null
  const m = /SELECT\s+([\s\S]+?)\s+FROM/i.exec(sql)
  if (!m) return { ...row }
  const cols = m[1]
    .split(',')
    .map((c) => c.trim().split(/\s+/)[0])
    .filter(Boolean)
  const out: Row = {}
  for (const c of cols) out[c] = row[c]
  return out
}

function makeDb(seed: DbSeed = {}) {
  const accounts = seed.accounts ?? []
  const signals = seed.signals ?? []
  const attempts = new Map<string, { count: number; window_start: number }>()
  const events: Row[] = []

  function prepare(rawSql: string) {
    const sql = rawSql.replace(/\s+/g, ' ').trim()
    // 模拟「未预期异常」：错误信息里带表名/SQL 细节，断言它不该出现在响应里
    if (seed.throwOnSignal && sql.includes('p2p_signals')) {
      throw new Error('D1_ERROR: SQLITE_ERROR: no such column: internal_marker')
    }
    return {
      bind(...args: any[]) {
        return {
          async first() {
            if (/FROM accounts/i.test(sql)) {
              if (/username = \?/i.test(sql)) {
                const row = accounts.find(
                  (a) => String(a.username).toLowerCase() === String(args[0]).toLowerCase(),
                )
                return project(sql, row)
              }
              return project(sql, accounts.find((a) => a.id === args[0]))
            }
            if (/FROM login_attempts/i.test(sql)) {
              const row = attempts.get(String(args[0]))
              return row ? { ...row } : null
            }
            if (/FROM p2p_signals/i.test(sql)) {
              const row = signals.find((r) => {
                if (r.id !== args[0] || r.account_id !== args[1]) return false
                // guest 回写要求行未过期：查询里带 created_at >= ? 时按截止时间过滤
                if (sql.includes('created_at >=')) return Number(r.created_at) >= Number(args[2])
                return true
              })
              return project(sql, row)
            }
            return null
          },
          async run() {
            if (/INSERT INTO login_attempts/i.test(sql)) {
              attempts.set(String(args[0]), { count: 1, window_start: Number(args[1]) })
            } else if (/UPDATE login_attempts SET count = count \+ 1/i.test(sql)) {
              const cur = attempts.get(String(args[0]))
              if (cur) cur.count += 1
            } else if (/DELETE FROM login_attempts/i.test(sql)) {
              attempts.delete(String(args[0]))
            } else if (/UPDATE accounts SET password_hash = \? WHERE id = \?/i.test(sql)) {
              const acc = accounts.find((a) => a.id === args[1])
              if (acc) acc.password_hash = args[0]
            } else if (/UPDATE accounts SET pwd_epoch = COALESCE/i.test(sql)) {
              const acc = accounts.find((a) => a.id === args[0])
              if (acc) acc.pwd_epoch = Number(acc.pwd_epoch ?? 0) + 1
            } else if (/UPDATE accounts SET last_login/i.test(sql)) {
              const acc = accounts.find((a) => a.id === args[1])
              if (acc) acc.last_login = args[0]
            } else if (/INSERT INTO analytics_events/i.test(sql)) {
              events.push({ account_id: args[0], name: args[1], props: args[2], created_at: args[3] })
            } else if (/INSERT INTO p2p_signals/i.test(sql)) {
              signals.push({
                id: args[0],
                account_id: args[1],
                device_id: args[2],
                role: 'host',
                offer: args[3],
                answer: null,
                status: 'waiting',
                created_at: args[4],
              })
            } else if (/UPDATE p2p_signals SET answer/i.test(sql)) {
              const row = signals.find((r) => r.id === args[1])
              if (row) {
                row.answer = args[0]
                row.status = 'done'
              }
            } else if (/UPDATE p2p_signals SET status = 'cancelled'/i.test(sql)) {
              for (const r of signals) {
                if (r.account_id === args[0] && r.device_id === args[1]) r.status = 'cancelled'
              }
            } else if (/DELETE FROM p2p_signals/i.test(sql)) {
              const accountId = args[args.length - 1]
              for (let i = signals.length - 1; i >= 0; i--) {
                if (signals[i].account_id === accountId) signals.splice(i, 1)
              }
            }
            return {}
          },
          async all() {
            return { results: [] }
          },
        }
      },
    }
  }

  return { DB: { prepare }, attempts, accounts, signals, events }
}

function makeRequest(
  path: string,
  method: string,
  body?: unknown,
  opts: { token?: string; ip?: string } = {},
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'CF-Connecting-IP': opts.ip ?? IP,
  }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  return new Request(`https://app.example.com${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function jsonOf(res: Response) {
  return (await res.json()) as Record<string, any>
}

// 建一个可登录的账户 + 对应令牌；返回可被断言的可变行对象
async function accountFixture(username = 'tiger4821', password = 'right-password-1') {
  const db = makeDb({
    accounts: [
      {
        id: 'acc-1',
        username,
        password_hash: await hashPassword(password),
        contact: null,
        disabled: 0,
        created_at: Date.now(),
        last_login: null,
        pwd_epoch: 0,
      },
    ],
  })
  const env = { DB: db.DB, AUTH_SECRET: SECRET }
  const token = await issueUserToken(db.accounts[0] as { id: string }, SECRET, env)
  return { db, env, token, acc: db.accounts[0] }
}

// ———— 1. P1-1 改密接口 ————
describe('POST /api/auth/password（handler 级）', () => {
  it('旧密码错误 → 403 WRONG_OLD，且不改任何密码数据', async () => {
    const { env, token, acc } = await accountFixture()
    const before = acc.password_hash
    const res = await changePassword({
      request: makeRequest('/api/auth/password', 'POST', {
        oldPassword: 'not-the-right-password',
        newPassword: 'new-password-1',
      }, { token }),
      env,
    })
    expect(res.status).toBe(403)
    expect(await jsonOf(res)).toMatchObject({ code: 'WRONG_OLD' })
    expect(acc.password_hash).toBe(before)
    expect(acc.pwd_epoch).toBe(0)
  })

  it('旧密码正确 → 200，password_hash 更新且 pwd_epoch 自增（吊销旧令牌）', async () => {
    const { env, token, acc } = await accountFixture()
    const before = acc.password_hash
    const res = await changePassword({
      request: makeRequest('/api/auth/password', 'POST', {
        oldPassword: 'right-password-1',
        newPassword: 'new-password-2',
      }, { token }),
      env,
    })
    expect(res.status).toBe(200)
    expect(await jsonOf(res)).toMatchObject({ ok: true })
    expect(acc.password_hash).not.toBe(before)
    expect(await verifyPassword('new-password-2', acc.password_hash)).toBe(true)
    expect(acc.pwd_epoch).toBe(1)
  })

  it('缺字段/畸形请求回归：400 或 403，绝不是 500', async () => {
    const { env, token } = await accountFixture()

    const empty = await changePassword({
      request: makeRequest('/api/auth/password', 'POST', {}, { token }),
      env,
    })
    expect(empty.status).toBe(400)
    expect((await jsonOf(empty)).code).toBe('WEAK_PASSWORD')

    const missingOld = await changePassword({
      request: makeRequest('/api/auth/password', 'POST', { newPassword: 'valid-new-pw' }, { token }),
      env,
    })
    expect(missingOld.status).toBe(403)
    expect((await jsonOf(missingOld)).code).toBe('WRONG_OLD')

    const badJson = await changePassword({
      request: makeRequest('/api/auth/password', 'POST', '{not json', { token }),
      env,
    })
    expect(badJson.status).toBe(400)
    expect((await jsonOf(badJson)).code).toBe('BAD_BODY')
  })
})

// ———— 2. P1-2 登录成功不得清 IP 限速桶 ————
describe('POST /api/auth/login（handler 级限速桶）', () => {
  it('成功登录只清 user 桶；IP 桶继续累积（试 9 次→登录自己→续试 的绕过被堵住）', async () => {
    const { db, env } = await accountFixture('tiger4821', 'right-password-1')
    const userAttempts = () => db.attempts.get(`user:tiger4821:${IP}`)
    const ipAttempts = () => db.attempts.get(`loginip:${IP}`)

    const attempt = (pwd: string) =>
      login({
        request: makeRequest('/api/auth/login', 'POST', {
          username: 'tiger4821',
          password: pwd,
        }),
        env,
      })

    // 先失败 3 次：两个桶都计数
    for (let i = 0; i < 3; i++) {
      const res = await attempt('wrong-password')
      expect(res.status).toBe(401)
    }
    expect(userAttempts()?.count).toBe(3)
    expect(ipAttempts()?.count).toBe(3)

    // 登录自己的账号（成功）：user 桶清零，IP 桶必须原样保留
    const ok = await attempt('right-password-1')
    expect(ok.status).toBe(200)
    expect((await jsonOf(ok)).token).toBeTruthy()
    expect(userAttempts()).toBeUndefined()
    expect(ipAttempts()?.count).toBe(3)

    // 继续试：IP 桶从 3 继续涨到 6，说明成功登录没有把它重置
    for (let i = 0; i < 3; i++) await attempt('wrong-password')
    expect(ipAttempts()?.count).toBe(6)
  })
})

// ———— 4. P1-7 AUTH_SECRET 缺失/过短：所有签发/校验入口 fail-closed ————
describe('AUTH_SECRET fail-closed（handler 级）', () => {
  it('登录：缺失 → 503 SERVER_MISCONFIGURED', async () => {
    const { db } = await accountFixture()
    const res = await login({
      request: makeRequest('/api/auth/login', 'POST', { username: 'tiger4821', password: 'x' }),
      env: { DB: db.DB }, // 漏配 AUTH_SECRET
    })
    expect(res.status).toBe(503)
    expect(await jsonOf(res)).toMatchObject({ code: 'SERVER_MISCONFIGURED' })
  })

  it('注册：缺失 → 503（不能等到 issueUserToken 抛错变 500）', async () => {
    const res = await register({
      request: makeRequest('/api/auth/register', 'POST', {
        username: 'newuser',
        password: 'abcd1234',
      }),
      env: {},
    })
    expect(res.status).toBe(503)
    expect(await jsonOf(res)).toMatchObject({ code: 'SERVER_MISCONFIGURED' })
  })

  it('后台登录：密码已配置但 AUTH_SECRET 缺失 → 503', async () => {
    const res = await adminLogin({
      request: makeRequest('/api/admin/login', 'POST', { password: 'admin-pass' }),
      env: { ADMIN_PASSWORD: 'admin-pass' },
    })
    expect(res.status).toBe(503)
    expect(await jsonOf(res)).toMatchObject({ code: 'SERVER_MISCONFIGURED' })
  })

  it('改密（requireUser 校验入口）：缺失 → 503；过短 → 503', async () => {
    const { db, token } = await accountFixture()
    const req = () =>
      makeRequest('/api/auth/password', 'POST', {
        oldPassword: 'right-password-1',
        newPassword: 'new-password-1',
      }, { token })

    const missing = await changePassword({ request: req(), env: { DB: db.DB } })
    expect(missing.status).toBe(503)

    const short = await changePassword({
      request: req(),
      env: { DB: db.DB, AUTH_SECRET: 'too-short-secret' },
    })
    expect(short.status).toBe(503)
    expect(await jsonOf(short)).toMatchObject({ code: 'SERVER_MISCONFIGURED' })
  })

  it('错误响应/日志里不得包含 secret 本身', async () => {
    const { db } = await accountFixture()
    const badSecret = 'x'.repeat(10)
    const res = await login({
      request: makeRequest('/api/auth/login', 'POST', { username: 'tiger4821', password: 'x' }),
      env: { DB: db.DB, AUTH_SECRET: badSecret },
    })
    const text = await res.text()
    expect(text).not.toContain(badSecret)
  })
})

// ———— 3. P1-4/P2-1 /api/track、/api/ai/fetch 限速 ————
describe('新增限速（handler 级）', () => {
  it('/api/track：超过 TRACK_RATE_MAX 返回 429 RATE_LIMITED，且只写入被允许的事件', async () => {
    const { db, env, token } = await accountFixture()
    const rateEnv = { ...env, TRACK_RATE_MAX: '2' }
    const send = () =>
      track({
        request: makeRequest('/api/track', 'POST', { name: 'login' }, { token }),
        env: rateEnv,
      })

    expect((await send()).status).toBe(200)
    expect((await send()).status).toBe(200)
    const blocked = await send()
    expect(blocked.status).toBe(429)
    expect(await jsonOf(blocked)).toMatchObject({ code: 'RATE_LIMITED' })
    expect(db.events).toHaveLength(2)
  })

  it('/api/ai/fetch：超过 FETCH_RATE_MAX 返回 429（限速在校验 URL 之前，不触发出站请求）', async () => {
    const { env, token } = await accountFixture()
    const rateEnv = { ...env, FETCH_RATE_MAX: '2' }
    const send = () =>
      fetchUrl({
        request: makeRequest('/api/ai/fetch', 'POST', { url: '' }, { token }),
        env: rateEnv,
      })

    // 空 URL → 400 BAD_URL，但已经计入限速
    expect((await send()).status).toBe(400)
    expect((await send()).status).toBe(400)
    const blocked = await send()
    expect(blocked.status).toBe(429)
    expect(await jsonOf(blocked)).toMatchObject({ code: 'RATE_LIMITED' })
  })
})

// ———— 7. /api/sync/signal：错误信息不泄露 + 长度上限 + guest 过期校验 ————
describe('/api/sync/signal（handler 级）', () => {
  it('未预期异常返回固定文案，不拼接原始 DB 错误', async () => {
    const db = makeDb({
      accounts: [
        {
          id: 'acc-1',
          username: 'tiger4821',
          password_hash: 'pbkdf2$x',
          contact: null,
          disabled: 0,
          created_at: Date.now(),
          last_login: null,
          pwd_epoch: 0,
        },
      ],
      throwOnSignal: true,
    })
    const env = { DB: db.DB, AUTH_SECRET: SECRET }
    const token = await issueUserToken(db.accounts[0] as { id: string }, SECRET, env)
    const res = await signal({
      request: makeRequest('/api/sync/signal?deviceId=dev-1', 'GET', undefined, { token }),
      env,
    })
    expect(res.status).toBe(500)
    const data = await jsonOf(res)
    expect(data.code).toBe('SIGNAL_INTERNAL')
    expect(data.error).toBe('信令服务异常，请稍后重试')
    expect(JSON.stringify(data)).not.toContain('SQLITE')
    expect(JSON.stringify(data)).not.toContain('internal_marker')
  })

  it('guest 回写：行已过期 → 409 STALE（不再靠 GET 清理兜底）', async () => {
    const { db, env, token } = await accountFixture()
    db.signals.push({
      id: 'sig-stale',
      account_id: 'acc-1',
      device_id: 'host-dev',
      role: 'host',
      offer: 'v=0',
      answer: null,
      status: 'waiting',
      created_at: Date.now() - 11 * 60_000, // 超过 10 分钟 TTL
    })
    const res = await signal({
      request: makeRequest('/api/sync/signal', 'POST', {
        role: 'guest',
        deviceId: 'guest-dev',
        rowId: 'sig-stale',
        answer: 'v=0 answer',
      }, { token }),
      env,
    })
    expect(res.status).toBe(409)
    expect(await jsonOf(res)).toMatchObject({ code: 'STALE' })
    expect(db.signals[0].status).toBe('waiting') // 未被回写
  })

  it('offer 超过 64KB → 413 TOO_LARGE；deviceId 超长 → 400', async () => {
    const { env, token } = await accountFixture()
    const tooLarge = await signal({
      request: makeRequest('/api/sync/signal', 'POST', {
        role: 'host',
        deviceId: 'dev-1',
        offer: 'x'.repeat(64 * 1024 + 1),
      }, { token }),
      env,
    })
    expect(tooLarge.status).toBe(413)
    expect((await jsonOf(tooLarge)).code).toBe('TOO_LARGE')

    const badDevice = await signal({
      request: makeRequest('/api/sync/signal', 'POST', {
        role: 'host',
        deviceId: 'd'.repeat(129),
        offer: 'v=0',
      }, { token }),
      env,
    })
    expect(badDevice.status).toBe(400)
    expect((await jsonOf(badDevice)).code).toBe('BAD_DEVICE_ID')
  })
})
