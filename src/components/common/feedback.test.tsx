// @vitest-environment jsdom
// 反馈层（toast / 确认框）的语义契约。
//
// 锁的是调用点依赖的三条行为，不是像素：
//   1. 同 key 复用同一条 toast —— 进度提示「同步中 1/3」不会叠成一摞卡片；
//   2. 确认框取消 → Promise 解析为 false 且走 onCancel —— 所有「删库/覆盖」判断靠它；
//   3. onOk 返回 false 或抛错 → 弹窗保持打开 —— 校验不过就不能关（antd 的老语义）。
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup, act } from '@testing-library/react'
import { FluentProvider, webLightTheme } from '@fluentui/react-components'
import { FeedbackHost, message, modal } from './feedback'

function renderHost() {
  return render(
    <FluentProvider theme={webLightTheme}>
      <FeedbackHost />
      <div>页面内容</div>
    </FluentProvider>,
  )
}

afterEach(async () => {
  // 队列是模块级状态：先把还开着的确认框「取消」掉（settle 掉 Promise），
  // 再卸载宿主；否则下一个用例会读到上一个用例留下的弹窗。
  const cancelOpenDialog = async () => {
    const dialog = document.querySelector('[role="alertdialog"]')
    if (!dialog) return
    const cancel = [...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === '取消')
    cancel?.click()
    await waitFor(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
  }
  await cancelOpenDialog()
  cleanup()
  message.destroy()
})

describe('toast', () => {
  // 断言用 .fui-Toast 计数 + 当前文案：Fluent 的 aria-live 播报区会保留上一次
  // 播报的文本给读屏，所以「旧文案在 body 里」不代表卡片还在。
  const toasts = () => [...document.querySelectorAll('.fui-Toast')].map((t) => t.textContent?.trim())

  it('同 key 的第二次提示原地改写，不叠出第二条', async () => {
    renderHost()
    message.success({ content: '已保存 1', key: 'save' })
    await screen.findByText('已保存 1')

    message.success({ content: '已保存 2', key: 'save' })
    await screen.findByText('已保存 2')
    await waitFor(() => expect(toasts()).toEqual(['已保存 2']))
  })

  it('loading 用同 key 改成结果后只剩一条结果提示', async () => {
    renderHost()
    message.loading({ content: '正在同步…', key: 'sync', duration: 0 })
    await screen.findByText('正在同步…')

    message.success({ content: '同步完成', key: 'sync' })
    await screen.findByText('同步完成')
    await waitFor(() => expect(toasts()).toEqual(['同步完成']))
  })
})

describe('确认框', () => {
  it('取消：resolve(false) 且触发 onCancel', async () => {
    renderHost()
    const onCancel = vi.fn()
    let result: boolean | undefined
    act(() => {
      void modal.confirm({ title: '删除这个库？', content: '不可恢复', onCancel }).then((ok) => {
        result = ok
      })
    })

    await screen.findByRole('alertdialog')
    await act(async () => {
      screen.getByRole('button', { name: '取消' }).click()
    })

    await waitFor(() => expect(result).toBe(false))
    expect(onCancel).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('onOk 返回 false：弹窗不关、Promise 不解析', async () => {
    renderHost()
    const onOk = vi.fn().mockResolvedValue(false)
    let settled = false
    act(() => {
      void modal.confirm({ title: '改名', content: '新名字不能为空', onOk }).then(() => {
        settled = true
      })
    })

    await screen.findByRole('alertdialog')
    await act(async () => {
      screen.getByRole('button', { name: '确认' }).click()
    })

    await waitFor(() => expect(onOk).toHaveBeenCalledTimes(1))
    expect(settled).toBe(false)
    expect(screen.getByRole('alertdialog')).toBeTruthy()
  })

  it('onOk 成功：resolve(true) 并关闭弹窗', async () => {
    renderHost()
    let result: boolean | undefined
    act(() => {
      void modal.confirm({ title: '删除？', okText: '删除', danger: true, onOk: async () => {} }).then((ok) => {
        result = ok
      })
    })

    await screen.findByRole('alertdialog')
    await act(async () => {
      screen.getByRole('button', { name: '删除' }).click()
    })

    await waitFor(() => expect(result).toBe(true))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })
})
