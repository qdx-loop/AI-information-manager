import type { ReactNode } from 'react'
import { InfoRegular } from '@fluentui/react-icons'

/**
 * 空态（v9 Win11）：Fluent 线性图标 48 + 标题 16 semibold + 说明 13 + 操作按钮，
 * 居中留白，不用彩色方块 / 硬投影 / 卡片套卡片。
 *
 * `surface` 为 true 时自身占满页面主体区（替换表格区域）；
 * 放在已有面板内部时传 false（只渲染空态内容）。
 */
export default function EmptyPanel({
  title,
  body,
  action,
  icon,
  surface = true,
}: {
  title: ReactNode
  body?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  surface?: boolean
}) {
  const inner = (
    <div className="w-empty">
      <div className="w-empty-icon" aria-hidden>
        {icon ?? <InfoRegular />}
      </div>
      <div className="w-empty-title">{title}</div>
      {body ? <div className="w-empty-desc">{body}</div> : null}
      {action ? <div className="w-empty-actions">{action}</div> : null}
    </div>
  )
  if (!surface) return inner
  return <div className="lib-empty-body">{inner}</div>
}
