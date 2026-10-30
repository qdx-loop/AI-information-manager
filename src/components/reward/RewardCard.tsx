// 设置页「关于与支持」内容（常驻，全站唯一出现二维码的地方）。
//
// 设计依据：`redesign-brief/02-donation-research.md` §A.1 / §D.1 / §F.4 / §G.5–G.7。
// - 二维码卡面**必须固定白**：暗色下若用 var(--app-surface) 会变深，浅色模块跟着变深后扫不出来。
//   外层容器用 var(--app-surface) 承托，形成「白纸裱在深色桌面上」。
// - 图片不反色、不加滤镜、不加 mix-blend-mode；不放大到失真（原图 640×640，显示 248px）。
// - 文案逐字取自 §F.4，不出现「打赏/赞助/资助」，不出现感叹号与 emoji。
// - 已支持（R8 终态）只显示致谢，不再显示二维码。
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useI18n } from '@/i18n'
import { isSupported, markSupported } from '@/utils/support'

/** 二维码资产（由 public/support-qr.png 提供，码本体约占画面 78%，四周为纯白 quiet zone） */
const DEFAULT_QR_SRC = '/support-qr.png'
/**
 * 二维码卡面：必须是不随主题变化的纯白。
 * 这是本项目里唯一允许写死颜色的地方——主题变量在这里会让码失效（见文件头注释）。
 */
const QR_CARD_BG = '#FFFFFF'
/** 码区显示尺寸：240–260，低于 240 手机微信难扫（§G.5 / §G.6） */
const QR_SIZE = 248

export interface RewardCardProps {
  /** 可覆盖二维码地址（默认 /support-qr.png） */
  qrSrc?: string
}

export default function RewardCard({ qrSrc = DEFAULT_QR_SRC }: RewardCardProps) {
  const account = useAuthStore((s) => s.account)
  const t = useI18n()
  const [supported, setSupported] = useState(() =>
    account ? isSupported(account.id) : false,
  )

  // 登录态恢复是异步的（authStore.init），挂载后 account 才到齐时补一次判定
  useEffect(() => {
    setSupported(account ? isSupported(account.id) : false)
  }, [account])

  const copy = {
    title: t('about.title'),
    lead: t('about.lead'),
    privacy: t('about.privacy'),
    scan: t('about.scan'),
    save: t('about.save'),
    supportedBtn: t('about.supportedBtn'),
    supportedThanks: t('about.supportedTitle'),
    payBy: t('about.payBy'),
    privacyShort: t('about.privacyShort'),
    free: t('about.free'),
  }

  // 账号还没恢复：设置页本身在登录后才可达，这里只做兜底，避免闪一下错误的致谢态
  if (!account) return null

  const handleSupported = () => {
    markSupported(account.id)
    setSupported(true)
  }

  return (
    <section style={{ maxWidth: 560 }}>
      <h2 style={styles.title}>{copy.title}</h2>
      <p style={styles.body}>{copy.lead}</p>
      <p style={styles.body}>{copy.privacy}</p>

      {supported ? (
        <div style={styles.thanks}>{copy.supportedThanks}</div>
      ) : (
        <div style={styles.qrRow}>
          <div style={styles.qrCard} role="group" aria-label={t('settings.tab.about')}>
            <img
              src={qrSrc}
              alt={t('about.qrAlt')}
              width={QR_SIZE}
              height={QR_SIZE}
              style={styles.qrImg}
            />
          </div>
          <div style={styles.notes}>
            <div style={styles.scan}>{copy.scan}</div>
            <div style={styles.note}>{copy.payBy}</div>
            <div style={styles.note}>{copy.privacyShort}</div>
            <div style={styles.save}>{copy.save}</div>
          </div>
        </div>
      )}

      <div style={styles.free}>{copy.free}</div>

      {!supported && (
        <button type="button" style={styles.supportedBtn} onClick={handleSupported}>
          {copy.supportedBtn}
        </button>
      )}
    </section>
  )
}

const styles = {
  title: {
    margin: '0 0 12px',
    fontFamily: 'var(--font-serif)',
    fontSize: 20,
    lineHeight: 1.4,
    fontWeight: 600,
    color: 'var(--app-ink)',
  },
  body: {
    margin: '0 0 12px',
    fontSize: 14,
    lineHeight: 1.6,
    color: 'var(--app-ink-soft)',
  },
  qrRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'flex-start',
    gap: 24,
    margin: '20px 0 16px',
  },
  qrCard: {
    // 固定白：不随主题变化，保证浅色模块不被暗色变量拖深
    background: QR_CARD_BG,
    padding: 12,
    border: '1px solid var(--app-border)',
    borderRadius: 4,
    lineHeight: 0,
  },
  qrImg: {
    display: 'block',
    width: QR_SIZE,
    maxWidth: '100%',
    height: 'auto',
    // 不反色、不加滤镜：二维码必须保持深码浅底
    imageRendering: 'auto' as const,
  },
  notes: {
    flex: '1 1 200px',
    minWidth: 200,
    paddingTop: 2,
  },
  scan: {
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 500,
    color: 'var(--app-ink)',
  },
  note: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 1.6,
    color: 'var(--app-ink-soft)',
  },
  save: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 1.6,
    color: 'var(--app-ink-faint)',
  },
  free: {
    marginTop: 16,
    paddingTop: 12,
    borderTop: '1px solid var(--app-border-soft)',
    fontSize: 12,
    lineHeight: 1.6,
    color: 'var(--app-ink-faint)',
  },
  supportedBtn: {
    marginTop: 12,
    padding: 0,
    border: 'none',
    background: 'none',
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--app-ink-faint)',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
    cursor: 'pointer',
  },
  thanks: {
    margin: '20px 0 16px',
    padding: '12px 16px',
    border: '1px solid var(--app-border-soft)',
    borderRadius: 4,
    background: 'var(--app-surface-sunken)',
    fontSize: 14,
    lineHeight: 1.6,
    color: 'var(--app-ink-soft)',
  },
} as const
