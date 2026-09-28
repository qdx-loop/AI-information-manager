// 类型声明，供 src/**/*.test.ts 从 TS 侧引用后端的 JS 实现。
//
// 注意：这个文件会被 wrangler 的 esbuild 当作普通 TypeScript 一起打包，所以必须用
// 合法的 .d.ts 写法——`export declare const` 而不是 `export const`（后者没有初始值
// 会被 esbuild 判为语法错误，导致 Functions 构建失败）。
export declare function issueUserToken(
  account: { id: string },
  secret: string,
  env?: unknown,
): Promise<string>
export declare function verifyToken(
  token: string,
  secret: string,
): Promise<{ t?: string; aid?: string; pe?: number; exp?: number } | null>
export declare function requireUser(
  request: unknown,
  env: unknown,
): Promise<{ account?: Record<string, unknown>; tokenPayload?: unknown; error?: unknown }>
export declare function checkWindowCount(
  env: unknown,
  key: string,
  maxCount: number,
  windowMs: number,
): Promise<{ allowed: boolean; waitMin?: number; remaining?: number }>
export declare function hashPassword(
  password: string,
  saltHex?: string | null,
): Promise<string>
export declare function verifyPassword(password: string, stored: string): Promise<boolean>
export declare function randomString(len: number, charset?: string): string
export declare function publicAccount(row: Record<string, unknown>): {
  id: string
  username: string
  contact: string | null
  createdAt: number
  disabled: boolean
  lastLogin: number | null
}
export declare function validateRegistration(body: unknown): {
  ok: boolean
  field?: 'username' | 'password' | 'contact'
  message?: string
  value?: { username: string; password: string; contact: string | null }
}
export declare const MIN_PASSWORD: number
export declare const USERNAME_RE: RegExp
