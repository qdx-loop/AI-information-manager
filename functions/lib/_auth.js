// 共享工具：密码哈希、令牌签发/校验、卡种定义、D1 访问辅助
// 注意：下划线开头的目录不会被 Cloudflare Pages 当作路由

const ITERATIONS = 100000
const TOKEN_TTL_USER = 7 * 24 * 3600 // 用户令牌最长 7 天，到期前需重新登录
const TOKEN_TTL_ADMIN = 12 * 3600 // 管理后台令牌 12 小时

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
    return bytesToHex(bits) === hashHex.toLowerCase()
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
  if (sig !== expect) return null
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
  const cap = Math.floor(accountExpiresAtMs / 1000)
  const ttl = Math.floor(Date.now() / 1000) + TOKEN_TTL_USER
  return Math.min(cap, ttl)
}

export async function issueUserToken(account, secret) {
  return signToken({ t: 'user', aid: account.id, exp: userTokenExpiry(account.expires_at) }, secret)
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
  if (Date.now() > acc.expires_at) {
    return { error: errorJson('您的账户已到期，请联系管理员续费', 403, 'EXPIRED') }
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
