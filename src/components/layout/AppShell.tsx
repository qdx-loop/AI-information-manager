import { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import {
  Avatar,
  Button,
  Menu,
  MenuDivider,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarBody,
  Tooltip,
} from '@fluentui/react-components'
import {
  WeatherMoonRegular,
  WeatherSunnyRegular,
  NavigationRegular,
  SearchRegular,
  SignOutRegular,
  WifiOffRegular,
  DismissRegular,
  GlobeRegular,
  SettingsRegular,
  QuestionCircleRegular,
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
import { App as AntdApp, Drawer } from 'antd'

/**
 * v10 · FLUENT UI 2 应用外壳（Windows 11 风格，不是操作系统）
 *
 * 满屏应用：48px Fluent app bar + 68px 图标导航 + Fluent 内容画布 + 右侧 AI 面板。
 * 没有壁纸、任务栏、窗口、最小化/最大化/关闭、桌面图标、锁屏时钟。
 * 保留：Ctrl+K 搜索、Ctrl+J AI、离线提示、AI 完成通知、欢迎弹窗、回收站清理、
 * 服务端校验、移动端抽屉与底部标签栏。
 */
export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [libPickerOpen, setLibPickerOpen] = useState(false)
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

  // —— 后台任务完成提示（antd notification，主题由同一 Fluent token 派生）——
  const { notification } = AntdApp.useApp()
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

  const handleLogout = async () => {
    await resetSession()
    navigate('/login')
  }

  const themeToggle = (
    <Tooltip content={isDark ? t('app.theme.light') : t('app.theme.dark')} relationship="label">
      <Button
        appearance="subtle"
        icon={isDark ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
        aria-label={isDark ? t('app.theme.light') : t('app.theme.dark')}
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
      />
    </Tooltip>
  )

  const languageMenu = (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Tooltip content={t('app.language')} relationship="label">
          <Button appearance="subtle" icon={<GlobeRegular />} aria-label={t('app.language')}>
            <span style={{ fontSize: 'var(--fontSizeBase200)', fontWeight: 600 }}>
              {settings.language === 'zh' ? '中' : 'EN'}
            </span>
          </Button>
        </Tooltip>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          <MenuItem onClick={() => setLanguage('zh')} disabled={settings.language === 'zh'}>
            中文
          </MenuItem>
          <MenuItem onClick={() => setLanguage('en')} disabled={settings.language !== 'zh'}>
            English
          </MenuItem>
        </MenuList>
      </MenuPopover>
    </Menu>
  )

  const accountMenu = (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Tooltip content={account?.username ?? ''} relationship="label">
          <button type="button" className="w-appbar-account" aria-label={account?.username ?? t('app.signOut')}>
            <Avatar
              size={28}
              initials={(account?.username ?? '?').slice(0, 1).toUpperCase()}
              color="colorful"
              aria-hidden
            />
          </button>
        </Tooltip>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          <MenuItem disabled>{account?.username ?? ''}</MenuItem>
          <MenuDivider />
          <MenuItem icon={<SettingsRegular />} onClick={() => navigate('/settings')}>
            {t('app.settings')}
          </MenuItem>
          <MenuItem icon={<QuestionCircleRegular />} onClick={() => navigate('/help')}>
            {t('app.help')}
          </MenuItem>
          <MenuDivider />
          <MenuItem icon={<SignOutRegular />} onClick={() => void handleLogout()}>
            {t('app.signOut')}
          </MenuItem>
        </MenuList>
      </MenuPopover>
    </Menu>
  )

  const appbar = isMobile ? (
    <header className="w-mobile-appbar">
      <Button
        appearance="subtle"
        icon={<NavigationRegular />}
        aria-label={t('nav.menu')}
        onClick={() => setSidebarOpen(true)}
      />
      <span className="w-mobile-title">
        <AppIcon size={18} />
        {currentLib ? currentLib.name : t('app.brand')}
      </span>
      <Button
        appearance="subtle"
        icon={<SearchRegular />}
        aria-label={t('app.search')}
        onClick={() => setSearchOpen(true)}
      />
    </header>
  ) : (
    <header className="w-appbar">
      <div className="w-appbar-brand">
        <button type="button" className="w-appbar-brand-btn" onClick={() => navigate('/')} aria-label={t('app.brand')}>
          <AppIcon size={20} />
          <span className="w-appbar-title">{t('app.brand')}</span>
        </button>
        {currentLib ? (
          <>
            <span className="w-appbar-sep" role="presentation" />
            <span className="w-appbar-context">{currentLib.name}</span>
          </>
        ) : null}
      </div>
      <div className="w-appbar-spacer" />
      <div className="w-appbar-tools">
        <button
          type="button"
          className="w-appbar-search"
          onClick={() => setSearchOpen(true)}
          aria-label={t('app.search')}
        >
          <SearchRegular fontSize={16} />
          <span className="w-appbar-search-label">{t('app.search')}</span>
          <kbd className="w-kbd w-appbar-kbd">Ctrl K</kbd>
        </button>
        {themeToggle}
        {languageMenu}
        {accountMenu}
      </div>
    </header>
  )

  return (
    <div className="w-app">
      {appbar}
      <div className="w-app-body">
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
        <Group orientation="horizontal" id="v10-ai-dock" className="w-panels">
          <Panel id="main" minSize="54%" className="w-panel-main">
            <div className={isMobile ? 'w-main w-mobile-content' : 'w-main'}>
              {!online && (
                <MessageBar intent="warning" className="w-offline-bar">
                  <MessageBarBody>{t('app.offline')}</MessageBarBody>
                </MessageBar>
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
      {!showDock && <AIDock variant={isMobile ? 'sheet' : 'dock'} />}
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
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      {account && <WelcomeModal open={welcomeOpen} accountId={account.id} onClose={closeWelcome} />}
    </div>
  )
}

/** 当前日期标签（保留兼容导出，供旧页面使用） */
export function todayLabel(): string {
  const lang = document.documentElement.lang || 'zh-CN'
  return dayjs().format(lang.startsWith('en') ? 'MMM D' : 'M月D日')
}

/** 图标兼容导出 */
export const CloseIcon = DismissRegular
export const OfflineIcon = WifiOffRegular
