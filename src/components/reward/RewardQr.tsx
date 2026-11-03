// 二维码卡面（纯白）· v10 Fluent 应用——WelcomeModal 与 RewardCard 共用。
//
// 硬约束（两处都不能破）：
// - 卡面**固定纯白**：QR 必须浅底深码才扫得出；暗色主题下也不反色（这是业务资产要求，
//   全项目唯一允许的固定色；v10 约束「只用 token」在该卡面上以 `.pub-qr` 的注释说明例外）。
// - 图片不反色、不加滤镜、不加 mix-blend-mode；不放大失真（源图 640×640，显示 240–248）。
// - 卡面保留内 padding 作 quiet zone（源图自带白边 + 卡内 12px）。
// v10 视觉：白底 + Fluent 圆角 token（borderRadiusMedium=4）+ 中性描边（`.pub-qr`，见 public.css）。
import type { CSSProperties } from 'react'
import { useI18n } from '@/i18n'

/** 二维码资产（`public/support-qr.png`，码本体约占画面 78%，四周纯白） */
const DEFAULT_QR_SRC = '/support-qr.png'
/** 默认码区尺寸：240–248（低于 240 手机微信难扫） */
const DEFAULT_QR_SIZE = 248

export interface RewardQrProps {
  /** 可覆盖二维码地址（默认 /support-qr.png） */
  src?: string
  /** 码区显示尺寸（px），默认 248 */
  size?: number
  className?: string
  style?: CSSProperties
}

export default function RewardQr({
  src = DEFAULT_QR_SRC,
  size = DEFAULT_QR_SIZE,
  className,
  style,
}: RewardQrProps) {
  const t = useI18n()
  // i18n key 未落地时用中文兜底（frontend-analyst 会补 about.qrAlt / settings.tab.about）
  const rawAlt = t('about.qrAlt')
  const alt = rawAlt === 'about.qrAlt' ? '微信收款二维码' : rawAlt
  const rawGroup = t('settings.tab.about')
  const groupLabel = rawGroup === 'settings.tab.about' ? '关于与支持' : rawGroup

  return (
    <div
      className={['pub-qr', className].filter(Boolean).join(' ')}
      role="group"
      aria-label={groupLabel}
      style={{ ...styles.card, ...style }}
    >
      <img src={src} alt={alt} width={size} height={size} style={{ ...styles.img, width: size }} />
    </div>
  )
}

const styles = {
  card: {
    // 白底 / 描边 / 4px 圆角由 `.pub-qr` 提供，这里只保证不被父级 flex 拉伸
    flexShrink: 0,
  },
  img: {
    display: 'block',
    maxWidth: '100%',
    height: 'auto',
    // 不反色、不加滤镜：二维码必须保持深码浅底
    imageRendering: 'auto' as const,
  },
} as const
