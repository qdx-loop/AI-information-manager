import { useEffect, useMemo, useState } from 'react'
import { Result, Button, Card, Typography, Alert } from 'antd'
import { AppstoreAddOutlined, WarningOutlined } from '@ant-design/icons'
import { useLibraryStore } from '@/store/libraryStore'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/i18n'
import HomeDashboard from './HomeDashboard'
import GettingStarted from './GettingStarted'
import CreateLibraryDialog from './CreateLibraryDialog'


const { Paragraph } = Typography

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
    <div style={{ padding: 24, height: '100%' }}>
      <Card>
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

        <GettingStarted />

        {libraries.length > 0 ? (
          <>
            <Result
              icon={<AppstoreAddOutlined style={{ color: 'var(--app-glaze)' }} />}
              title={t('home.greeting', { name: account?.username ?? '' })}
              subTitle={t('home.pick')}
              style={{ paddingBottom: 12 }}
              /* 之前只有 libraries.length === 0 的分支才有建库按钮，
                 有库之后首页就只剩「模板中心」，移动端要建第 2 个库得点进汉堡抽屉三下。 */
              extra={
                <Button type="primary" size="large" icon={<AppstoreAddOutlined />} onClick={openNaming}>
                  {t('home.createFirst')}
                </Button>
              }
            />
            <HomeDashboard />
          </>
        ) : (
          <>
            <Result
              icon={<AppstoreAddOutlined style={{ color: 'var(--app-glaze)' }} />}
              title={t('home.greeting', { name: account?.username ?? '' })}
              subTitle={t('home.empty')}
              extra={
                <Button type="primary" size="large" icon={<AppstoreAddOutlined />} onClick={openNaming}>
                  {t('home.createFirst')}
                </Button>
              }
            />
            <Paragraph type="secondary" style={{ textAlign: 'center' }}>
              {t('home.tip')}
            </Paragraph>
          </>
        )}
      </Card>

      <CreateLibraryDialog open={namingOpen} onClose={() => setNamingOpen(false)} />
    </div>
  )
}
