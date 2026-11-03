import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { App as AntdApp } from 'antd'
import { Spinner, Text } from '@fluentui/react-components'
import { useAuthStore } from '@/store/authStore'
import AppShell from '@/components/layout/AppShell'
import AuthPage from '@/components/auth/AuthPage'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import { isAndroidApp } from '@/utils/platform'

/**
 * 路由级 code-splitting：营销页 / 后台 / 帮助中心都是「特定身份才会看」的页面，
 * 不该压在已登录用户的首屏包体里（旧版为静态导入，首屏多下载一个营销页 + 后台）。
 * 用同一份延迟 fallback，避免三套重复的全屏 Spin。
 */
const LibraryView = lazy(() => import('@/components/library/LibraryView'))
const TrashBin = lazy(() => import('@/components/library/TrashBin'))
const SettingsPage = lazy(() => import('@/components/settings/SettingsPage'))
const EmptyHome = lazy(() => import('@/components/library/EmptyHome'))
const Landing = lazy(() => import('@/components/public/Landing'))
const HelpPage = lazy(() => import('@/components/public/HelpPage'))
const AdminPage = lazy(() => import('@/components/admin/AdminPage'))

/** 路由等待：Fluent Spinner（居中、克制，不占满整屏） */
function RouteFallback() {
  return (
    <div
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        background: 'var(--w-canvas)',
        color: 'var(--w-text-2)',
      }}
    >
      <Spinner size="small" />
      <Text size={200} className="w-faint">LOADING…</Text>
    </div>
  )
}

// 根路径分流：
//   未登录 + 在网页里  → 公开落地页（营销页，给搜索/分享进来的访客看）
//   未登录 + 在 App 里 → 直接进登录/注册页（装 App 的人显然是要用，不是来看广告的）
//   已登录            → 应用主界面
function HomeGate() {
  const { account, loading } = useAuthStore()
  if (loading) return <RouteFallback />
  if (!account) {
    if (isAndroidApp()) return <Navigate to="/login" replace />
    return <Landing />
  }
  return (
    <Protected>
      <AppShell />
    </Protected>
  )
}

// 展示一次强制登出原因（到期/停用）
function LogoutReasonBanner() {
  const { message } = AntdApp.useApp()
  const { logoutReason, clearLogoutReason } = useAuthStore()
  useEffect(() => {
    if (logoutReason) {
      message.warning({ content: logoutReason, duration: 6 })
      clearLogoutReason()
    }
  }, [logoutReason, message, clearLogoutReason])
  return null
}

function Protected({ children }: { children: React.ReactNode }) {
  const { account, loading } = useAuthStore()
  if (loading) return <RouteFallback />
  if (!account) return <Navigate to="/login" replace />
  return <>{children}</>
}

// 登录页守卫：loading 时显示 Spin，已登录则跳转主页
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { account, loading } = useAuthStore()
  if (loading) return <RouteFallback />
  if (account) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function Router() {
  const init = useAuthStore((s) => s.init)
  useEffect(() => {
    // init() 内部已有 try/catch，此处 catch 仅作兜底防御
    init().catch((e) => console.error('[auth] init 未捕获:', e))
  }, [init])

  return (
    <Suspense fallback={<RouteFallback />}>
      <ErrorBoundary>
      <LogoutReasonBanner />
      <Routes>
        <Route path="/login" element={<PublicOnly><AuthPage /></PublicOnly>} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/" element={<HomeGate />}>
          <Route index element={<EmptyHome />} />
          <Route path="library/:id" element={<LibraryView />} />
          <Route path="trash" element={<TrashBin />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ErrorBoundary>
    </Suspense>
  )
}
