import type { ReactNode } from 'react'

/**
 * 空态（v4 SIGNAL PRESS）：56px lime 方块（`.empty-mark`，2px ink 边 + 硬投影）
 * + Outfit 800 24 标题 + 15 正文 + 主按钮。
 *
 * `surface` 为 true 时自身是一块 `.panel`（用于替换表格/列表区域）；
 * 放在已有 panel/tile 内时传 false（只渲染空态内容，避免 panel 套 panel）。
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
    <div className="empty-state">
      <div className="empty-mark" aria-hidden>
        {icon ?? '!'}
      </div>
      <h3 className="empty-title">{title}</h3>
      {body ? <p className="empty-body">{body}</p> : null}
      {action ? <div className="empty-actions">{action}</div> : null}
    </div>
  )
  if (!surface) return inner
  return <div className="panel panel--flush">{inner}</div>
}
