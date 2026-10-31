import type { ReactNode } from 'react'
import { InboxOutlined } from '@ant-design/icons'

/**
 * 空态（v3）：白卡内 48px 双色图标（`.empty-state-icon`：accent-wash 底 + accent 图标）
 * + 20/600 标题 + 14 说明 + 主按钮。不用插画站素材、不用 emoji。
 *
 * `surface` 为 true 时自身就是一张白卡（用于替换表格区域）；
 * 放在已有白卡/列表卡内时传 false（只渲染空态内容，避免卡片套卡片）。
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
      <div className="empty-state-icon" aria-hidden>
        {icon ?? <InboxOutlined />}
      </div>
      <div className="empty-state-title">{title}</div>
      {body ? <div className="empty-state-body">{body}</div> : null}
      {action ? <div className="empty-state-actions">{action}</div> : null}
    </div>
  )
  if (!surface) return inner
  return <div className="surface-card">{inner}</div>
}
