// @vitest-environment jsdom
// 回归测试：AI 确认弹窗的 Hooks 顺序
//
// 原来 `if (!action) return null` 排在 `useBackButtonLayer(...)` 之前。
// action 从 null 变成有值时，渲染中途多出 Hook，React 直接抛
// 「Rendered more hooks than during the previous render」，
// 捕获它的边界是全局 ErrorBoundary —— 于是「AI 提议任意一个操作」就把整个应用打成错误页。
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { App as AntdApp } from 'antd'
import ConfirmActionModal from './ConfirmActionModal'
import type { ItemAction } from '@/ai/tools'
import type { FieldDef, Item } from '@/types'

vi.mock('@/utils/backButton', () => ({
  useBackButtonLayer: () => {},
  consumeTopOverlay: () => {},
}))

const fields: FieldDef[] = [
  { id: 'f1', libraryId: 'L1', key: 'name', label: '名称', type: 'text', required: false, visible: true, options: [], sortOrder: 0 },
]
const existing: Item = {
  id: 'i1', libraryId: 'L1', accountId: 'A', fields: { name: '张三' },
  pinned: false, sortOrder: 0, createdAt: 1, updatedAt: 1, deletedAt: null,
}
const action: ItemAction = { libraryId: 'L1', action: 'update', fields: { name: '李四' } }

function modal(p: { open: boolean; action: ItemAction | null }) {
  return (
    <AntdApp>
      <ConfirmActionModal
        open={p.open}
        action={p.action}
        library={undefined}
        fields={fields}
        existingItem={existing}
        onConfirm={async () => {}}
        onCancel={() => {}}
      />
    </AntdApp>
  )
}

describe('ConfirmActionModal Hooks 顺序', () => {
  it('action 由 null 变有值再变回 null 不抛错（确认一次 AI 操作的全过程）', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const view = render(modal({ open: false, action: null }))

    // action 变有值：原来是会在这里抛「Rendered more hooks」的地方
    expect(() => {
      act(() => view.rerender(modal({ open: true, action })))
    }).not.toThrow()
    // 弹窗确实渲染出来了（不是靠提前 return 蒙混过关）
    expect(screen.getAllByText(/确认|确定/).length).toBeGreaterThan(0)

    // 关掉：action 回到 null
    expect(() => {
      act(() => view.rerender(modal({ open: false, action: null })))
    }).not.toThrow()

    // React 的 Hook 不一致一定会以 error 形式打到 console.error
    const hookErrors = errSpy.mock.calls.filter((c) => /rendered (more|fewer) hooks/i.test(String(c[0])))
    expect(hookErrors).toHaveLength(0)
    errSpy.mockRestore()
  })
})
