// 设置页「关于与支持」内容（常驻，全站唯一长期展示二维码的地方）· v10 Fluent。
//
// 依据：`redesign-brief/02-donation-research.md` §F.4（逐字文案）、§G.5–G.7（可扫性/无障碍）。
// v10 视觉：真实 Fluent Card（CardHeader + Divider + Text + Button）：
//   - 二维码卡面抽到 `RewardQr`（卡面固定白、不反色），本组件只负责排版与文案；
//   - 已支持（终态）只显示致谢，不再显示码与「我已经支持过了」；
//   - 设置页 support tab 直接渲染本组件（父级不再外包卡片），因此这里提供唯一的卡片面。
import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  CardHeader,
  Divider,
  MessageBar,
  MessageBarBody,
  Text,
} from '@fluentui/react-components'
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
    <Card appearance="filled" className="pub-reward-card">
      <CardHeader
        image={
          <span className="pub-icon-badge" aria-hidden>
            <HeartRegular fontSize={20} />
          </span>
        }
        header={
          <Text as="h2" size={600} weight="semibold">
            {copy.title}
          </Text>
        }
      />
      <Divider />
      <div className="pub-reward-body">
        <Text as="p" size={300} className="w-muted">
          {copy.lead}
        </Text>
        <Text as="p" size={300} className="w-muted">
          {copy.privacy}
        </Text>

        {supported ? (
          <MessageBar intent="success" className="pub-reward-thanks">
            <MessageBarBody>
              <CheckmarkCircleRegular aria-hidden /> {copy.supportedThanks}
            </MessageBarBody>
          </MessageBar>
        ) : (
          <div className="pub-reward-qr-row">
            <RewardQr src={qrSrc} />
            <div className="pub-reward-notes">
              <Text size={300} weight="semibold">
                {copy.scan}
              </Text>
              <Text size={200} className="w-faint">
                {copy.payBy}
              </Text>
              <Text size={200} className="w-faint">
                {copy.privacyShort}
              </Text>
              <Text size={200} className="w-faint pub-reward-save">
                {copy.save}
              </Text>
            </div>
          </div>
        )}

        <Text as="p" size={200} className="w-faint pub-reward-free">
          {copy.free}
        </Text>

        {!supported && (
          <div className="pub-reward-actions">
            <Button appearance="primary" size="small" onClick={handleSupported}>
              {copy.supportedBtn}
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
