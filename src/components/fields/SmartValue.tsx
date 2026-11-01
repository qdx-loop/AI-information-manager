import { Tooltip } from 'antd'
import {
  PhoneOutlined,
  MailOutlined,
  LinkOutlined,
  CheckOutlined,
  CloseOutlined,
  StarOutlined,
} from '@ant-design/icons'
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

// 只保留线性（Outlined）图标：实心/双色图标是「AI 味」的第二来源
const ICONS = { phone: <PhoneOutlined />, mail: <MailOutlined />, link: <LinkOutlined /> }

const DASH = <span className="faint">—</span>

/** 空值统一占位，避免表格里出现一片空白 */
function isEmpty(v: FieldValue): boolean {
  return v === null || v === undefined || v === ''
}

/**
 * 表格/卡片单元格的值渲染。
 *
 * 之前这里只做「智能链接识别」，其它类型一律 String(value)，
 * 于是 checkbox 列在中文界面里直接显示 true / false，rating 显示裸数字。
 * 现在先按字段类型渲染（复选→是/否、评分→星级、日期→格式化），
 * 文本类再走链接识别，桌面表格 / 移动卡片 / 条目标题三处口径统一。
 *
 * v4 语言：数字/日期/ID 走 `.mono tabular`（等宽 + tabular-nums），纵向扫读不跳；
 * 布尔值用线性图标 + 文字（成功/次要色），评分用 5 个 StarOutlined（Outlined only，
 * 不用实心星字符），链接是 ink 字 + 2px lime 下划线。颜色/字号全部走 token。
 */
export default function SmartValue({ field, value }: { field: FieldDef; value: FieldValue }) {
  if (field.type === 'checkbox') {
    if (isEmpty(value)) return DASH
    if (value) {
      return (
        <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <CheckOutlined style={{ fontSize: 14 }} />
          {tNow('field.yes')}
        </span>
      )
    }
    return (
      <span className="faint" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <CloseOutlined style={{ fontSize: 14 }} />
        {tNow('field.no')}
      </span>
    )
  }

  if (field.type === 'rating') {
    if (isEmpty(value)) return DASH
    const n = Math.max(0, Math.min(5, Number(value) || 0))
    if (n === 0) return <span className="faint">{tNow('field.no')}</span>
    // 只允许 Outlined 图标：5 个 StarOutlined，实心感由 ink 色表达，空星走 line-soft
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }} aria-label={tNow('field.stars', { n: String(n) })}>
        {Array.from({ length: 5 }).map((_, i) => (
          <StarOutlined key={i} style={{ fontSize: 13, color: i < n ? 'var(--text)' : 'var(--border)' }} />
        ))}
      </span>
    )
  }

  if (field.type === 'date') {
    if (isEmpty(value)) return DASH
    return <span className="mono tabular">{String(value)}</span>
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
          style={{
            wordBreak: 'break-all',
            color: 'var(--text)',
            textDecoration: 'underline',
            textDecorationThickness: 2,
            textDecorationColor: 'var(--accent)',
            textUnderlineOffset: 2,
          }}
        >
          {ICONS[link.icon]} {str}
        </a>
      </Tooltip>
    )
  }

  const num = field.type === 'number'
  return (
    <span className={num ? 'mono tabular' : undefined} style={{ wordBreak: 'break-all' }}>
      {str}
    </span>
  )
}
