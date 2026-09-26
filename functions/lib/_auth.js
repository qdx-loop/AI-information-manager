// 共享工具：密码哈希、令牌签发/校验、卡种定义、D1 访问辅助
// 注意：下划线开头的目录不会被 Cloudflare Pages 当作路由

const ITERATIONS = 100000
const TOKEN_TTL_USER = 7 * 24 * 3600 // 用户令牌最长 7 天，到期前需重新登录
const TOKEN_TTL_ADMIN = 12 * 3600 // 管理后台令牌 12 小时
// 到期后 7 天「只读宽限期」：允许登录与导出，客户端据此进入只读模式（留存设计）
export const GRACE_MS = 7 * 86400000

export const CARD_TYPES = {
  trial: { days: 3, label: '体验卡(3天)' },
  month: { days: 30, label: '月卡(30天)' },
  quarter: { days: 90, label: '季卡(90天)' },
  halfYear: { days: 180, label: '半年卡(180天)' },
  year: { days: 365, label: '年卡(365天)' },
}

// ———— 基础工具 ————

function bytesToHex(buf) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// 常量时间十六进制比较（仅对等长串有效），消除比较分支带来的理论时序差
export function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// 归一化任意字符串为等长摘要，便于对不等长口令做常量时间比较
export async function sha256Hex(s) {
  const bits = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)))
  return bytesToHex(bits)
}

export function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function errorJson(message, status = 400, code = 'ERROR') {
  return json({ error: message, code }, status)
}

// ———— 密码哈希（PBKDF2-SHA256）————

async function pbkdf2(password, saltBytes, iterations) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    key,
    256,
  )
}

export async function hashPassword(password, saltHex = null) {
  const salt = saltHex
    ? Uint8Array.from(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)))
    : crypto.getRandomValues(new Uint8Array(16))
  const bits = await pbkdf2(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(bits)}`
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, iterStr, saltHex, hashHex] = String(stored).split('$')
    if (scheme !== 'pbkdf2') return false
    const salt = Uint8Array.from(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)))
    const bits = await pbkdf2(password, salt, Number(iterStr))
    return timingSafeEqualHex(bytesToHex(bits), hashHex.toLowerCase())
  } catch {
    return false
  }
}

// ———— 无状态令牌（HMAC-SHA256 签名，无需会话表）————

async function hmac(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return bytesToHex(sig)
}

export async function signToken(payloadObj, secret) {
  const payload = b64urlEncode(JSON.stringify(payloadObj))
  const sig = await hmac(payload, secret)
  return `${payload}.${sig}`
}

export async function verifyToken(token, secret) {
  if (typeof token !== 'string' || !token.includes('.')) return null
  const [payload, sig] = token.split('.')
  const expect = await hmac(payload, secret)
  if (!timingSafeEqualHex(sig, expect)) return null
  try {
    let bin = payload.replace(/-/g, '+').replace(/_/g, '/')
    while (bin.length % 4) bin += '='
    const obj = JSON.parse(atob(bin))
    if (!obj.exp || Date.now() / 1000 > obj.exp) return null
    return obj
  } catch {
    return null
  }
}

export function userTokenExpiry(accountExpiresAtMs) {
  // 令牌有效期覆盖到宽限期结束，避免到期后令牌先于宽限期失效
  const cap = Math.floor((accountExpiresAtMs + GRACE_MS) / 1000)
  const ttl = Math.floor(Date.now() / 1000) + TOKEN_TTL_USER
  return Math.min(cap, ttl)
}

// 读取账户密码纪元；列不存在（未迁移）时返回 0，保证旧部署不受影响（fail-open）
async function getPwdEpoch(env, accountId) {
  try {
    const row = await env.DB.prepare('SELECT pwd_epoch FROM accounts WHERE id = ?')
      .bind(accountId)
      .first()
    return Number(row?.pwd_epoch ?? 0)
  } catch {
    return 0
  }
}

export async function issueUserToken(account, secret, env = null) {
  const pe = env ? await getPwdEpoch(env, account.id) : 0
  return signToken({ t: 'user', aid: account.id, pe, exp: userTokenExpiry(account.expires_at) }, secret)
}

export async function issueAdminToken(secret) {
  return signToken({ t: 'admin', exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_ADMIN }, secret)
}

function getBearer(request) {
  const h = request.headers.get('Authorization') || ''
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

// 校验用户令牌 + 账户状态。成功返回账户行；失败返回 Response。
export async function requireUser(request, env) {
  const token = getBearer(request)
  if (!token) return { error: errorJson('未登录', 401, 'NO_TOKEN') }
  const payload = await verifyToken(token, env.AUTH_SECRET)
  if (!payload || payload.t !== 'user') return { error: errorJson('登录已失效，请重新登录', 401, 'BAD_TOKEN') }
  const acc = await env.DB.prepare(
    'SELECT id, username, password_hash, expires_at, disabled, created_at, last_login FROM accounts WHERE id = ?',
  )
    .bind(payload.aid)
    .first()
  if (!acc) return { error: errorJson('账户不存在', 401, 'NO_ACCOUNT') }
  if (acc.disabled) return { error: errorJson('账户已被停用，请联系管理员', 403, 'DISABLED') }
  // 宽限期内仍放行（客户端进入只读）；超过宽限期才彻底拒绝
  if (Date.now() > acc.expires_at + GRACE_MS) {
    return { error: errorJson('您的账户已到期，请联系管理员续费', 403, 'EXPIRED') }
  }
  // 改密吊销：令牌签发时的密码纪元与当前不一致即失效（未迁移时两侧均为 0，自动放行）
  const currentEpoch = await getPwdEpoch(env, payload.aid)
  if ((payload.pe ?? 0) !== currentEpoch) {
    return { error: errorJson('密码已修改，请重新登录', 401, 'PWD_CHANGED') }
  }
  return { account: acc, tokenPayload: payload }
}

export async function requireAdmin(request, env) {
  const token = getBearer(request)
  if (!token) return { error: errorJson('未登录', 401, 'NO_TOKEN') }
  const payload = await verifyToken(token, env.AUTH_SECRET)
  if (!payload || payload.t !== 'admin') {
    return { error: errorJson('管理员身份无效或已过期，请重新登录', 401, 'BAD_ADMIN') }
  }
  return {}
}

// ———— 账号生成 ————

const UNAMBIGUOUS = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'

export function randomString(len, charset = UNAMBIGUOUS) {
  const buf = crypto.getRandomValues(new Uint8Array(len))
  let s = ''
  for (const b of buf) s += charset[b % charset.length]
  return s
}

export function cardDays(body) {
  if (body.cardType && CARD_TYPES[body.cardType]) return CARD_TYPES[body.cardType].days
  const d = Number(body.days)
  if (Number.isInteger(d) && d >= 1 && d <= 3650) return d
  return null
}

export function publicAccount(row) {
  return {
    id: row.id,
    username: row.username,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    disabled: !!row.disabled,
    lastLogin: row.last_login ?? null,
  }
}

// ———— 登录限速（D1 固定窗口；仅失败计数，成功清零）————
// 表缺失时降级为放行并告警——避免未执行迁移的旧部署直接登录瘫痪。
// 迁移：npx wrangler d1 execute info-manager --file=./schema.sql --remote

export function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim() ||
    'unknown'
  )
}

export async function checkRateLimit(env, key, maxFailures = 5, windowMs = 15 * 60_000) {
  try {
    const now = Date.now()
    const row = await env.DB.prepare('SELECT count, window_start FROM login_attempts WHERE key = ?')
      .bind(key)
      .first()
    if (!row || now - Number(row.window_start) > windowMs) return { allowed: true }
    if (Number(row.count) >= maxFailures) {
      const waitMin = Math.max(1, Math.ceil((windowMs - (now - Number(row.window_start))) / 60_000))
      return { allowed: false, waitMin }
    }
    return { allowed: true }
  } catch (e) {
    console.warn('[ratelimit] 查询失败，已放行（请执行 schema.sql 迁移）:', e?.message)
    return { allowed: true }
  }
}

export async function recordLoginFailure(env, key, windowMs = 15 * 60_000) {
  try {
    const now = Date.now()
    const row = await env.DB.prepare('SELECT window_start FROM login_attempts WHERE key = ?')
      .bind(key)
      .first()
    if (!row || now - Number(row.window_start) > windowMs) {
      await env.DB.prepare(
        'INSERT INTO login_attempts (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start',
      )
        .bind(key, now)
        .run()
    } else {
      await env.DB.prepare('UPDATE login_attempts SET count = count + 1 WHERE key = ?').bind(key).run()
    }
  } catch (e) {
    console.warn('[ratelimit] 记录失败:', e?.message)
  }
}

export async function clearLoginFailures(env, key) {
  try {
    await env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key).run()
  } catch {
    /* 忽略：清理失败不影响登录 */
  }
}

// 通用固定窗口计数限速（每次调用都计数；用于 AI 代理等非登录场景）。
// 复用 login_attempts 表（本质是 key→固定窗口计数器），key 用 'ai:<accountId>' 与登录限速隔离。
// 表缺失时放行（fail-open），与登录限速一致的降级策略。
export async function checkWindowCount(env, key, maxCount, windowMs) {
  try {
    const now = Date.now()
    const row = await env.DB.prepare('SELECT count, window_start FROM login_attempts WHERE key = ?')
      .bind(key)
      .first()
    if (!row || now - Number(row.window_start) > windowMs) {
      await env.DB.prepare(
        'INSERT INTO login_attempts (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start',
      )
        .bind(key, now)
        .run()
      return { allowed: true, remaining: maxCount - 1 }
    }
    if (Number(row.count) >= maxCount) {
      const waitMin = Math.max(1, Math.ceil((windowMs - (now - Number(row.window_start))) / 60_000))
      return { allowed: false, waitMin }
    }
    await env.DB.prepare('UPDATE login_attempts SET count = count + 1 WHERE key = ?').bind(key).run()
    return { allowed: true, remaining: maxCount - Number(row.count) - 1 }
  } catch (e) {
    console.warn('[ratelimit] 通用限速查询失败，已放行:', e?.message)
    return { allowed: true }
  }
}

// ———— 管理端审计日志（尽力写入，失败不影响主流程）————
export async function logAdmin(env, request, action, target = '-', detail = '') {
  try {
    await env.DB.prepare(
      'INSERT INTO admin_audit (action, target, detail, ip, created_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(action, String(target), String(detail).slice(0, 200), clientIp(request), Date.now())
      .run()
  } catch (e) {
    console.warn('[audit] 写入失败:', e?.message)
  }
}
