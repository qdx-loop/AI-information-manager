import { Layout, Drawer, Button, Tooltip } from 'antd'
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { MoonOutlined, SunOutlined } from '@ant-design/icons'
import Sidebar from './Sidebar'
import AIPanel from '@/components/ai/AIPanel'
import { useAppStore } from '@/store/appStore'

const { Content, Header } = Layout

export default function AppShell() {
  const [aiOpen, setAiOpen] = useState(false)
  const { settings, setTheme } = useAppStore()
  const isDark = settings.theme === 'dark'

  return (
    <Layout style={{ height: '100vh' }}>
      <Sidebar onOpenAI={() => setAiOpen(true)} />
      <Layout>
        <Header
          style={{
            padding: '0 16px',
            background: isDark ? '#141414' : '#fff',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
          }}
        >
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
        width={460}
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        styles={{ body: { padding: 0 } }}
      >
        <AIPanel />
      </Drawer>
    </Layout>
  )
}
