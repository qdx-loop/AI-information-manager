import { Tooltip } from 'antd'
import { PhoneOutlined, MailOutlined, LinkOutlined } from '@ant-design/icons'
import type { FieldDef, FieldValue } from '@/types'

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
  if (/^(www\.)[a-z0-9-]+(\.[a-z0-9-]+)+([/?#][^\s]*)?$/i.test(s)) return { href: `https://${s}`, icon: 'link' }
  // 邮箱
  if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)) return { href: `mailto:${s}`, icon: 'mail' }
  // 电话：11 位大陆手机号；或 +86 形态；或 3-4 位区号-7-8 位号码
  if (/^(?:\+?86)?1[3-9]\d{9}$/.test(s.replace(/[\s-]/g, ''))) return { href: `tel:${s.replace(/[\s-]/g, '')}`, icon: 'phone' }
  if (/^0\d{2,3}-?\d{7,8}$/.test(s.replace(/[\s-]/g, ''))) return { href: `tel:${s.replace(/[\s-]/g, '')}`, icon: 'phone' }
  return null
}

const ICONS = { phone: <PhoneOutlined />, mail: <MailOutlined />, link: <LinkOutlined /> }

/**
 * 表格/卡片单元格智能值：电话→一键拨打、邮箱→写邮件、网址→新标签打开。
 * 编辑态仍用原输入控件，仅展示态增强。
 */
export default function SmartValue({ field, value }: { field: FieldDef; value: FieldValue }) {
  const str = value == null ? '' : String(value).trim()
  if (!str) return <span style={{ color: 'var(--ant-color-text-tertiary)' }}>-</span>

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
            // TWA/APK（referrer 带 android-app://，PWA 主屏快捷方式无此标记）：
            // target=_blank 会跳出应用到系统浏览器，改为当前环境内打开
            const inTwa = typeof document !== 'undefined' && document.referrer.includes('android-app://')
            if (inTwa && link.href.startsWith('http')) {
              e.preventDefault()
              window.open(link.href, '_self')
            }
          }}
          style={{ wordBreak: 'break-all' }}
        >
          {ICONS[link.icon]} {str}
        </a>
      </Tooltip>
    )
  }
  return <span style={{ wordBreak: 'break-all' }}>{str}</span>
}
