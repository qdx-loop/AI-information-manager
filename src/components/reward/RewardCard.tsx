// 设置页「关于与支持」内容（常驻，全站唯一长期展示二维码的地方）。
//
// 依据：`redesign-brief/02-donation-research.md` §F.4（逐字文案）、§G.5–G.7（可扫性/无障碍）。
// v9 视觉：Win11 设置卡片（`.w-card` + 卡片组标题 + 14/20 说明 + 白色二维码卡面 + 右下按钮）。
// - 二维码卡面抽到 `RewardQr`（卡面固定白、不反色），本组件只负责排版与文案。
// - 已支持（终态）只显示致谢，不再显示码与「我已经支持过了」。
// - 设置页 support tab 直接渲染本组件（父级不再外包卡片），因此这里提供唯一的卡片面。
import { useEffect, useState } from 'react'
import { CheckmarkCircleRegular, HeartRegular } from '@fluentui/react-icons'
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
    <section className="w-card pub-reward">
      <div className="w-card-head">
        <div className="w-card-title">
          <HeartRegular fontSize={18} aria-hidden />
          {copy.title}
        </div>
      </div>
      <div className="w-card-body">
        <p className="pub-reward-body">{copy.lead}</p>
        <p className="pub-reward-body">{copy.privacy}</p>

        {supported ? (
          <div className="pub-reward-thanks">
            <CheckmarkCircleRegular fontSize={16} aria-hidden />
            <span>{copy.supportedThanks}</span>
          </div>
        ) : (
          <div className="pub-reward-qr">
            <RewardQr src={qrSrc} />
            <div className="pub-reward-notes">
              <div className="pub-reward-note-strong">{copy.scan}</div>
              <div className="pub-reward-note">{copy.payBy}</div>
              <div className="pub-reward-note">{copy.privacyShort}</div>
              <div className="pub-reward-save">{copy.save}</div>
            </div>
          </div>
        )}

        <div className="pub-reward-free">{copy.free}</div>

        {!supported && (
          <div className="pub-reward-actions">
            <button type="button" className="w-btn w-btn--accent w-btn--sm" onClick={handleSupported}>
              {copy.supportedBtn}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
