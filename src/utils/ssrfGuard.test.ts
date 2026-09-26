import { describe, it, expect } from 'vitest'
import { isPrivateHost, isPrivateIpv4, isFetchableUrl } from '../../functions/lib/ssrf'

// 回归：旧实现的 IPv4 正则 `^(\d{1,3}\.){4}$` 要求结尾有点，导致所有正常点分 IP
// 都不匹配，内网判断形同虚设（127.0.0.1 / 10.x / 192.168.x 全部放行 → SSRF）。
describe('SSRF 主机判断', () => {
  it('拦截 IPv4 内网/保留段', () => {
    for (const h of [
      '127.0.0.1',
      '10.0.0.1',
      '192.168.1.1',
      '172.16.0.1',
      '172.31.255.255',
      '169.254.169.254', // 云元数据
      '0.0.0.0',
      '100.64.0.1', // CGNAT
    ]) {
      expect(isPrivateHost(h), h).toBe(true)
    }
  })

  it('拦截 IPv6 环回/链路本地/唯一本地', () => {
    for (const h of ['[::1]', '::1', '::', '[fe80::1]', '[fd12:3456::1]', '[fc00::1]']) {
      expect(isPrivateHost(h), h).toBe(true)
    }
  })

  it('拦截 IPv4 映射的 IPv6 内网地址', () => {
    expect(isPrivateHost('[::ffff:127.0.0.1]')).toBe(true)
    expect(isPrivateHost('[::ffff:10.0.0.1]')).toBe(true)
  })

  it('拦截本地域名', () => {
    for (const h of ['localhost', 'foo.localhost', 'a.local', 'b.lan', 'c.internal', 'd.home']) {
      expect(isPrivateHost(h), h).toBe(true)
    }
  })

  it('放行公网地址', () => {
    for (const h of ['8.8.8.8', '1.1.1.1', 'example.com', '2001:4860:4860::8888', '172.32.0.1']) {
      expect(isPrivateHost(h), h).toBe(false)
    }
  })

  it('畸形 IPv4 一律拒绝', () => {
    for (const ip of ['999.1.1.1', '1.2.3', '1.2.3.4.5', 'a.b.c.d']) {
      expect(isPrivateIpv4(ip), ip).toBe(true)
    }
  })
})

describe('SSRF URL 校验', () => {
  it('拒绝非 http(s) 协议与非法 URL', () => {
    expect(isFetchableUrl('ftp://example.com').ok).toBe(false)
    expect(isFetchableUrl('file:///etc/passwd').ok).toBe(false)
    expect(isFetchableUrl('not a url').ok).toBe(false)
    expect(isFetchableUrl('').ok).toBe(false)
  })

  it('拒绝指向内网的 URL', () => {
    expect(isFetchableUrl('http://127.0.0.1/x')).toEqual({ ok: false, reason: 'BLOCKED_HOST' })
    expect(isFetchableUrl('http://[::1]/')).toEqual({ ok: false, reason: 'BLOCKED_HOST' })
    expect(isFetchableUrl('http://169.254.169.254/latest/meta-data/')).toEqual({
      ok: false,
      reason: 'BLOCKED_HOST',
    })
  })

  it('放行公网 URL', () => {
    expect(isFetchableUrl('https://example.com/article').ok).toBe(true)
    expect(isFetchableUrl('http://8.8.8.8/').ok).toBe(true)
  })
})
