import type { ReactNode } from 'react'
import { Text } from '@fluentui/react-components'
import { InfoRegular } from '@fluentui/react-icons'

/**
 * 空态（Fluent）：线性图标 + Text 标题/说明 + 操作按钮。
 *
 * `surface` 为 true 时占满页面主体区（替换表格区域）；
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
    <div className="lib-empty">
      <span className="lib-empty-icon" aria-hidden>
        {icon ?? <InfoRegular fontSize={24} />}
      </span>
      <Text size={400} weight="semibold" className="lib-empty-title">
        {title}
      </Text>
      {body ? (
        <Text size={200} className="lib-empty-desc">
          {body}
        </Text>
      ) : null}
      {action ? <div className="lib-empty-actions">{action}</div> : null}
    </div>
  )
  if (!surface) return inner
  return <div className="lib-empty-wrap">{inner}</div>
}
