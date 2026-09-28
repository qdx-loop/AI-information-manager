// 同 _auth.d.ts：这里也会被 wrangler 的 esbuild 一起打包，必须用合法的 .d.ts 写法。
export declare function isPrivateIpv4(ip: string): boolean
export declare function isPrivateHost(host: string): boolean
export declare function isFetchableUrl(rawUrl: string): { ok: boolean; reason?: 'BAD_URL' | 'BLOCKED_HOST' }
