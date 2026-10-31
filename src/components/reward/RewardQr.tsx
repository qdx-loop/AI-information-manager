// 二维码白卡（WelcomeModal 与 RewardCard 共用）。
//
// 依据：`redesign-brief/05-first-run-support.md` §C.1 / §E、TOKENS-v3 §6。
// 硬约束（两处都不能破）：
// - 卡面**固定纯白**：暗色下若用 var(--bg-surface) 会变深，浅色模块跟着变深后扫不出来。
//   这是本项目里唯一允许写死颜色的地方。
// - 图片不反色、不加滤镜、不加 mix-blend-mode；不放大失真（源图 640×640，显示 240–248px）。
// - 二维码外围保留纯白 quiet zone（源图自带），因此卡面 padding 必须大于 0。
import type { CSSProperties } from 'react'
import { useI18n } from '@/i18n'

/** 二维码资产（`public/support-qr.png`，码本体约占画面 78%，四周纯白） */
const DEFAULT_QR_SRC = '/support-qr.png'
/** 卡面固定白：唯一允许写死的颜色 */
const QR_CARD_BG = '#FFFFFF'
/** 默认码区尺寸：research 建议 240–248（低于 240 手机微信难扫） */
const DEFAULT_QR_SIZE = 248

export interface RewardQrProps {
  /** 可覆盖二维码地址（默认 /support-qr.png） */
  src?: string
  /** 码区显示尺寸（px），默认 248；窄屏可传 240 */
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
      className={className}
      role="group"
      aria-label={groupLabel}
      style={{ ...styles.card, ...style }}
    >
      <img src={src} alt={alt} width={size} height={size} style={{ ...styles.img, width: size }} />
    </div>
  )
}

const styles = {
  // 固定白卡面 + 1px 边：暗色下形成「白纸浮在深色底上」的对比，码永远深码浅底
  card: {
    background: QR_CARD_BG,
    padding: 12,
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-3)',
    lineHeight: 0,
    width: 'fit-content',
    maxWidth: '100%',
  },
  img: {
    display: 'block',
    maxWidth: '100%',
    height: 'auto',
    // 不反色、不加滤镜：二维码必须保持深码浅底
    imageRendering: 'auto' as const,
  },
} as const
