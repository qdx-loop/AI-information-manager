import { useEffect, useMemo, useState } from 'react'
import { Alert } from 'antd'
import { WarningOutlined } from '@ant-design/icons'
import { useLibraryStore } from '@/store/libraryStore'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/i18n'
import HomeDashboard from './HomeDashboard'
import GettingStarted from './GettingStarted'
import CreateLibraryDialog from './CreateLibraryDialog'


// iOS Safari 会对"7 天未使用"的网站清除本地存储（含 IndexedDB）。
// 本地模式下数据只存在浏览器里，必须提醒买家开启云同步或定期导出备份（红队报告 P6）。
function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document)
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|EdgiOS|FxiOS|Opt/.test(ua)
  const standalone =
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  return isIOS && isSafari && !standalone
}

const RISK_KEY = 'info-mgmt-safari-risk-dismissed'

export default function EmptyHome() {
  const t = useI18n()
  const { account } = useAuthStore()
  const { settings } = useAppStore()
  const { libraries } = useLibraryStore()

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
    <div style={{ padding: '28px 24px 32px', height: '100%', overflow: 'auto' }}>
      {safariRisk && !riskDismissed && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 16 }}
          message={t('home.safari.title')}
          description={
            <span>
              {t('home.safari.body')}
            </span>
          }
          closable
          onClose={() => {
            localStorage.setItem(RISK_KEY, '1')
            setRiskDismissed(true)
          }}
        />
      )}

      {/* 首页头：编辑部式 greeting——文字就是主视觉，不需要插图和盒子 */}
      <header style={{ marginBottom: 18 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'var(--app-ink)',
          }}
        >
          {t('home.greeting', { name: account?.username ?? '' })}
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--app-ink-faint)' }}>
          {libraries.length > 0 ? t('home.pick') : t('home.empty')}
        </p>
      </header>

      <div style={{ marginBottom: 20 }}>
        <button
          type="button"
          onClick={openNaming}
          style={{
            height: 40,
            padding: '0 18px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--app-glaze)',
            color: '#fff',
            font: 'inherit',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {t('home.createFirst')}
        </button>
      </div>

      <GettingStarted />

      {libraries.length > 0 ? (
        <HomeDashboard />
      ) : (
        <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--app-ink-faint)' }}>
          {t('home.tip')}
        </p>
      )}

      <CreateLibraryDialog open={namingOpen} onClose={() => setNamingOpen(false)} />
    </div>
  )
}
