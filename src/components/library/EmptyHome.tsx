import { useEffect, useMemo, useState } from 'react'
import { DismissRegular } from '@fluentui/react-icons'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/i18n'
import HomeDashboard from './HomeDashboard'
import CreateLibraryDialog from './CreateLibraryDialog'

// iOS Safari 会对"7 天未使用"的网站清除本地存储（含 IndexedDB）。
// 本地模式下数据只存在浏览器里，必须提醒买家开启云同步或定期导出备份（红队报告 P6）。
function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && 'touchend' in document)
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|EdgiOS|FxiOS|Opt/.test(ua)
  const standalone =
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  return isIOS && isSafari && !standalone
}

const RISK_KEY = 'info-mgmt-safari-risk-dismissed'

/**
 * 首页入口 v9。
 *
 * 页面本体（页头 / 已固定 / 最近修改 / 今天 / 数据概览 / 快速操作）由 HomeDashboard
 * 负责；这里只做 iOS 本地存储风险提示（Win11 InfoBar 形态）与建库弹窗。
 */
export default function EmptyHome() {
  const t = useI18n()
  const { settings } = useAppStore()

  const [namingOpen, setNamingOpen] = useState(false)

  const safariRisk = useMemo(
    () => settings.storageMode === 'local' && isIosSafari(),
    [settings.storageMode],
  )
  const [riskDismissed, setRiskDismissed] = useState(true)
  useEffect(() => {
    setRiskDismissed(localStorage.getItem(RISK_KEY) === '1')
  }, [])

  const openNaming = () => setNamingOpen(true)

  const notice = safariRisk && !riskDismissed ? (
    <div className="w-card w-home-notice" role="note">
      <div className="w-row-main">
        <div className="w-row-title w-row-title--strong">{t('home.safari.title')}</div>
        <div className="w-row-desc" style={{ whiteSpace: 'normal' }}>
          {t('home.safari.body')}
        </div>
      </div>
      <button
        type="button"
        className="w-iconbtn w-iconbtn--sm"
        aria-label={t('common.close')}
        onClick={() => {
          localStorage.setItem(RISK_KEY, '1')
          setRiskDismissed(true)
        }}
      >
        <DismissRegular fontSize={16} />
      </button>
    </div>
  ) : null

  return (
    <>
      <HomeDashboard onCreate={openNaming} notice={notice} />
      <CreateLibraryDialog open={namingOpen} onClose={() => setNamingOpen(false)} />
    </>
  )
}
