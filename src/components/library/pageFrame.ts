/**
 * 页面内边距。
 *
 * 约定（TOKENS §4 / 01-ui-research §E5，Lead 明确）：AppShell 的 <Content>
 * 不提供内边距，由每个页面自己负责，避免出现双份 padding。
 *   桌面  24px 32px
 *   平板  20px 24px（768–992）
 *   手机  16px（<768）
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
