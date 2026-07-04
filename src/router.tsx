import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuthStore } from '@/store/authStore'
import AppShell from '@/components/layout/AppShell'
import AuthPage from '@/components/auth/AuthPage'

const LibraryView = lazy(() => import('@/components/library/LibraryView'))
const TrashBin = lazy(() => import('@/components/library/TrashBin'))
const SettingsPage = lazy(() => import('@/components/settings/SettingsPage'))
const EmptyHome = lazy(() => import('@/components/library/EmptyHome'))

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
      <Routes>
        <Route path="/login" element={<PublicOnly><AuthPage /></PublicOnly>} />
        <Route
          path="/"
          element={
            <Protected>
              <AppShell />
            </Protected>
          }
        >
          <Route index element={<EmptyHome />} />
          <Route path="library/:id" element={<LibraryView />} />
          <Route path="trash" element={<TrashBin />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
