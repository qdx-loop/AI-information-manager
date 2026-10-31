// WelcomeModal（受控首次欢迎卡）组件契约测试。
//
// 锁住的是 Lead 定稿的受控契约与「首屏三条底线」：
//   - 受控：open / accountId / onClose 由外部传入；组件**不消费 pending**、不判断 seen；
//   - 关闭：开始使用 / × 都先 markWelcomeSeen(accountId) 再 onClose()（同一条 close 路径）；
//   - 首屏正文必须出现「不扫，功能和体验完全一样」与「设置 → 关于与支持」；
//   - 文案零感叹号、零 emoji；主按钮是「开始使用」。
// 环境说明：jsdom 不透明 origin 没有可用 Storage，先装内存版再 import 组件（范式同 onboarding.test.ts）。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => void map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  }
}

const local = memoryStorage()
const session = memoryStorage()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: local })
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, writable: true, value: session })

import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import WelcomeModal from './WelcomeModal'

const ACC = 'acc-A'

beforeEach(() => {
  local.clear()
  session.clear()
})

afterEach(() => {
  cleanup()
})

function renderOpen(onClose = vi.fn()) {
  const view = render(<WelcomeModal open accountId={ACC} onClose={onClose} />)
  return { ...view, onClose }
}

describe('受控契约', () => {
  it('open=false 时不渲染对话框', () => {
    render(<WelcomeModal open={false} accountId={ACC} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('不消费一次性口令：pending 由 AppShell 负责（组件只负责显示）', () => {
    session.setItem('info-mgmt-welcome-pending', '1')
    renderOpen()
    expect(screen.getByRole('dialog')).toBeTruthy()
    // 组件不得偷偷消费 pending
    expect(session.getItem('info-mgmt-welcome-pending')).toBe('1')
  })
})

describe('首屏内容与底线', () => {
  it('标题、两段正文、码旁说明、页脚都在；主按钮是「开始使用」', () => {
    renderOpen()
    expect(screen.getByText('这个工具是我一个人维护的')).toBeTruthy()
    expect(screen.getByText('关于作者')).toBeTruthy()
    expect(screen.getByText('微信扫码 · 金额自定')).toBeTruthy()
    expect(screen.getByText('我只会看到昵称和留言，看不到你的账号和数据')).toBeTruthy()
    expect(screen.getByText('这个提示只出现一次。')).toBeTruthy()
    expect(screen.getByRole('button', { name: '开始使用' })).toBeTruthy()
    // 二维码 alt（about.qrAlt）存在；antd 的关闭图标也是 role=img，所以按 alt 查
    expect(screen.getByAltText(/不扫码不影响任何功能/)).toBeTruthy()
  })

  it('正文必须包含「不扫，功能和体验完全一样」与「设置 → 关于与支持」', () => {
    renderOpen()
    const text = document.body.textContent ?? ''
    expect(text).toContain('不扫，功能和体验完全一样')
    expect(text).toContain('以后想找它，在「设置 → 关于与支持」里，一直都在。')
  })

  it('文案零感叹号、零 emoji，且不出现「打赏/赞助/资助」', () => {
    renderOpen()
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/[!！]/)
    expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
    expect(text).not.toMatch(/打赏|赞助|资助/)
  })
})

describe('四种关闭方式都走同一条 close 路径（写 seen + onClose）', () => {
  it('点「开始使用」：写 seen 且 onClose 被调用一次', () => {
    const { onClose } = renderOpen()
    fireEvent.click(screen.getByRole('button', { name: '开始使用' }))
    expect(local.getItem('info-mgmt-ob-welcome-acc-A')).toBe('1')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('点右上 ×：同样写 seen 且 onClose 被调用一次', () => {
    const { onClose } = renderOpen()
    const closeBtn = screen.getByRole('button', { name: /关闭，以后可在「设置 → 关于与支持」找到/ })
    fireEvent.click(closeBtn)
    expect(local.getItem('info-mgmt-ob-welcome-acc-A')).toBe('1')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('点遮罩：同样写 seen 且 onClose 被调用一次', () => {
    const { onClose } = renderOpen()
    const wrap = document.querySelector('.ant-modal-wrap') as HTMLElement
    expect(wrap).toBeTruthy()
    fireEvent.mouseDown(wrap)
    fireEvent.mouseUp(wrap)
    fireEvent.click(wrap)
    expect(local.getItem('info-mgmt-ob-welcome-acc-A')).toBe('1')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('按 Esc：同样写 seen 且 onClose 被调用一次', () => {
    const { onClose } = renderOpen()
    const wrap = document.querySelector('.ant-modal-wrap') as HTMLElement
    fireEvent.keyDown(wrap, { key: 'Escape', keyCode: 27, which: 27 })
    expect(local.getItem('info-mgmt-ob-welcome-acc-A')).toBe('1')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

})
