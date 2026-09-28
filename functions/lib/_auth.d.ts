export function issueUserToken(
  account: { id: string },
  secret: string,
  env?: unknown,
): Promise<string>
export function verifyToken(
  token: string,
  secret: string,
): Promise<{ t?: string; aid?: string; pe?: number; exp?: number } | null>
export function requireUser(
  request: unknown,
  env: unknown,
): Promise<{ account?: Record<string, unknown>; tokenPayload?: unknown; error?: unknown }>
export function checkWindowCount(
  env: unknown,
  key: string,
  maxCount: number,
  windowMs: number,
): Promise<{ allowed: boolean; waitMin?: number; remaining?: number }>
export const MIN_PASSWORD: number
export const USERNAME_RE: RegExp
export function validateRegistration(body: unknown): {
  ok: boolean
  field?: 'username' | 'password' | 'contact'
  message?: string
  value?: { username: string; password: string; contact: string | null }
}
export function randomString(len: number, charset?: string): string
export function publicAccount(row: Record<string, unknown>): {
  id: string
  username: string
  contact: string | null
  createdAt: number
  disabled: boolean
  lastLogin: number | null
}
