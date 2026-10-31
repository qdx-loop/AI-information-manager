// 纯文字「关于与支持」链接（用于帮助页文末 / 落地页页脚）。
//
// 依据：`redesign-brief/02-donation-research.md` §D.2——这两处**只放文字链**，
// 不出现二维码、不出现「赞赏/咖啡/码」等字样，避免在未登录访客面前暴露支付视觉。
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'

const SUPPORT_PATH = '/settings?tab=support'

export interface SupportLinkProps {
  /** 链接文案，默认取 i18n 的 `support.link`（关于与支持 / About & support） */
  label?: string
  /** 允许调用方微调字号/间距（颜色与下划线由组件统一） */
  style?: CSSProperties
  className?: string
}

export default function SupportLink({ label, style, className }: SupportLinkProps) {
  const navigate = useNavigate()
  const t = useI18n()

  // 保留原生 <a>：可 Tab、可中键新开；左键单击走 SPA 路由，不整页刷新
  const onClick = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(SUPPORT_PATH)
  }

  return (
    <a href={SUPPORT_PATH} className={className} onClick={onClick} style={{ ...styles.link, ...style }}>
      {label ?? t('support.link')}
    </a>
  )
}

const styles = {
  link: {
    fontSize: 'var(--text-xs, 13px)',
    lineHeight: 1.5,
    color: 'var(--ink-muted)',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
    cursor: 'pointer',
  },
} as const
