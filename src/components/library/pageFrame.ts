/**
 * 页面内边距（v3 契约：桌面 24/32、平板 20/24、手机 16）。
 *
 * AppShell 的 <Content> 不提供内边距，由每个页面自己负责，避免出现双份 padding。
 * 用 antd 的 useBreakpoint 而不是写死 media query：内联 style 里没有媒体查询，
 * 而这个项目本来就在用 Grid.useBreakpoint 做窄屏分支。
 */
import { Grid } from 'antd'
import type { CSSProperties } from 'react'

export function usePagePadding(): CSSProperties {
  const bp = Grid.useBreakpoint()
  if (!bp.md) return { padding: 16 }
  if (!bp.lg) return { padding: '20px 24px' }
  return { padding: '24px 32px' }
}
