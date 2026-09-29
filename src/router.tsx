import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Spin, App as AntdApp } from 'antd'
import { useAuthStore } from '@/store/authStore'
import AppShell from '@/components/layout/AppShell'
import AuthPage from '@/components/auth/AuthPage'
import AdminPage from '@/components/admin/AdminPage'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import Landing from '@/components/public/Landing'
import HelpPage from '@/components/public/HelpPage'
import { isAndroidApp } from '@/utils/platform'

const LibraryView = lazy(() => import('@/components/library/LibraryView'))
const TrashBin = lazy(() => import('@/components/library/TrashBin'))
const SettingsPage = lazy(() => import('@/components/settings/SettingsPage'))
const EmptyHome = lazy(() => import('@/components/library/EmptyHome'))

// 根路径分流：
//   未登录 + 在网页里  → 公开落地页（营销页，给搜索/分享进来的访客看）
//   未登录 + 在 App 里 → 直接进登录/注册页（装 App 的人显然是要用，不是来看广告的）
//   已登录            → 应用主界面
function HomeGate() {
  const { account, loading } = useAuthStore()
  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }
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
  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }
  if (!account) return <Navigate to="/login" replace />
  return <>{children}</>
}

// 登录页守卫：loading 时显示 Spin，已登录则跳转主页
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { account, loading } = useAuthStore()
  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }
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
    <Suspense
      fallback={
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" />
        </div>
      }
    >
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
