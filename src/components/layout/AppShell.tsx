import { Layout, Drawer, Button, Tooltip } from 'antd'
import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { MoonOutlined, SunOutlined, MenuOutlined } from '@ant-design/icons'
import Sidebar, { SidebarContent } from './Sidebar'
import AIPanel from '@/components/ai/AIPanel'
import { useAppStore } from '@/store/appStore'

const { Content, Header } = Layout

export default function AppShell() {
  const [aiOpen, setAiOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { settings, setTheme } = useAppStore()
  const isDark = settings.theme === 'dark'

  // 检测移动端
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

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
          <SidebarContent onOpenAI={() => { setAiOpen(true); setSidebarOpen(false) }} />
        </Drawer>
      ) : (
        <Sidebar onOpenAI={() => setAiOpen(true)} />
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
          <Tooltip title={isDark ? '切换到亮色' : '切换到暗色'}>
            <Button
              type="text"
              icon={isDark ? <SunOutlined /> : <MoonOutlined />}
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
            />
          </Tooltip>
        </Header>
        <Content style={{ height: 'calc(100vh - 64px)', overflow: 'auto', background: isDark ? '#141414' : '#f5f5f5' }}>
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
        <AIPanel />
      </Drawer>
    </Layout>
  )
}
