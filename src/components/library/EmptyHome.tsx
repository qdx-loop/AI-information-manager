import { useEffect, useMemo, useState } from 'react'
import { Button } from 'antd'
import { InfoCircleOutlined, CloseOutlined } from '@ant-design/icons'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/i18n'
import HomeDashboard from './HomeDashboard'
import CreateLibraryDialog from './CreateLibraryDialog'
import { usePagePadding } from './pageFrame'


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

export default function EmptyHome() {
  const t = useI18n()
  const pad = usePagePadding()
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


  return (
    <div style={{ ...pad, height: '100%', overflow: 'auto' }}>
      {/*
        数据风险提示。
        v3 是所有内容都要有「表面」：这里用一张轻量白卡承载警告，而不是整条黄色 Alert 色块；
        也不再用颜色当唯一信息通道 —— 文案说清「什么会发生、该做什么」。
      */}
      {safariRisk && !riskDismissed && (
        <div
          className="surface-card"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '14px 16px',
            marginBottom: 16,
          }}
        >
          <InfoCircleOutlined style={{ fontSize: 18, color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} aria-hidden />
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--ink)' }}>{t('home.safari.title')}</div>
            <div className="muted" style={{ fontSize: 'var(--text-xs)', lineHeight: 1.6, marginTop: 2 }}>
              {t('home.safari.body')}
            </div>
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
      )}

      {/* 首页主体（页头 + KPI 白卡 + 两栏白卡）由 HomeDashboard 负责；
          这里只承载建库弹窗与 iOS 存储风险提示。 */}
      <HomeDashboard onCreate={openNaming} />

      <CreateLibraryDialog open={namingOpen} onClose={() => setNamingOpen(false)} />
    </div>
  )
}
