import { Tooltip } from 'antd'
import {
  PhoneOutlined,
  MailOutlined,
  LinkOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@/components/common/icons'
import { StarFilled, StarRegular } from '@fluentui/react-icons'
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

// 只保留线性图标：Fluent Regular 图标与 Win11 原生一致
const ICONS = { phone: <PhoneOutlined />, mail: <MailOutlined />, link: <LinkOutlined /> }

const DASH = <span className="w-faint">—</span>

/** 空值统一占位，避免表格里出现一片空白 */
function isEmpty(v: FieldValue): boolean {
  return v === null || v === undefined || v === ''
}

/**
 * 表格 / 卡片单元格的值渲染（v9 Win11 文件资源管理器）。
 *
 * - checkbox → 线性对勾/叉 + 是/否；
 * - rating → 实心/线性星（5 颗，中性色，不用彩色大星）；
 * - date → 等宽 + tabular-nums；
 * - 文本 → 电话/邮箱/网址识别为系统链接（强调色由全局 a 样式提供）；
 * - 数字 → tabular-nums，让金额/数量纵向对齐。
 *
 * 渲染口径在桌面表格 / 移动卡片 / 条目标题三处保持一致。
 */
export default function SmartValue({ field, value }: { field: FieldDef; value: FieldValue }) {
  if (field.type === 'checkbox') {
    if (isEmpty(value)) return DASH
    if (value) {
      return (
        <span className="lib-cell" style={{ color: 'var(--w-success)', gap: 4 }}>
          <CheckOutlined style={{ fontSize: 14 }} />
          {tNow('field.yes')}
        </span>
      )
    }
    return (
      <span className="lib-cell w-faint" style={{ gap: 4 }}>
        <CloseOutlined style={{ fontSize: 14 }} />
        {tNow('field.no')}
      </span>
    )
  }

  if (field.type === 'rating') {
    if (isEmpty(value)) return DASH
    const n = Math.max(0, Math.min(5, Number(value) || 0))
    if (n === 0) return <span className="w-faint">{tNow('field.no')}</span>
    return (
      <span
        style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
        aria-label={tNow('field.stars', { n: String(n) })}
      >
        {Array.from({ length: 5 }).map((_, i) =>
          i < n ? (
            <StarFilled key={i} style={{ fontSize: 13, color: 'var(--w-text-2)' }} aria-hidden />
          ) : (
            <StarRegular key={i} style={{ fontSize: 13, color: 'var(--w-divider-strong)' }} aria-hidden />
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
      <Tooltip title={str}>
        <a
          href={link.href}
          target={link.href.startsWith('http') ? '_blank' : undefined}
          rel="noreferrer"
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
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0 }}
        >
          <span style={{ display: 'inline-flex', color: 'var(--w-text-3)', flex: '0 0 auto' }}>
            {ICONS[link.icon]}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{str}</span>
        </a>
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
