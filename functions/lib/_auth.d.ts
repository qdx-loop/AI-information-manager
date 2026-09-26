export function issueUserToken(
  account: { id: string; expires_at: number },
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
