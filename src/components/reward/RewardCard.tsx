// 设置页「关于与支持」内容（常驻，全站唯一长期展示二维码的地方）。
//
// 依据：`redesign-brief/02-donation-research.md` §F.4（逐字文案）、§G.5–G.7（可扫性/无障碍）、
//       `redesign-brief/06-v4-signal-press.md` §8.9（v4 视觉：sheet 面 + 2px ink + 硬边 + lime 按钮）。
// - 二维码卡面抽到 `RewardQr`（卡面固定白、不反色），本组件只负责排版与文案。
// - 已支持（终态）只显示致谢，不再显示码与「我已经支持过了」。
// - 设置页 support tab 直接渲染本组件（父级不再外包卡片），因此这里提供唯一的 `.sheet` 面。
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
    <section className="sheet" style={styles.card}>
      <h2 className="page-title-sm" style={styles.title}>
        {copy.title}
      </h2>
      <p style={styles.body}>{copy.lead}</p>
      <p style={styles.body}>{copy.privacy}</p>

      {supported ? (
        <div className="muted-block" style={styles.thanks}>
          {copy.supportedThanks}
        </div>
      ) : (
        <div style={styles.qrRow}>
          <RewardQr src={qrSrc} />
          <div style={styles.notes}>
            <div className="mono" style={styles.scan}>
              {copy.scan}
            </div>
            <div className="mono" style={styles.note}>
              {copy.payBy}
            </div>
            <div className="mono" style={styles.note}>
              {copy.privacyShort}
            </div>
            <div style={styles.save}>{copy.save}</div>
          </div>
        </div>
      )}

      <div style={styles.free}>{copy.free}</div>

      {!supported && (
        <div className="welcome-actions" style={styles.actions}>
          <Button type="primary" size="small" onClick={handleSupported}>
            {copy.supportedBtn}
          </Button>
        </div>
      )}
    </section>
  )
}

const styles = {
  card: {
    maxWidth: 620,
    padding: 'var(--s6)',
  },
  title: {
    // Outfit 700 24（.page-title-sm 给 800，这里按 brief §8.9 压到 700）
    fontWeight: 700,
    marginBottom: 'var(--s3)',
  },
  body: {
    margin: '0 0 var(--s3)',
    fontSize: 'var(--t-base)',
    lineHeight: 1.65,
    color: 'var(--ink-soft)',
  },
  qrRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'flex-start',
    gap: 'var(--s6)',
    margin: 'var(--s5) 0 var(--s4)',
  },
  notes: {
    flex: '1 1 200px',
    minWidth: 200,
    paddingTop: 'var(--s1)',
  },
  scan: {
    fontSize: 'var(--t-xs)',
    lineHeight: 1.4,
    fontWeight: 600,
    color: 'var(--ink)',
  },
  note: {
    marginTop: 'var(--s2)',
    fontSize: 'var(--t-xs)',
    lineHeight: 1.4,
    color: 'var(--ink-soft)',
  },
  save: {
    marginTop: 'var(--s4)',
    fontSize: 'var(--t-xs)',
    lineHeight: 1.5,
    color: 'var(--ink-faint)',
  },
  free: {
    marginTop: 'var(--s4)',
    paddingTop: 'var(--s3)',
    borderTop: '1px solid var(--line-soft)',
    fontSize: 'var(--t-xs)',
    lineHeight: 1.5,
    color: 'var(--ink-faint)',
  },
  actions: {
    marginTop: 'var(--s4)',
  },
  thanks: {
    margin: 'var(--s5) 0 var(--s4)',
  },
} as const
