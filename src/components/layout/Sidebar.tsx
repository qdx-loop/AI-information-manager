import { Layout, Menu, Button, Badge, Input, App, Dropdown } from 'antd'
import {
  AppstoreOutlined,
  DeleteOutlined,
  SettingOutlined,
  RobotOutlined,
  LogoutOutlined,
  PlusOutlined,
  MoreOutlined,
  EditOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useLibraryStore } from '@/store/libraryStore'
import { useAppStore } from '@/store/appStore'
import { useEffect, useMemo, useState } from 'react'
import type { Library } from '@/types'
import { syncNow } from '@/utils/autoSync'

const { Sider } = Layout

export default function Sidebar({ onOpenAI }: { onOpenAI: () => void }) {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const { account, logout } = useAuthStore()
  const {
    libraries,
    currentLibraryId,
    loadLibraries,
    selectLibrary,
    createLibrary,
    renameLibrary,
    deleteLibrary,
  } = useLibraryStore()
  const isDark = useAppStore((s) => s.settings.theme === 'dark')
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    void loadLibraries()
  }, [loadLibraries])

  // 按分类分组
  const grouped = useMemo(() => {
    const map = new Map<string, Library[]>()
    libraries.forEach((l) => {
      const arr = map.get(l.category) ?? []
      arr.push(l)
      map.set(l.category, arr)
    })
    return Array.from(map.entries())
  }, [libraries])

  const handleNewLibrary = () => {
    let name = ''
    modal.confirm({
      title: '新建管理库',
      content: (
        <Input placeholder="管理库名称，如：联系人管理库" onChange={(e) => (name = e.target.value)} />
      ),
      onOk: async () => {
        if (!name.trim()) {
          message.warning('请输入名称')
          return
        }
        const id = await createLibrary(name.trim())
        await selectLibrary(id)
        navigate(`/library/${id}`)
        message.success('已创建')
      },
    })
  }

  const handleRename = (lib: Library) => {
    let name = lib.name
    modal.confirm({
      title: '重命名管理库',
      content: (
        <Input defaultValue={lib.name} onChange={(e) => (name = e.target.value)} />
      ),
      onOk: async () => {
        if (!name.trim()) {
          message.warning('名称不能为空')
          return
        }
        await renameLibrary(lib.id, name.trim())
        message.success('已重命名')
      },
    })
  }

  const handleDelete = (lib: Library) => {
    modal.confirm({
      title: `删除管理库「${lib.name}」？`,
      content: '该库及其全部条目将移入回收站，可从回收站恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await deleteLibrary(lib.id)
        if (currentLibraryId === lib.id) navigate('/')
        message.success('已移入回收站')
      },
    })
  }

  // 单个库的「⋯」下拉菜单
  const libActions = (lib: Library): MenuProps => ({
    items: [
      { key: 'rename', label: '重命名', icon: <EditOutlined /> },
      { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true },
    ],
    onClick: ({ key, domEvent }) => {
      domEvent.stopPropagation()
      if (key === 'rename') handleRename(lib)
      else if (key === 'delete') handleDelete(lib)
    },
  })

  const menuItems = [
    {
      key: 'group-libraries',
      label: '管理库',
      type: 'group' as const,
      children: [
        ...grouped.map(([cat, libs]) => ({
          key: `cat-${cat}`,
          label: cat,
          type: 'group' as const,
          children: libs.map((l) => ({
            key: `/library/${l.id}`,
            icon: <AppstoreOutlined />,
            label: (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {l.name}
                </span>
                <Dropdown menu={libActions(l)} trigger={['click']}>
                  <Button
                    type="text"
                    size="small"
                    icon={<MoreOutlined />}
                    onClick={(e) => e.stopPropagation()}
                    style={{ flexShrink: 0 }}
                  />
                </Dropdown>
              </div>
            ),
          })),
        })),
        {
          key: 'new-library',
          label: '新建管理库',
          icon: <PlusOutlined />,
        },
      ],
    },
    {
      key: 'group-tools',
      label: '工具',
      type: 'group' as const,
      children: [
        { key: '/trash', label: '回收站', icon: <DeleteOutlined /> },
        { key: '/settings', label: '设置', icon: <SettingOutlined /> },
      ],
    },
  ]

  const selectedKey =
    location.pathname === '/trash' || location.pathname === '/settings'
      ? location.pathname
      : currentLibraryId
        ? `/library/${currentLibraryId}`
        : location.pathname

  const handleClick = (key: string) => {
    if (key === 'new-library') {
      handleNewLibrary()
      return
    }
    navigate(key)
    if (key.startsWith('/library/')) {
      const id = key.replace('/library/', '')
      void selectLibrary(id)
    } else {
      void selectLibrary(null)
    }
  }

  const [loggingOut, setLoggingOut] = useState(false)
  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      // 退出前强制同步云端（不等3分钟防抖）
      await syncNow()
    } catch (e) {
      console.error('[logout] 退出前同步失败:', e)
    } finally {
      setLoggingOut(false)
    }
    logout()
    useLibraryStore.setState({
      libraries: [],
      currentLibraryId: null,
      fields: [],
      items: [],
      trash: [],
      focusItemId: null,
    })
    navigate('/login')
  }

  // 公共内容：桌面端 Sider 和移动端 Drawer 共用
  const content = (
    <>
      <div
        style={{
          padding: '16px 16px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 600,
          color: '#1677ff',
        }}
      >
        <Badge color="#1677ff" />
        {!collapsed && <span>信息管理</span>}
      </div>

      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={({ key, domEvent }) => {
          handleClick(key)
          void domEvent
        }}
        style={{ borderInlineEnd: 'none' }}
      />

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          width: '100%',
          padding: 12,
          borderTop: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
          background: isDark ? '#141414' : '#fff',
        }}
      >
        <Button icon={<RobotOutlined />} block onClick={onOpenAI} style={{ marginBottom: 8 }}>
          {collapsed ? '' : 'AI 助手'}
        </Button>
        <Button
          icon={<LogoutOutlined />}
          block
          type="text"
          onClick={handleLogout}
          loading={loggingOut}
        >
          {collapsed ? '' : `退出 (${account?.username})`}
        </Button>
      </div>
    </>
  )

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      width={240}
      style={{ height: '100vh', overflow: 'auto' }}
      theme={isDark ? 'dark' : 'light'}
    >
      {content}
    </Sider>
  )
}

// 移动端侧边栏内容（用于 Drawer 内）
export function SidebarContent({ onOpenAI }: { onOpenAI: () => void }) {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const { account, logout } = useAuthStore()
  const {
    libraries,
    currentLibraryId,
    loadLibraries,
    selectLibrary,
    createLibrary,
    renameLibrary,
    deleteLibrary,
  } = useLibraryStore()
  const isDark = useAppStore((s) => s.settings.theme === 'dark')

  useEffect(() => {
    void loadLibraries()
  }, [loadLibraries])

  const grouped = useMemo(() => {
    const map = new Map<string, Library[]>()
    libraries.forEach((l) => {
      const arr = map.get(l.category) ?? []
      arr.push(l)
      map.set(l.category, arr)
    })
    return Array.from(map.entries())
  }, [libraries])

  const handleNewLibrary = () => {
    let name = ''
    modal.confirm({
      title: '新建管理库',
      content: (
        <Input placeholder="管理库名称，如：联系人管理库" onChange={(e) => (name = e.target.value)} />
      ),
      onOk: async () => {
        if (!name.trim()) {
          message.warning('请输入名称')
          return
        }
        const id = await createLibrary(name.trim())
        await selectLibrary(id)
        navigate(`/library/${id}`)
        message.success('已创建')
      },
    })
  }

  const handleRename = (lib: Library) => {
    let name = lib.name
    modal.confirm({
      title: '重命名管理库',
      content: <Input defaultValue={lib.name} onChange={(e) => (name = e.target.value)} />,
      onOk: async () => {
        if (!name.trim()) {
          message.warning('名称不能为空')
          return
        }
        await renameLibrary(lib.id, name.trim())
        message.success('已重命名')
      },
    })
  }

  const handleDelete = (lib: Library) => {
    modal.confirm({
      title: `删除管理库「${lib.name}」？`,
      content: '该库及其全部条目将移入回收站，可从回收站恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await deleteLibrary(lib.id)
        if (currentLibraryId === lib.id) navigate('/')
        message.success('已移入回收站')
      },
    })
  }

  const libActions = (lib: Library): MenuProps => ({
    items: [
      { key: 'rename', label: '重命名', icon: <EditOutlined /> },
      { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true },
    ],
    onClick: ({ key, domEvent }) => {
      domEvent.stopPropagation()
      if (key === 'rename') handleRename(lib)
      else if (key === 'delete') handleDelete(lib)
    },
  })

  const menuItems = [
    {
      key: 'group-libraries',
      label: '管理库',
      type: 'group' as const,
      children: [
        ...grouped.map(([cat, libs]) => ({
          key: `cat-${cat}`,
          label: cat,
          type: 'group' as const,
          children: libs.map((l) => ({
            key: `/library/${l.id}`,
            icon: <AppstoreOutlined />,
            label: (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {l.name}
                </span>
                <Dropdown menu={libActions(l)} trigger={['click']}>
                  <Button
                    type="text"
                    size="small"
                    icon={<MoreOutlined />}
                    onClick={(e) => e.stopPropagation()}
                    style={{ flexShrink: 0 }}
                  />
                </Dropdown>
              </div>
            ),
          })),
        })),
        { key: 'new-library', label: '新建管理库', icon: <PlusOutlined /> },
      ],
    },
    {
      key: 'group-tools',
      label: '工具',
      type: 'group' as const,
      children: [
        { key: '/trash', label: '回收站', icon: <DeleteOutlined /> },
        { key: '/settings', label: '设置', icon: <SettingOutlined /> },
      ],
    },
  ]

  const selectedKey =
    location.pathname === '/trash' || location.pathname === '/settings'
      ? location.pathname
      : currentLibraryId
        ? `/library/${currentLibraryId}`
        : location.pathname

  const handleClick = (key: string) => {
    if (key === 'new-library') {
      handleNewLibrary()
      return
    }
    navigate(key)
    if (key.startsWith('/library/')) {
      const id = key.replace('/library/', '')
      void selectLibrary(id)
    } else {
      void selectLibrary(null)
    }
  }

  const [loggingOut, setLoggingOut] = useState(false)
  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      // 退出前强制同步云端（不等3分钟防抖）
      await syncNow()
    } catch (e) {
      console.error('[logout] 退出前同步失败:', e)
    } finally {
      setLoggingOut(false)
    }
    logout()
    useLibraryStore.setState({
      libraries: [],
      currentLibraryId: null,
      fields: [],
      items: [],
      trash: [],
      focusItemId: null,
    })
    navigate('/login')
  }

  return (
    <div style={{ height: '100vh', overflow: 'auto', background: isDark ? '#141414' : '#fff' }}>
      <div
        style={{
          padding: '16px 16px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 600,
          color: '#1677ff',
        }}
      >
        <Badge color="#1677ff" />
        <span>信息管理</span>
      </div>

      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={({ key, domEvent }) => {
          handleClick(key)
          void domEvent
        }}
        style={{ borderInlineEnd: 'none', background: 'transparent' }}
      />

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          width: '100%',
          padding: 12,
          borderTop: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
          background: isDark ? '#141414' : '#fff',
        }}
      >
        <Button icon={<RobotOutlined />} block onClick={onOpenAI} style={{ marginBottom: 8 }}>
          AI 助手
        </Button>
        <Button icon={<LogoutOutlined />} block type="text" onClick={handleLogout} loading={loggingOut}>
          {`退出 (${account?.username})`}
        </Button>
      </div>
    </div>
  )
}
