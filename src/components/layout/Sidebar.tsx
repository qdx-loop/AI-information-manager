import { Layout, Menu, Button, Badge, Input, App, Dropdown, Tag } from 'antd'
import {
  AppstoreOutlined,
  DeleteOutlined,
  SettingOutlined,
  RobotOutlined,
  LogoutOutlined,
  PlusOutlined,
  MoreOutlined,
  EditOutlined,
  HomeOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useLibraryStore } from '@/store/libraryStore'
import { useAppStore } from '@/store/appStore'
import { useEffect, useMemo, useState } from 'react'
import type { Library } from '@/types'
import { syncNow } from '@/utils/autoSync'
import { getProvider } from '@/db/providerFactory'
import { copyTemplateToLibrary } from '@/utils/libraryTemplates'
import { useI18n } from '@/i18n'
import dayjs from 'dayjs'

const { Sider } = Layout

// 共享的侧边栏逻辑：库列表、菜单项、点击/重命名/删除/退出等操作
// 桌面端 Sidebar（Sider，可折叠）和移动端 SidebarContent（Drawer 内 div）共用此 hook
function useSidebarState() {
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
  const [loggingOut, setLoggingOut] = useState(false)
  const t = useI18n()

  useEffect(() => {
    loadLibraries().catch((e) => message.error(t('app.loadLibsFailed', { msg: (e as Error).message })))
  }, [loadLibraries, message])

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
      title: t('app.newLibrary'),
      content: (
        <Input placeholder={t('app.lib.namePlaceholder')} onChange={(e) => (name = e.target.value)} />
      ),
      onOk: async () => {
        if (!name.trim()) {
          message.warning(t('app.lib.nameRequired'))
          return
        }
        const id = await createLibrary(name.trim())
        await selectLibrary(id)
        navigate(`/library/${id}`)
        message.success(t('app.lib.created'))
      },
    })
  }

  // 在指定库下新建子库
  const handleNewChild = (parent: Library) => {
    let name = ''
    modal.confirm({
      title: t('app.newLibrary'),
      content: <Input placeholder={t('app.lib.namePlaceholder')} onChange={(e) => (name = e.target.value)} />,
      onOk: async () => {
        if (!name.trim()) {
          message.warning(t('app.lib.nameRequired'))
          return
        }
        const id = await createLibrary(name.trim(), parent.category, parent.id)
        // 子库默认继承父库的字段模板（若有）
        try {
          const parentTpl = await getProvider().getTemplate(parent.id)
          if (parentTpl.length > 0) await copyTemplateToLibrary(parentTpl, id)
        } catch { /* 模板继承失败不阻塞建库 */ }
        await selectLibrary(id)
        navigate(`/library/${id}`)
        message.success(t('app.lib.created'))
      },
    })
  }

  const handleRename = (lib: Library) => {
    let name = lib.name
    modal.confirm({
      title: t('app.lib.renameTitle'),
      content: <Input defaultValue={lib.name} onChange={(e) => (name = e.target.value)} />,
      onOk: async () => {
        if (!name.trim()) {
          message.warning(t('app.lib.nameEmpty'))
          return
        }
        await renameLibrary(lib.id, name.trim())
        message.success(t('app.lib.renamed'))
      },
    })
  }

  const handleDelete = (lib: Library) => {
    modal.confirm({
      title: t('app.lib.deleteTitle', { name: lib.name }),
      content: t('app.lib.deleteContent'),
      okText: t('common.delete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
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
      { key: 'child', label: t('app.newChild'), icon: <PlusOutlined /> },
      { key: 'rename', label: t('common.rename'), icon: <EditOutlined /> },
      { key: 'delete', label: t('common.delete'), icon: <DeleteOutlined />, danger: true },
    ],
    onClick: ({ key, domEvent }) => {
      domEvent.stopPropagation()
      if (key === 'child') handleNewChild(lib)
      else if (key === 'rename') handleRename(lib)
      else if (key === 'delete') handleDelete(lib)
    },
  })

  // 单个库的菜单项（含子库递归）
  const buildLibItems = useMemo(
    () => (libs: Library[]) => {
      type MenuItem = NonNullable<MenuProps['items']>[number]
      const byParent = new Map<string | null, Library[]>()
      for (const l of libs) byParent.set(l.parentId ?? null, [...(byParent.get(l.parentId ?? null) ?? []), l])
      const makeItem = (l: Library): MenuItem => {
        const children: MenuItem[] = (byParent.get(l.id) ?? [])
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(makeItem)
        return {
          key: `/library/${l.id}`,
          icon: <AppstoreOutlined />,
          label: (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                // 有子库时右侧预留展开箭头的位置，避免「⋯ 更多」按钮与箭头重叠
                paddingRight: children.length ? 16 : 0,
              }}
            >
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
          ...(children.length ? { children } : {}),
        }
      }
      return (byParent.get(null) ?? []).sort((a, b) => a.sortOrder - b.sortOrder).map(makeItem)
    },
    [libActions],
  )

  const menuItems = [
    { key: '/', label: t('app.home'), icon: <HomeOutlined /> },
    {
      key: 'group-libraries',
      label: t('app.group.libraries'),
      type: 'group' as const,
      children: [
        ...grouped.map(([cat, libs]) => ({
          key: `cat-${cat}`,
          label: cat,
          type: 'group' as const,
          children: buildLibItems(libs),
        })),
        { key: 'new-library', label: t('app.newLibrary'), icon: <PlusOutlined /> },
      ],
    },
    {
      key: 'group-tools',
      label: t('app.group.tools'),
      type: 'group' as const,
      children: [
        { key: '/trash', label: t('app.trash'), icon: <DeleteOutlined /> },
        { key: '/settings', label: t('app.settings'), icon: <SettingOutlined /> },
      ],
    },
  ]

  const selectedKey =
    location.pathname === '/' || location.pathname === '/trash' || location.pathname === '/settings'
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
      selectLibrary(id).catch((e) => message.error(t('app.loadLibFailed', { msg: (e as Error).message })))
    } else {
      selectLibrary(null).catch(() => {/* 切换到非库页面，忽略 */})
    }
  }

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

  return { account, isDark, menuItems, selectedKey, handleClick, handleLogout, loggingOut }
}

// 共享的侧边栏内容渲染：header + menu + footer(AI/退出按钮)
// collapsed 仅桌面端 Sider 传入，移动端始终为 false
function SidebarBody({
  state,
  collapsed,
  onOpenPanel,
  aiRef,
}: {
  state: ReturnType<typeof useSidebarState>
  collapsed: boolean
  onOpenPanel: () => void
  aiRef?: React.Ref<HTMLButtonElement>
}) {
  const t = useI18n()
  const { account, isDark, menuItems, selectedKey, handleClick, handleLogout, loggingOut } = state
  return (
    <>
      <div
        onClick={() => handleClick('/')}
        style={{
          padding: '16px 16px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 600,
          color: '#0D9488',
          cursor: 'pointer',
        }}
      >
        <Badge color="#0D9488" />
        {!collapsed && <span>{t('app.brand')}</span>}
      </div>

      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={({ key }) => handleClick(key)}
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
        {!collapsed && account?.expiresAt != null && (
          <div
            style={{
              fontSize: 12,
              marginBottom: 8,
              color: 'var(--ant-color-text-secondary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{t('app.expiresAt', { date: dayjs(account.expiresAt).format('YYYY-MM-DD') })}</span>
            {(() => {
              const days = Math.floor((account.expiresAt! - Date.now()) / 86400000)
              if (days <= 3) {
                return (
                  <Tag color={days < 0 ? 'red' : 'orange'} style={{ marginRight: 0 }}>
                    {days < 0 ? t('app.expired') : t('app.daysLeft', { n: days })}
                  </Tag>
                )
              }
              return null
            })()}
          </div>
        )}
        <Button ref={aiRef} icon={<RobotOutlined />} block onClick={onOpenPanel} style={{ marginBottom: 8 }}>
          {collapsed ? '' : t('app.aiAssistant')}
        </Button>
        <Button
          icon={<LogoutOutlined />}
          block
          type="text"
          onClick={handleLogout}
          loading={loggingOut}
        >
          {collapsed ? '' : t('app.logout', { name: account?.username ?? '' })}
        </Button>
      </div>
    </>
  )
}

export default function Sidebar({
  onOpenPanel,
  siderRef,
  aiRef,
}: {
  onOpenPanel: () => void
  siderRef?: React.Ref<HTMLDivElement>
  aiRef?: React.Ref<HTMLButtonElement>
}) {
  const state = useSidebarState()
  const { isDark } = state
  const [collapsed, setCollapsed] = useState(false)

  return (
    <Sider
      ref={siderRef}
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      width={240}
      style={{ height: '100vh', overflow: 'auto' }}
      theme={isDark ? 'dark' : 'light'}
    >
      <SidebarBody state={state} collapsed={collapsed} onOpenPanel={onOpenPanel} aiRef={aiRef} />
    </Sider>
  )
}

// 移动端侧边栏内容（用于 Drawer 内）
export function SidebarContent({ onOpenPanel }: { onOpenPanel: () => void }) {
  const state = useSidebarState()
  const { isDark } = state

  return (
    <div style={{ height: '100vh', overflow: 'auto', background: isDark ? '#141414' : '#fff' }}>
      <SidebarBody state={state} collapsed={false} onOpenPanel={onOpenPanel} />
    </div>
  )
}
