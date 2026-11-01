import { Drawer, Tooltip, Dropdown, App as AntApp } from 'antd'
import { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import {
  WeatherMoonRegular,
  WeatherSunnyRegular,
  NavigationRegular,
  SearchRegular,
  SignOutRegular,
  Wifi1Regular,
  WifiOffRegular,
  Speaker2Regular,
  Battery10Regular,
  ChevronUpRegular,
  SubtractRegular,
  SquareRegular,
  DismissRegular,
  ArrowMinimizeRegular,
  FolderRegular,
  GlobeRegular,
  SettingsRegular,
  WindowMultipleRegular,
  DatabaseRegular,
} from '@fluentui/react-icons'
import dayjs from 'dayjs'
import Sidebar, { SidebarContent } from './Sidebar'
import AIDock from './AIDock'
import MobileTabBar from './MobileTabBar'
import LibraryPickerSheet from '@/components/library/LibraryPickerSheet'
import PageTransition from '@/components/common/PageTransition'
import AppIcon from '@/components/common/AppIcon'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { useAiUiStore } from '@/store/aiUiStore'
import { resetSession } from '@/store/session'
import GlobalSearch from '@/components/common/GlobalSearch'
import { useAppStore } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'
import { useLibraryStore } from '@/store/libraryStore'
import { useI18n } from '@/i18n'
import { sweepTrashOncePerDay } from '@/utils/trashSweep'
import WelcomeModal, { FIRST_RUN_SUPPORT_ENABLED } from '@/components/reward/WelcomeModal'
import { consumeWelcomePending, isWelcomeSeen, markWelcomeSeen } from '@/utils/welcome'
import { startReminderWatcher } from '@/utils/reminderNotify'
import { consumeTopOverlay, useBackButtonLayer } from '@/utils/backButton'

type WindowState = 'normal' | 'maximized' | 'minimized' | 'closed'

/** Windows 11 任务栏 Start 标记（四格） */
function WinLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="8" height="8" rx="1.2" fill="var(--w-accent)" />
      <rect x="11" y="1" width="8" height="8" rx="1.2" fill="var(--w-accent)" opacity="0.9" />
      <rect x="1" y="11" width="8" height="8" rx="1.2" fill="var(--w-accent)" opacity="0.9" />
      <rect x="11" y="11" width="8" height="8" rx="1.2" fill="var(--w-accent)" opacity="0.8" />
    </svg>
  )
}

/**
 * v9 · Windows 11 原生窗口外壳
 *
 * 屏幕 = Windows 11 桌面：壁纸 + 任务栏 + 无边框圆角 Mica 窗口。
 * 窗口 = 40px 标题栏（应用标识 / 拖拽区 / 搜索 / 主题 / 语言 / 账户 / 窗口按钮）
 *        + 68px Acrylic 图标导航 + Mica 内容区 + 28px 原生状态栏。
 * 保留：Ctrl+K 搜索、Ctrl+J AI、离线提示、AI 完成通知、欢迎弹窗、回收站清理、
 * 服务端校验、移动端抽屉与底栏。移动端退化为全屏 App。
 */
export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [libPickerOpen, setLibPickerOpen] = useState(false)
  const [windowState, setWindowState] = useState<WindowState>('normal')
  const { settings, setTheme, setLanguage } = useAppStore()
  const t = useI18n()
  const isDark = settings.theme === 'dark'

  // 移动端断点与 CSS 保持一致
  const [isMobile, setIsMobile] = useState(() => (typeof window === 'undefined' ? false : window.innerWidth <= 900))
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 900)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // 任务栏时钟
  const [now, setNow] = useState(() => dayjs())
  useEffect(() => {
    const id = window.setInterval(() => setNow(dayjs()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  // 回收站自动清理：每天首次进入主界面时扫除一次（软删超 30 天彻底删除）
  useEffect(() => {
    void sweepTrashOncePerDay()
  }, [])

  // —— 首次注册欢迎页（含赞赏码）——
  const { account } = useAuthStore()
  const navigate = useNavigate()
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const closeWelcome = () => {
    if (account) markWelcomeSeen(account.id)
    setWelcomeOpen(false)
  }
  useEffect(() => {
    if (!account) return
    const pending = consumeWelcomePending()
    if (!FIRST_RUN_SUPPORT_ENABLED) return
    if (pending && !isWelcomeSeen(account.id)) setWelcomeOpen(true)
  }, [account])
  useBackButtonLayer(welcomeOpen, closeWelcome)

  // 库列表必须在 AppShell 加载（手机端 Drawer 不预渲染，Sidebar 内加载会拿不到）
  const loadLibraries = useLibraryStore((s) => s.loadLibraries)
  useEffect(() => {
    if (!account) return
    void loadLibraries().catch((e: unknown) => {
      console.error('[AppShell] 加载管理库失败:', e)
    })
  }, [account, loadLibraries])
  const libraries = useLibraryStore((s) => s.libraries)
  const currentLibraryId = useLibraryStore((s) => s.currentLibraryId)
  const currentLib = libraries.find((l) => l.id === currentLibraryId) ?? null
  const siderRef = useRef<HTMLDivElement>(null)

  // 到期提醒浏览器通知
  useEffect(() => {
    if (!account) return
    const stop = startReminderWatcher(
      () => useAuthStore.getState().account?.id ?? '',
      () => useLibraryStore.getState().libraries,
    )
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 启动函数内部现行从 store 读最新账号
  }, [account?.id])

  // 供外部通过自定义事件打开 AI 面板
  const setAiOpen = useAiUiStore((s) => s.setOpen)
  const aiOpen = useAiUiStore((s) => s.open)
  const aiCollapsed = useAiUiStore((s) => s.collapsed)
  useEffect(() => {
    const open = () => setAiOpen(true)
    window.addEventListener('open-ai-panel', open)
    return () => window.removeEventListener('open-ai-panel', open)
  }, [setAiOpen])

  // —— 全局搜索：Ctrl/Cmd + K ——
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
  const { notification } = AntApp.useApp()
  const lastDoneAt = useAiUiStore((s) => s.lastDone?.at ?? 0)
  const setDockOpen = useAiUiStore((s) => s.setOpen)
  useEffect(() => {
    if (!lastDoneAt) return
    const st = useAiUiStore.getState()
    if (st.open && !st.collapsed) return
    const done = st.lastDone
    if (!done) return
    void notification.open({
      key: `ai-done-${done.at}`,
      message: t('ai.doneTitle'),
      description: done.text,
      duration: 8,
      placement: 'bottomRight',
      actions: (
        <button
          type="button"
          className="w-btn w-btn--subtle w-btn--sm"
          onClick={() => {
            setDockOpen(true)
            void notification.destroy(`ai-done-${done.at}`)
          }}
        >
          {t('ai.viewResult')}
        </button>
      ),
    })
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

  // 离线状态
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  useBackButtonLayer(sidebarOpen, () => setSidebarOpen(false))

  const showDock = !isMobile && aiOpen && !aiCollapsed
  const hiddenWindow = windowState === 'minimized' || windowState === 'closed'
  const restored = () => setWindowState('normal')

  const clockTime = now.format(settings.language === 'en' ? 'h:mm A' : 'HH:mm')
  const clockDate = now.format(settings.language === 'en' ? 'M/D/YYYY' : 'YYYY/M/D')

  const windowCls = [
    'w-window',
    isMobile ? 'w-window--mobile' : '',
    windowState === 'maximized' ? 'w-window--maximized' : '',
    hiddenWindow ? 'w-window--hidden' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const titlebar = !isMobile && (
    <header
      className="w-titlebar"
      data-tauri-drag-region
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('button, input, [role="button"]')) return
        setWindowState((s) => (s === 'maximized' ? 'normal' : 'maximized'))
      }}
    >
      <button
        type="button"
        className="w-titlebar-brand"
        data-tauri-drag-region
        onClick={() => navigate('/')}
        aria-label={t('app.home')}
      >
        <AppIcon size={16} />
        <span className="w-titlebar-title">
          {t('app.brand')}
          {currentLib ? ` — ${currentLib.name}` : ''}
        </span>
      </button>
      <div className="w-titlebar-drag" data-tauri-drag-region />
      <button
        type="button"
        className="w-titlebar-search"
        onClick={() => setSearchOpen(true)}
        aria-label={t('app.search')}
      >
        <SearchRegular fontSize={14} />
        <span className="w-titlebar-search-label">{t('app.search')}</span>
        <kbd className="w-kbd">Ctrl K</kbd>
      </button>
      <div className="w-titlebar-tools">
        <Tooltip title={isDark ? t('app.theme.light') : t('app.theme.dark')}>
          <button
            type="button"
            className="w-titlebar-tool"
            aria-label={isDark ? t('app.theme.light') : t('app.theme.dark')}
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
          >
            {isDark ? <WeatherSunnyRegular fontSize={15} /> : <WeatherMoonRegular fontSize={15} />}
          </button>
        </Tooltip>
        <Tooltip title={settings.language === 'zh' ? 'English' : '中文'}>
          <button
            type="button"
            className="w-titlebar-tool w-titlebar-tool--text"
            aria-label={t('app.language')}
            onClick={() => setLanguage(settings.language === 'zh' ? 'en' : 'zh')}
          >
            {settings.language === 'zh' ? 'EN' : '中'}
          </button>
        </Tooltip>
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          menu={{
            items: [
              { key: 'who', label: account?.username ?? '', disabled: true },
              { type: 'divider' },
              {
                key: 'logout',
                icon: <SignOutRegular fontSize={16} />,
                label: t('app.signOut'),
                onClick: async () => {
                  await resetSession()
                  navigate('/login')
                },
              },
            ],
          }}
        >
          <button type="button" className="w-titlebar-tool" aria-label={t('app.signOut')}>
            <span className="w-avatar w-avatar--sm">{(account?.username ?? '?').slice(0, 1)}</span>
          </button>
        </Dropdown>
      </div>
      <div className="w-caption">
        <button
          type="button"
          className="w-caption-btn"
          aria-label={t('w11.caption.min')}
          title={t('w11.caption.min')}
          onClick={() => setWindowState('minimized')}
        >
          <SubtractRegular fontSize={12} />
        </button>
        <button
          type="button"
          className="w-caption-btn"
          aria-label={windowState === 'maximized' ? t('w11.caption.restore') : t('w11.caption.max')}
          title={windowState === 'maximized' ? t('w11.caption.restore') : t('w11.caption.max')}
          onClick={() => setWindowState((s) => (s === 'maximized' ? 'normal' : 'maximized'))}
        >
          {windowState === 'maximized' ? <ArrowMinimizeRegular fontSize={12} /> : <SquareRegular fontSize={11} />}
        </button>
        <button
          type="button"
          className="w-caption-btn w-caption-btn--close"
          aria-label={t('w11.caption.close')}
          title={t('w11.caption.close')}
          onClick={() => setWindowState('closed')}
        >
          <DismissRegular fontSize={13} />
        </button>
      </div>
    </header>
  )

  const mobileTitlebar = isMobile && (
    <header className="w-mobile-titlebar">
      <button
        type="button"
        className="w-iconbtn w-iconbtn--sm"
        aria-label={t('nav.menu')}
        onClick={() => setSidebarOpen(true)}
      >
        <NavigationRegular fontSize={18} />
      </button>
      <span className="w-mobile-titlebar-title">
        <AppIcon size={18} />
        {currentLib ? currentLib.name : t('app.brand')}
      </span>
      <button
        type="button"
        className="w-iconbtn w-iconbtn--sm"
        aria-label={t('app.search')}
        onClick={() => setSearchOpen(true)}
      >
        <SearchRegular fontSize={18} />
      </button>
    </header>
  )

  return (
    <div className="w-stage">
      {!isMobile && (
        <div className="w-taskbar" role="toolbar" aria-label={t('w11.taskbar')}>
          <div className="w-taskbar-center">
            <span className="w-tb-btn w-tb-start" aria-hidden="true">
              <WinLogo size={20} />
            </span>
            <button
              type="button"
              className="w-tb-btn"
              aria-label={t('app.search')}
              title={t('app.search')}
              onClick={() => setSearchOpen(true)}
            >
              <SearchRegular fontSize={18} />
            </button>
            <span className="w-tb-btn" aria-hidden="true">
              <WindowMultipleRegular fontSize={18} />
            </span>
            <span className="w-tb-sep" role="presentation" />
            <button
              type="button"
              className={`w-tb-btn${!hiddenWindow ? ' is-active' : ''}`}
              aria-label={t('app.brand')}
              title={t('app.brand')}
              onClick={() => {
                if (!hiddenWindow) navigate('/')
                else restored()
              }}
            >
              <AppIcon size={22} className="w-tb-appicon" />
            </button>
            <button
              type="button"
              className="w-tb-btn"
              aria-label={t('app.home')}
              title={t('app.home')}
              onClick={() => navigate('/')}
            >
              <FolderRegular fontSize={18} />
            </button>
            <button
              type="button"
              className="w-tb-btn"
              aria-label={t('app.help')}
              title={t('app.help')}
              onClick={() => navigate('/help')}
            >
              <GlobeRegular fontSize={18} />
            </button>
            <button
              type="button"
              className="w-tb-btn"
              aria-label={t('app.settings')}
              title={t('app.settings')}
              onClick={() => navigate('/settings')}
            >
              <SettingsRegular fontSize={18} />
            </button>
          </div>
          <div className="w-taskbar-tray">
            <span className="w-tb-tray-btn" aria-hidden="true">
              <ChevronUpRegular fontSize={13} />
            </span>
            <span className="w-tb-tray-btn" aria-hidden="true">
              {online ? <Wifi1Regular fontSize={15} /> : <WifiOffRegular fontSize={15} />}
            </span>
            <span className="w-tb-tray-btn" aria-hidden="true">
              <Speaker2Regular fontSize={15} />
            </span>
            <span className="w-tb-tray-btn" aria-hidden="true">
              <Battery10Regular fontSize={15} />
            </span>
            <div className="w-tb-clock" aria-hidden="true">
              <span>{clockTime}</span>
              <span className="w-tb-clock-date">{clockDate}</span>
            </div>
          </div>
        </div>
      )}

      {hiddenWindow && (
        <div className="w-desktop-icons">
          <button type="button" className="w-desktop-app" onClick={restored} aria-label={`${t('w11.desktop.reopen')}${t('app.brand')}`}>
            <AppIcon size={48} className="w-desktop-icon-img" />
            <span className="w-desktop-app-label">{t('app.brand')}</span>
          </button>
        </div>
      )}

      <div className={windowCls} aria-hidden={hiddenWindow || undefined}>
        {isMobile ? mobileTitlebar : titlebar}
        <div className="w-window-body">
          {isMobile ? (
            <Drawer
              placement="left"
              open={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              width={300}
              closable={false}
              styles={{ body: { padding: 0, background: 'transparent' } }}
            >
              <SidebarContent
                onOpenPanel={() => { setAiOpen(true); setSidebarOpen(false) }}
                onNavigate={() => setSidebarOpen(false)}
              />
            </Drawer>
          ) : (
            <Sidebar onOpenPanel={() => setAiOpen(true)} siderRef={siderRef} />
          )}
          <Group orientation="horizontal" id="v9-ai-dock" className="w-panels">
            <Panel id="main" minSize="54%" className="w-panel-main">
              <div className="w-main">
                {!online && (
                  <div className="w-banner w-banner--warning" role="status">
                    <WifiOffRegular fontSize={16} />
                    <span>{t('app.offline')}</span>
                  </div>
                )}
                <div className="w-content">
                  <PageTransition>
                    <Outlet />
                  </PageTransition>
                </div>
              </div>
            </Panel>
            {showDock && (
              <>
                <Separator id="ai-sep" className="w-resize-handle" aria-label={t('ai.resize')} />
                <Panel id="ai" defaultSize="30%" minSize="20%" maxSize="46%" className="w-panel-ai">
                  <AIDock variant="dock" />
                </Panel>
              </>
            )}
          </Group>
        </div>
        {!isMobile && (
          <footer className="w-statusbar">
            <div className="w-statusbar-group">
              <span className={`w-statusbar-dot${online ? '' : ' is-offline'}`} aria-hidden="true" />
              <DatabaseRegular fontSize={13} />
              <span>{t('w11.status.local')}</span>
              <span className="w-statusbar-sep" role="presentation" />
              <span>{t('w11.status.libraries', { n: String(libraries.length) })}</span>
            </div>
            <div className="w-statusbar-group">
              {currentLib ? <span>{currentLib.name}</span> : null}
              <span className="w-statusbar-sep" role="presentation" />
              <span>{online ? t('w11.status.online') : t('w11.status.offline')}</span>
            </div>
          </footer>
        )}
        {isMobile && (
          <>
            <MobileTabBar
              onOpenLibraries={() => setLibPickerOpen(true)}
              onDismiss={() => {
                if (libPickerOpen) consumeTopOverlay()
                setLibPickerOpen(false)
              }}
            />
            <LibraryPickerSheet open={libPickerOpen} onClose={() => setLibPickerOpen(false)} />
          </>
        )}
      </div>

      {!showDock && <AIDock variant={isMobile ? 'sheet' : 'dock'} />}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      {account && <WelcomeModal open={welcomeOpen} accountId={account.id} onClose={closeWelcome} />}
    </div>
  )
}
