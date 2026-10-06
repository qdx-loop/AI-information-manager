// @vitest-environment jsdom
// 回归测试：管理后台登录后不能变错误页
//
// AdminPage 里 `if (!logged) return <登录框>` 排在 useBackButtonLayer 之前。
// 管理员输入正确密码 → logged 从 false 变 true → 渲染中途多出 Hook →
// React 抛「Rendered more hooks than during the previous render」。
// 捕获它的边界是全局 ErrorBoundary，于是表现是「密码输对了反而进不去后台」。
//
// ⚠ 这里刻意**不 mock** @/utils/backButton：
// 它内部有 useRef + useEffect 两个 Hook，mock 成空函数就把「多出来的两个 Hook」
// 一并抹掉了，测试会永远通过 —— 正是这类假绿最危险。
// jsdom 自带 history，真实实现可以直接跑。
import { describe, it, expect, vi } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import AdminPage from './AdminPage'

vi.mock('@/lib/serverApi', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/serverApi')
  return {
    ...actual,
    getAdminToken: () => null,
    adminLogin: async () => { /* 模拟密码正确 */ },
    adminListAccounts: async () => [],
    adminListAudit: async () => [],
    adminGetStats: async () => ({
      totalAccounts: 0, disabledAccounts: 0, signups7: 0, signups30: 0,
      activeUsers7: 0, events7: [], ops30: [],
    }),
  }
})

describe('AdminPage Hooks 顺序', () => {
  // 这个用例要渲染完整的管理后台（antd Table/Form + 一堆图标），
  // 单跑就接近 vitest 默认的 5s 超时，全量 25 个文件并行时必然超时。
  // 实测：显式给足时间后连续 6 次全量跑都稳定通过。
  it('登录成功后不触发「Rendered more hooks」（密码输对了要能进得去）', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const view = render(<AdminPage />)

    // 初始：登录框
    const input = view.container.querySelector('input[type="password"]') as HTMLInputElement
    expect(input).toBeTruthy()

    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value',
    )!.set!
    await act(async () => {
      setValue.call(input, 'correct-password')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const btn = [...view.container.querySelectorAll('button')].find((b) =>
      /登录|进入后台|Login/i.test(b.textContent || ''),
    ) as HTMLButtonElement | undefined
    expect(btn).toBeDefined()

    await act(async () => {
      btn!.click()
    })

    // 不用固定 setTimeout 等：全量并行跑时机器负载高，60ms 偶尔不够，
    // 表现为这个用例随机失败（一次「全套 222 项」里它红过一次）。
    // 等「登录框消失」这个真实条件出现，既确定又快。
    await waitFor(() => {
      expect(view.container.querySelector('input[type="password"]')).toBeNull()
    })

    const hookErrors = errSpy.mock.calls.filter((c) =>
      /rendered (more|fewer) hooks/i.test(String(c[0])),
    )
    expect(hookErrors).toHaveLength(0)
    errSpy.mockRestore()
  }, 20_000)
})
