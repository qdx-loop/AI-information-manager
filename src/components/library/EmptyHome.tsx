import { useEffect, useMemo, useState } from 'react'
import { Button } from 'antd'
import { useLibraryStore } from '@/store/libraryStore'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/i18n'
import HomeDashboard from './HomeDashboard'
import GettingStarted from './GettingStarted'
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
    <div style={{ ...pad, height: '100%', overflow: 'auto' }}>
      {/*
        数据风险提示。
        原来是 antd <Alert type="warning" showIcon> 大色块：一整条黄底 + 警告图标，
        在暖纸底上等于给页面开了一个黄色窗口（第三种色相）。
        现在是一行文字 + 朱砂/赭色小方点 + 关闭文字链，信息一条不少，色块归零。
      */}
      {safariRisk && !riskDismissed && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '10px 0',
            marginBottom: 16,
            borderBottom: '1px solid var(--app-rule)',
          }}
        >
          <span className="tag-dot" style={{ color: 'var(--app-warning)', flexShrink: 0, marginTop: 2 }}>
            {t('home.safari.title')}
          </span>
          <span className="muted" style={{ fontSize: 'var(--text-xs)', flex: '1 1 auto', lineHeight: 1.6 }}>
            {t('home.safari.body')}
          </span>
          <button
            type="button"
            className="link-quiet"
            style={{ font: 'inherit', fontSize: 'var(--text-xs)', background: 'none', border: 0, padding: 0, cursor: 'pointer', flexShrink: 0 }}
            onClick={() => {
              localStorage.setItem(RISK_KEY, '1')
              setRiskDismissed(true)
            }}
          >
            {t('common.close')}
          </button>
        </div>
      )}

      {/* 首页头：编辑部式 greeting——文字就是主视觉，不需要插图和盒子。
          26px 衬线是页面唯一的大标题；说明 13 muted；标题行高 40（与库页一致）。 */}
      <header style={{ marginBottom: 16 }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'baseline', minHeight: 40, flexWrap: 'wrap', gap: 12 }}>
          {t('home.greeting', { name: account?.username ?? '' })}
        </h1>
        <p className="page-lede" style={{ margin: '4px 0 0' }}>
          {libraries.length > 0 ? t('home.pick') : t('home.empty')}
        </p>
      </header>

      <div style={{ marginBottom: 24 }}>
        {/* 主按钮：墨色（colorPrimary 已换墨），32px 高、4px 圆角由 theme 统一 */}
        <Button type="primary" onClick={openNaming}>
          {t('home.createFirst')}
        </Button>
      </div>

      <GettingStarted />

      {libraries.length > 0 ? (
        <HomeDashboard />
      ) : (
        <p className="faint" style={{ margin: '12px 0 0', fontSize: 'var(--text-sm)' }}>
          {t('home.tip')}
        </p>
      )}

      <CreateLibraryDialog open={namingOpen} onClose={() => setNamingOpen(false)} />
    </div>
  )
}
