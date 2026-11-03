import { Link, Tooltip } from '@fluentui/react-components'
import {
  CheckmarkRegular,
  DismissRegular,
  LinkRegular,
  MailRegular,
  PhoneRegular,
  StarFilled,
  StarRegular,
} from '@fluentui/react-icons'
import type { FieldDef, FieldValue } from '@/types'
import { isAndroidApp } from '@/utils/platform'
import { tNow } from '@/i18n'

// 识别纯值是否可交互（电话 / 邮箱 / 网址），返回可点击链接信息
export interface SmartLink {
  href: string
  icon: 'phone' | 'mail' | 'link'
}

export function detectSmartLink(value: string): SmartLink | null {
  const s = value.trim()
  if (!s) return null
  // 网址：http(s):// 开头，或明显的域名形态（含 . 且无空格）
  if (/^https?:\/\//i.test(s)) return { href: s, icon: 'link' }
  if (/^(www\.)[a-z0-9-]+\.[a-z0-9-]+(\.[a-z0-9-]+)+([/?#][^\s]*)?$/i.test(s)) return { href: `https://${s}`, icon: 'link' }
  // 邮箱
  if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)) return { href: `mailto:${s}`, icon: 'mail' }
  // 电话：11 位大陆手机号；或 +86 形态；或 3-4 位区号-7-8 位号码
  if (/^(?:\+?86)?1[3-9]\d{9}$/.test(s.replace(/[\s-]/g, ''))) return { href: `tel:${s.replace(/[\s-]/g, '')}`, icon: 'phone' }
  if (/^0\d{2,3}-?\d{7,8}$/.test(s.replace(/[\s-]/g, ''))) return { href: `tel:${s.replace(/[\s-]/g, '')}`, icon: 'phone' }
  return null
}

// 只保留 Fluent Regular 线性图标
const ICONS = { phone: <PhoneRegular />, mail: <MailRegular />, link: <LinkRegular /> }

const DASH = <span style={{ color: 'var(--w-text-3)' }}>—</span>

/** 空值统一占位，避免表格里出现一片空白 */
function isEmpty(v: FieldValue): boolean {
  return v === null || v === undefined || v === ''
}

/**
 * 表格 / 卡片单元格的值渲染（v10 Fluent）。
 *
 * - checkbox → 线性对勾/叉 + 是/否；
 * - rating → 实心/线性星（5 颗，强调色只用于已填星级）；
 * - date → tabular-nums；
 * - 文本 → 电话/邮箱/网址识别为 Fluent Link（强调色由 Fluent 提供）；
 * - 数字 → tabular-nums，金额/数量纵向对齐。
 */
export default function SmartValue({ field, value }: { field: FieldDef; value: FieldValue }) {
  if (field.type === 'checkbox') {
    if (isEmpty(value)) return DASH
    if (value) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--w-success)' }}>
          <CheckmarkRegular />
          {tNow('field.yes')}
        </span>
      )
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--w-text-3)' }}>
        <DismissRegular />
        {tNow('field.no')}
      </span>
    )
  }

  if (field.type === 'rating') {
    if (isEmpty(value)) return DASH
    const n = Math.max(0, Math.min(5, Number(value) || 0))
    if (n === 0) return <span style={{ color: 'var(--w-text-3)' }}>{tNow('field.no')}</span>
    return (
      <span
        style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
        aria-label={tNow('field.stars', { n: String(n) })}
      >
        {Array.from({ length: 5 }).map((_, i) =>
          i < n ? (
            <StarFilled key={i} style={{ fontSize: 13, color: 'var(--w-brand-fg)' }} aria-hidden />
          ) : (
            <StarRegular key={i} style={{ fontSize: 13, color: 'var(--w-text-3)' }} aria-hidden />
          ),
        )}
      </span>
    )
  }

  if (field.type === 'date') {
    if (isEmpty(value)) return DASH
    return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{String(value)}</span>
  }

  if (isEmpty(value)) return DASH

  const str = String(value).trim()

  const link = field.type === 'text' || field.type === 'textarea' ? detectSmartLink(str) : null
  if (link) {
    return (
      <Tooltip content={str} relationship="description">
        <Link
          href={link.href}
          target={link.href.startsWith('http') ? '_blank' : undefined}
          rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0 }}
          onClick={(e) => {
            e.stopPropagation()
            // App 壳内（TWA 或纯 WebView，由 UA 标记识别）：
            // target=_blank 会跳出应用到系统浏览器，改为当前环境内打开
            const inTwa = isAndroidApp()
            if (inTwa && link.href.startsWith('http')) {
              e.preventDefault()
              window.open(link.href, '_self')
            }
          }}
        >
          <span style={{ display: 'inline-flex', color: 'var(--w-text-3)', flex: '0 0 auto' }}>
            {ICONS[link.icon]}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{str}</span>
        </Link>
      </Tooltip>
    )
  }

  const num = field.type === 'number'
  return (
    <span
      style={{
        wordBreak: 'break-word',
        fontVariantNumeric: num ? 'tabular-nums' : undefined,
      }}
    >
      {str}
    </span>
  )
}
