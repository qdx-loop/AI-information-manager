import { Layout, Drawer, Tooltip, Dropdown, Avatar, App as AntApp } from 'antd'
import { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { MoonOutlined, SunOutlined, MenuOutlined, SearchOutlined, LogoutOutlined, WifiOutlined } from '@ant-design/icons'
import Sidebar, { SidebarContent } from './Sidebar'
import AIDock from './AIDock'
import AIFab from './AIFab'
import MobileTabBar from './MobileTabBar'
import LibraryPickerSheet from '@/components/library/LibraryPickerSheet'
import { useAiUiStore, aiPanelVisible } from '@/store/aiUiStore'
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

const { Content, Header } = Layout

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // 手机底栏「管理库」标签的库切换面板
  const [libPickerOpen, setLibPickerOpen] = useState(false)
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
  const navigate = useNavigate()

  // —— 首次注册欢迎页（含赞赏码）——
  // 用户明确要求：新用户注册登录后直接展示赞赏码，并说明以后在「设置 → 关于与支持」能找到。
  // 一次性由 sessionStorage 的 pending 口令保证：只有 register() 路径会写它，
  // 老账号登录 / 刷新 / 换设备 / 清缓存都不会触发；关闭后写 localStorage seen 兜底。
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

  /**
   * 库列表必须在这里加载，不能放在 Sidebar 里。
   *
   * Sidebar 在手机上只存在于 `<Drawer open={sidebarOpen}>` 内部，而 antd Drawer
   * 默认不预渲染（没有 forceRender），首次打开前根本不挂载 ——
   * 于是 Sidebar 里的 useEffect 从不执行，libraries 一直是空数组。后果：
   *   1. 库详情页标题显示「未命名管理库」、分类标签消失（找不到 lib）
   *   2. 侧边栏的库列表是空的，非得先点开汉堡才看得到
   *   3. libsReady 永远为 false —— 那是我为「库不存在」保护页加的判定依据，
   *      于是那道保护在手机上等于从未生效
   * 条目数据是好的（selectLibrary 不依赖 libraries），所以问题被掩盖成
   * 「就是标题不对」，很容易被当成小毛病。
   *
   * AppShell 在两种布局下都常驻，是唯一正确的加载点。
   */
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
  const contentRef = useRef<HTMLDivElement>(null)

  // —— 到期提醒的浏览器通知：登录态下常驻检查（每 30 分钟 + 启动一次）——
  useEffect(() => {
    if (!account) return
    const stop = startReminderWatcher(
      () => useAuthStore.getState().account?.id ?? '',
      () => useLibraryStore.getState().libraries,
    )
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 启动函数内部现行从 store 读最新账号，只需在 登录/退出 时重建
  }, [account?.id])

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

  /**
   * 离线状态此前完全不可见。这个应用是本地优先的：断网时新建、编辑、
   * 删除都照常工作，数据就在本机 IndexedDB 里。
   * 所以提示不该用红色的「错误」语气 —— 那会让人以为东西丢了，
   * 反而不敢继续操作。要说清的是：数据没丢，只是暂时同步不了。
   */
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

  return (
    <Layout className="app-shell">
      {isMobile ? (
        <Drawer
          placement="left"
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          width={260}
          styles={{ body: { padding: 0 } }}
        >
          <SidebarContent
            onOpenPanel={() => { setAiOpen(true); setSidebarOpen(false) }}
            onNavigate={() => setSidebarOpen(false)}
          />
        </Drawer>
      ) : (
        <Sidebar onOpenPanel={() => setAiOpen(true)} siderRef={siderRef} />
      )}
      <div className="app-main">
        {!online && (
          <div className="offline-bar" role="status">
            <WifiOutlined />
            <span>{t('app.offline')}</span>
          </div>
        )}
          <Header
            className="app-header"
            style={{
              // 52px 现代产品头部；安全区单独叠加，刘海机型不遮挡
              height: 'calc(52px + env(safe-area-inset-top, 0px))',
              paddingTop: 'env(safe-area-inset-top, 0px)',
            }}
          >
            <div className="app-header-left">
              {isMobile && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('nav.menu')}
                  onClick={() => setSidebarOpen(true)}
                >
                  <MenuOutlined />
                </button>
              )}
              {isMobile && <span className="app-brand-dot" aria-hidden />}
              <div className="app-breadcrumb">
                {isMobile ? (
                  <span className="app-breadcrumb-current">{t('app.brand')}</span>
                ) : (
                  <>
                    <span className="faint">{t('app.home')}</span>
                    {currentLib && (
                      <>
                        <span className="faint" aria-hidden>
                          /
                        </span>
                        <span className="app-breadcrumb-current">{currentLib.name}</span>
                      </>
                    )}
                    {currentLib?.category && (
                      <span className="faint" style={{ fontSize: 12 }}>
                        {currentLib.category}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="app-header-actions">
              {!isMobile ? (
                <button
                  type="button"
                  className="app-header-search"
                  onClick={() => setSearchOpen(true)}
                  aria-label={t('app.search')}
                >
                  <SearchOutlined />
                  <span>{t('app.search')}</span>
                  <kbd className="kbd">⌘K</kbd>
                </button>
              ) : (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('app.search')}
                  onClick={() => setSearchOpen(true)}
                >
                  <SearchOutlined />
                </button>
              )}
              <Tooltip title={isDark ? t('app.theme.light') : t('app.theme.dark')}>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={isDark ? t('app.theme.light') : t('app.theme.dark')}
                  onClick={() => setTheme(isDark ? 'light' : 'dark')}
                >
                  {isDark ? <SunOutlined /> : <MoonOutlined />}
                </button>
              </Tooltip>
              <Tooltip title={settings.language === 'zh' ? 'English' : '中文'}>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ width: 'auto', padding: '0 8px', fontSize: 12, fontWeight: 500 }}
                  aria-label={t('app.language')}
                  onClick={() => setLanguage(settings.language === 'zh' ? 'en' : 'zh')}
                >
                  {settings.language === 'zh' ? 'EN' : '中'}
                </button>
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
                      onClick: async () => {
                        await resetSession()
                        navigate('/login')
                      },
                    },
                  ],
                }}
              >
                <button type="button" className="icon-btn" style={{ width: 'auto', padding: 0 }} aria-label={t('app.signOut')}>
                  <Avatar size={26} style={{ background: 'var(--accent)', color: '#fff', fontSize: 12 }}>
                    {(account?.username ?? '?').slice(0, 1).toUpperCase()}
                  </Avatar>
                </button>
              </Dropdown>
            </div>
          </Header>
          <Content
            ref={contentRef}
            className="app-content"
            style={{
              flex: 1,
              overflow: 'auto',
              background: 'var(--bg-canvas)',
              // 手机上给底部标签栏让位
              paddingBottom: isMobile ? 'calc(56px + env(safe-area-inset-bottom, 0px))' : 0,
            }}
          >
            <Outlet />
          </Content>
      </div>
      {/* AI 助手：桌面停靠在右侧、把内容推开；手机是底部抽屉。两者都不带遮罩 */}
      <AIDock variant={isMobile ? 'sheet' : 'dock'} />
      {/* 桌面：右下角悬浮 AI 入口。手机：AI 已经是底部标签之一，
          再放一个悬浮按钮既重复又会和标签栏抢位置。 */}
      {!isMobile && <AIFab />}
      {isMobile && (
        <MobileTabBar
          onOpenLibraries={() => setLibPickerOpen(true)}
          onDismiss={() => {
            // 面板关闭时会 history.back()，那会把这次导航撤销掉（实测停在 /）。
            // 只有面板确实开着时才消费栈顶，避免误标别的弹层。
            if (libPickerOpen) consumeTopOverlay()
            setLibPickerOpen(false)
          }}
        />
      )}
      {isMobile && (
        <LibraryPickerSheet open={libPickerOpen} onClose={() => setLibPickerOpen(false)} />
      )}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      {account && <WelcomeModal open={welcomeOpen} accountId={account.id} onClose={closeWelcome} />}
    </Layout>
  )
}
