import { Layout, Drawer, Button, Tooltip, Spin, Tour } from 'antd'
import type { TourProps } from 'antd'
import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { MoonOutlined, SunOutlined, MenuOutlined } from '@ant-design/icons'
import Sidebar, { SidebarContent } from './Sidebar'
import ExpiryBanner from './ExpiryBanner'
import GlobalSearch from '@/components/common/GlobalSearch'
import { useAppStore } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'
import { useLibraryStore } from '@/store/libraryStore'
import { useI18n } from '@/i18n'
import { sweepTrashOncePerDay } from '@/utils/trashSweep'
import { isTourDone, markTourDone } from '@/utils/onboarding'
import { startReminderWatcher } from '@/utils/reminderNotify'

// AI 面板懒加载：xlsx/papaparse/react-markdown 等重依赖只在首次打开抽屉时下载，
// 显著缩小首屏主包（红队报告 P10）
const AIPanel = lazy(() => import('@/components/ai/AIPanel'))

const { Content, Header } = Layout

export default function AppShell() {
  const [aiOpen, setAiOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { settings, setTheme, setLanguage } = useAppStore()
  const t = useI18n()
  const isDark = settings.theme === 'dark'

  // 检测移动端
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // 回收站自动清理：每天首次进入主界面时扫除一次（软删超 30 天彻底删除）
  useEffect(() => {
    void sweepTrashOncePerDay()
  }, [])

  // —— 首次登录引导 Tour（仅桌面端，每账号一次）——
  const { account } = useAuthStore()
  const siderRef = useRef<HTMLDivElement>(null)
  const aiRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [tourOpen, setTourOpen] = useState(false)

  // —— 到期提醒的浏览器通知：登录态下常驻检查（每 30 分钟 + 启动一次）——
  useEffect(() => {
    if (!account) return
    const stop = startReminderWatcher(
      () => useAuthStore.getState().account?.id ?? '',
      () => useLibraryStore.getState().libraries,
    )
    return stop
  }, [account?.id])

  useEffect(() => {
    if (account && !isMobile && !isTourDone(account.id)) {
      const timer = setTimeout(() => setTourOpen(true), 600)
      return () => clearTimeout(timer)
    }
  }, [account, isMobile])

  // 供新手清单等处通过自定义事件打开 AI 面板
  useEffect(() => {
    const open = () => setAiOpen(true)
    window.addEventListener('open-ai-panel', open)
    return () => window.removeEventListener('open-ai-panel', open)
  }, [])

  // —— 全局搜索：Ctrl/Cmd + K 唤起 ——
  const [searchOpen, setSearchOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const tourSteps: TourProps['steps'] = [
    {
      title: t('tour.lib.title'),
      description: t('tour.lib.desc'),
      target: () => siderRef.current!,
      placement: 'right',
    },
    {
      title: t('tour.ai.title'),
      description: t('tour.ai.desc'),
      target: () => aiRef.current!,
      placement: 'right',
    },
    {
      title: t('tour.home.title'),
      description: t('tour.home.desc'),
      target: () => contentRef.current!,
      placement: 'center',
    },
  ]

  return (
    <Layout style={{ height: '100vh' }}>
      {isMobile ? (
        <Drawer
          placement="left"
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          width={260}
          styles={{ body: { padding: 0 } }}
        >
          <SidebarContent onOpenPanel={() => { setAiOpen(true); setSidebarOpen(false) }} />
        </Drawer>
      ) : (
        <Sidebar onOpenPanel={() => setAiOpen(true)} siderRef={siderRef} aiRef={aiRef} />
      )}
      <Layout>
        <Header
          style={{
            padding: '0 16px',
            background: isDark ? '#141414' : '#fff',
            display: 'flex',
            justifyContent: isMobile ? 'space-between' : 'flex-end',
            alignItems: 'center',
            borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
          }}
        >
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setSidebarOpen(true)}
            />
          )}
          <Tooltip title={settings.language === 'zh' ? 'English' : '中文'}>
            <Button type="text" onClick={() => setLanguage(settings.language === 'zh' ? 'en' : 'zh')}>
              {settings.language === 'zh' ? 'EN' : '中'}
            </Button>
          </Tooltip>
          <Tooltip title={isDark ? t('app.theme.light') : t('app.theme.dark')}>
            <Button
              type="text"
              icon={isDark ? <SunOutlined /> : <MoonOutlined />}
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
            />
          </Tooltip>
        </Header>
        <ExpiryBanner />
        <Content ref={contentRef} style={{ flex: 1, overflow: 'auto', background: isDark ? '#141414' : '#f5f5f5' }}>
          <Outlet />
        </Content>
      </Layout>
      <Drawer
        title="AI 助手"
        placement="right"
        width={isMobile ? '100%' : 460}
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        styles={{ body: { padding: 0 } }}
      >
        <Suspense
          fallback={
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
              <Spin tip="正在加载 AI 助手…" />
            </div>
          }
        >
          <AIPanel />
        </Suspense>
      </Drawer>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Tour
        open={tourOpen}
        steps={tourSteps}
        onClose={() => {
          setTourOpen(false)
          if (account) markTourDone(account.id)
        }}
        onFinish={() => {
          setTourOpen(false)
          if (account) markTourDone(account.id)
        }}
      />
    </Layout>
  )
}
