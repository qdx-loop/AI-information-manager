import { useEffect, useMemo, useState } from 'react'
import { Button } from 'antd'
import { CloseOutlined } from '@/components/common/icons'
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
 * 首页入口。
 *
 * 页面本体（page-head + Bento + 待办/最近动态）全部由 HomeDashboard 负责，
 * 这里只做两件事：iOS 本地存储风险提示（作为 notice 注入页头之上）与建库弹窗。
 * v4 语言：提示是一块 2px 硬边 panel + signal 色条，不是柔和 Alert。
 */
export default function EmptyHome() {
  const t = useI18n()
  const { settings } = useAppStore()

  // 建库命名弹窗（替代原先一键创建"未命名管理库"的草率路径）
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
    <div
      className="panel"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        marginBottom: 'var(--s5)',
        borderLeft: '6px solid var(--accent-2)',
        background: 'var(--surface)',
      }}
    >
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--t-md)', fontWeight: 800, letterSpacing: '-0.01em' }}>
          {t('home.safari.title')}
        </div>
        <p className="page-sub" style={{ fontSize: 'var(--t-xs)', marginTop: 2 }}>
          {t('home.safari.body')}
        </p>
      </div>
      <Button
        type="text"
        className="icon-btn"
        aria-label={t('common.close')}
        icon={<CloseOutlined />}
        onClick={() => {
          localStorage.setItem(RISK_KEY, '1')
          setRiskDismissed(true)
        }}
      />
    </div>
  ) : null

  return (
    <>
      <HomeDashboard onCreate={openNaming} notice={notice} />
      <CreateLibraryDialog open={namingOpen} onClose={() => setNamingOpen(false)} />
    </>
  )
}
