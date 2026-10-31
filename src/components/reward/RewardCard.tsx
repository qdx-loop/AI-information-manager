// 设置页「关于与支持」内容（常驻，全站唯一长期展示二维码的地方）。
//
// 依据：`redesign-brief/02-donation-research.md` §F.4（逐字文案）、§G.5–G.7（码的可扫性/无障碍）、
//       TOKENS-v3 §6（本轮欢迎卡与本卡共用 RewardQr）。
// - 二维码白卡抽到 `RewardQr`（卡面固定白、不反色），本组件只负责排版与文案。
// - 已支持（终态）只显示致谢，不再显示码与「我已经支持过了」。
// - 视觉走 v3：白卡（.surface-card 由 Lead 提供）+ 20/600 标题（.page-title-sm）+ 14 正文。
import { useEffect, useState } from 'react'
import { Button } from 'antd'
import { useAuthStore } from '@/store/authStore'
import { useI18n, type TFunc } from '@/i18n'
import { isSupported, markSupported } from '@/utils/support'
import RewardQr from './RewardQr'

const DEFAULT_QR_SRC = '/support-qr.png'

/** i18n key 缺失时的中文兜底（about.* 已全部落地，这里只防英文区漏 key） */
const FALLBACK = {
  supportedBtn: '我已经支持过了',
  supportedThanks: '收到，谢谢。这里不用再看第二遍。',
} as const

function tx(t: TFunc, key: string, fallback: string): string {
  const v = t(key)
  return v === key ? fallback : v
}

export interface RewardCardProps {
  /** 可覆盖二维码地址（默认 /support-qr.png） */
  qrSrc?: string
}

export default function RewardCard({ qrSrc = DEFAULT_QR_SRC }: RewardCardProps) {
  const account = useAuthStore((s) => s.account)
  const t = useI18n()
  const [supported, setSupported] = useState(() => (account ? isSupported(account.id) : false))

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
    payBy: t('about.payBy'),
    privacyShort: t('about.privacyShort'),
    free: t('about.free'),
    supportedBtn: tx(t, 'about.supportedBtn', FALLBACK.supportedBtn),
    supportedThanks: tx(t, 'about.supportedTitle', FALLBACK.supportedThanks),
  }

  // 账号还没恢复：设置页本身在登录后才可达，这里只做兜底，避免闪一下错误的致谢态
  if (!account) return null

  const handleSupported = () => {
    markSupported(account.id)
    setSupported(true)
  }

  return (
    <section className="surface-card" style={styles.card}>
      <h2 className="page-title-sm" style={styles.title}>
        {copy.title}
      </h2>
      <p style={styles.body}>{copy.lead}</p>
      <p style={styles.body}>{copy.privacy}</p>

      {supported ? (
        <div style={styles.thanks}>{copy.supportedThanks}</div>
      ) : (
        <div style={styles.qrRow}>
          <RewardQr src={qrSrc} />
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
        <Button type="text" size="small" onClick={handleSupported} style={styles.supportedBtn}>
          {copy.supportedBtn}
        </Button>
      )}
    </section>
  )
}

const styles = {
  // .surface-card 提供白面/边/圆角/阴影；这里写 token 兜底值，避免 v3 CSS 落地前裸内容区
  card: {
    maxWidth: 560,
    padding: 24,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-3)',
    boxShadow: 'var(--shadow-1)',
  },
  title: {
    marginBottom: 12,
  },
  body: {
    margin: '0 0 12px',
    fontSize: 'var(--text-sm, 14px)',
    lineHeight: 1.65,
    color: 'var(--ink-muted)',
  },
  qrRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'flex-start',
    gap: 24,
    margin: '20px 0 16px',
  },
  notes: {
    flex: '1 1 200px',
    minWidth: 200,
    paddingTop: 2,
  },
  scan: {
    fontSize: 'var(--text-xs, 13px)',
    lineHeight: 1.5,
    fontWeight: 500,
    color: 'var(--ink)',
  },
  note: {
    marginTop: 6,
    fontSize: 'var(--text-2xs, 12px)',
    lineHeight: 1.5,
    color: 'var(--ink-muted)',
  },
  save: {
    marginTop: 12,
    fontSize: 'var(--text-2xs, 12px)',
    lineHeight: 1.5,
    color: 'var(--ink-faint)',
  },
  free: {
    marginTop: 16,
    paddingTop: 12,
    borderTop: '1px solid var(--border-rule)',
    fontSize: 'var(--text-2xs, 12px)',
    lineHeight: 1.6,
    color: 'var(--ink-faint)',
  },
  supportedBtn: {
    marginTop: 8,
    paddingInline: 0,
  },
  thanks: {
    margin: '20px 0 16px',
    padding: '12px 16px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-2)',
    background: 'var(--bg-sunken)',
    fontSize: 'var(--text-sm, 14px)',
    lineHeight: 1.6,
    color: 'var(--ink-muted)',
  },
} as const
