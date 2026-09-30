import { Layout, Drawer, Button, Tooltip, Tour, Dropdown, Avatar, App as AntApp } from 'antd'
import type { TourProps } from 'antd'
import { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { MoonOutlined, SunOutlined, MenuOutlined, SearchOutlined, LogoutOutlined } from '@ant-design/icons'
import Sidebar, { SidebarContent } from './Sidebar'
import AIDock from './AIDock'
import AIFab from './AIFab'
import { useAiUiStore, aiPanelVisible } from '@/store/aiUiStore'
import GlobalSearch from '@/components/common/GlobalSearch'
import { useAppStore } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'
import { useLibraryStore } from '@/store/libraryStore'
import { useI18n } from '@/i18n'
import { sweepTrashOncePerDay } from '@/utils/trashSweep'
import { isTourDone, markTourDone } from '@/utils/onboarding'
import { startReminderWatcher } from '@/utils/reminderNotify'

const { Content, Header } = Layout

export default function AppShell() {
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
  const { account, logout } = useAuthStore()
  const navigate = useNavigate()
  const libraries = useLibraryStore((s) => s.libraries)
  const currentLibraryId = useLibraryStore((s) => s.currentLibraryId)
  const currentLib = libraries.find((l) => l.id === currentLibraryId) ?? null
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
  const setAiOpen = useAiUiStore((s) => s.setOpen)
  useEffect(() => {
    const open = () => setAiOpen(true)
    window.addEventListener('open-ai-panel', open)
    return () => window.removeEventListener('open-ai-panel', open)
  }, [setAiOpen])

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

  // —— 后台任务完成提示 ——
  // 面板关着/收起时任务照样在跑（面板常驻挂载），跑完要能通知到人，
  // 否则用户根本不知道后台已经做完了。
  const { notification } = AntApp.useApp()
  const lastDoneAt = useAiUiStore((s) => s.lastDone?.at ?? 0)
  const setDockOpen = useAiUiStore((s) => s.setOpen)
  useEffect(() => {
    if (!lastDoneAt) return
    const st = useAiUiStore.getState()
    if (aiPanelVisible(st)) return // 正在看着面板，就别弹提示抢注意力
    const done = st.lastDone
    if (!done) return
    // 用 notification 而不是 message：这是「后台做完了」的一条独立事件，
    // 需要能带一个「查看结果」按钮把人带回面板。
    void notification.open({
      key: `ai-done-${done.at}`,
      message: t('ai.doneTitle'),
      description: done.text,
      duration: 8,
      placement: 'bottomRight',
      actions: (
        <button
          type="button"
          className="ai-done-link"
          onClick={() => {
            setDockOpen(true)
            void notification.destroy(`ai-done-${done.at}`)
          }}
        >
          {t('ai.viewResult')}
        </button>
      ),
    })
    // t 变化不该重复弹
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastDoneAt, setDockOpen])

  // —— ⌘/Ctrl + J：全局唤起 AI ——
  const toggleDock = useAiUiStore((s) => s.toggle)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault()
        toggleDock()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleDock])

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
    <Layout style={{ height: '100vh', display: 'flex' }}>
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
      <div className="app-main">
      <Layout>
        <Header
          style={{
            height: 52,
            lineHeight: '52px',
            padding: '0 12px',
            background: 'var(--app-surface)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            borderBottom: '1px solid var(--app-border-soft)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1 }}>
            {isMobile && (
              <Button
                type="text"
                aria-label={t('nav.menu')}
                icon={<MenuOutlined />}
                onClick={() => setSidebarOpen(true)}
              />
            )}
            {/* 当前位置：分类 / 库名。用户任何时候都知道自己在哪个库里，
                不必回头看侧边栏；没有选中库时回落到产品名。 */}
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--app-ink)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
              }}
            >
              {currentLib ? currentLib.name : t('app.brand')}
            </span>
            {currentLib?.category && !isMobile && (
              <span style={{ fontSize: 12.5, color: 'var(--app-ink-faint)', flexShrink: 0 }}>
                {currentLib.category}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {!isMobile && (
              <Button
                size="small"
                onClick={() => setSearchOpen(true)}
                style={{
                  height: 30,
                  width: 200,
                  justifyContent: 'flex-start',
                  gap: 6,
                  color: 'var(--app-ink-faint)',
                  fontWeight: 400,
                  background: 'var(--app-canvas)',
                }}
                icon={<SearchOutlined />}
              >
                {t('app.search')}
                <kbd
                  style={{
                    marginLeft: 'auto',
                    fontSize: 11,
                    lineHeight: '16px',
                    padding: '0 4px',
                    borderRadius: 4,
                    border: '1px solid var(--app-border)',
                    color: 'var(--app-ink-faint)',
                  }}
                >
                  ⌘K
                </kbd>
              </Button>
            )}
            {isMobile && (
              <Button
                type="text"
                aria-label={t('app.search')}
                icon={<SearchOutlined />}
                onClick={() => setSearchOpen(true)}
              />
            )}
            <Tooltip title={isDark ? t('app.theme.light') : t('app.theme.dark')}>
              <Button
                type="text"
                aria-label={isDark ? t('app.theme.light') : t('app.theme.dark')}
                icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
              />
            </Tooltip>
            <Tooltip title={settings.language === 'zh' ? 'English' : '中文'}>
              <Button
                type="text"
                aria-label="language"
                onClick={() => setLanguage(settings.language === 'zh' ? 'en' : 'zh')}
              >
                {settings.language === 'zh' ? 'EN' : '中'}
              </Button>
            </Tooltip>
            {/* 用户菜单：手机上侧边栏收在抽屉里，退出登录/账号信息必须在头部可达 */}
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'who', label: account?.username ?? '', disabled: true },
                  { type: 'divider' },
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: t('app.signOut'),
                    onClick: () => {
                      logout()
                      navigate('/login')
                    },
                  },
                ],
              }}
            >
              <Button type="text" className="tap" aria-label={t('app.signOut')}>
                <Avatar size={26} style={{ background: 'var(--app-glaze)' }}>
                  {(account?.username ?? '?').slice(0, 1).toUpperCase()}
                </Avatar>
              </Button>
            </Dropdown>
          </div>
        </Header>
        <Content ref={contentRef} style={{ flex: 1, overflow: 'auto', background: 'var(--app-canvas)' }}>
          <Outlet />
        </Content>
      </Layout>
      {/* AI 助手：桌面停靠在右侧、把内容推开；手机是底部抽屉。两者都不带遮罩 */}
      <AIDock variant={isMobile ? 'sheet' : 'dock'} />
      </div>
      <AIFab compact={isMobile} />
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
