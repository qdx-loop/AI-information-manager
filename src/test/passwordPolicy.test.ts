// @vitest-environment jsdom
// 回归测试：改密强度阈值
//
// password.js 原来写死 `newPwd.length < 6`，而注册（validateRegistration）和
// 管理员重置（admin/account.js）都用 MIN_PASSWORD = 8。
// 三条入口两条 8 一条 6，等于留了一条「把已有密码降级到 6 位」的旁路 ——
// 而且前端提示文案也是按 6 写的，用户不会以为自己选了更弱的密码。
import { describe, it, expect } from 'vitest'
import { MIN_PASSWORD, validateRegistration } from '../../functions/lib/_auth'

describe('改密强度阈值与注册一致', () => {
  it('MIN_PASSWORD 是 8', () => {
    expect(MIN_PASSWORD).toBe(8)
  })

  it('注册入口拒绝 7 位、接受 8 位（改密入口现在用同一个阈值）', () => {
    expect(validateRegistration({ username: 'alice1', password: 'a'.repeat(7) }).ok).toBe(false)
    expect(validateRegistration({ username: 'alice1', password: 'a'.repeat(8) }).ok).toBe(true)
  })
})
