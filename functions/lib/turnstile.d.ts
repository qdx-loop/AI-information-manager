// 同 _auth.d.ts：这里也会被 wrangler 的 esbuild 一起打包，必须用合法的 .d.ts 写法
// （`export declare const` 而不是 `export const`，后者无初始值会被判为语法错误）。
export interface TurnstileVerdict {
  ok: boolean
  degraded?: boolean
  reason?: string
  code?: string
  message?: string
}

export declare function isConfigured(env: Record<string, unknown>): boolean
export declare function expectedHostnames(env: Record<string, unknown>): Set<string>
export declare function verifyTurnstile(
  env: Record<string, unknown>,
  token: unknown,
  action: string,
  ip?: string,
): Promise<TurnstileVerdict>
