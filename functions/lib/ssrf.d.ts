export function isPrivateIpv4(ip: string): boolean
export function isPrivateHost(host: string): boolean
export function isFetchableUrl(rawUrl: string): { ok: boolean; reason?: 'BAD_URL' | 'BLOCKED_HOST' }
