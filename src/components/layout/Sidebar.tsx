import { Layout, Menu, Button, Input, App, Dropdown } from 'antd'
import {
  DeleteOutlined,
  SettingOutlined,
  PlusOutlined,
  MoreOutlined,
  EditOutlined,
  HomeOutlined,
  TagsOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useLibraryStore } from '@/store/libraryStore'
import { useAppStore } from '@/store/appStore'
import { useMemo, useState } from 'react'
import type { Library } from '@/types'
import { syncNow } from '@/utils/autoSync'
import { resetSession } from '@/store/session'
import { useI18n } from '@/i18n'
import CreateLibraryDialog from '@/components/library/CreateLibraryDialog'

const { Sider } = Layout

// 共享的侧边栏逻辑：库列表、菜单项、点击/重命名/删除/退出等操作
// 桌面端 Sidebar（Sider，可折叠）和移动端 SidebarContent（Drawer 内 div）共用此 hook
function useSidebarState(onNavigate?: () => void) {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const { account } = useAuthStore()
  const {
    libraries,
    currentLibraryId,
    selectLibrary,
    renameLibrary,
    deleteLibrary,
    setLibraryCategory,
    reorderLibraries,
  } = useLibraryStore()
  const isDark = useAppStore((s) => s.settings.theme === 'dark')
  const [loggingOut, setLoggingOut] = useState(false)
  const t = useI18n()

  // 注意：库列表的加载已移到 AppShell（两种布局下都常驻）。
  // 放在这里的话，手机上 Sidebar 只存在于未打开的 Drawer 里，
  // 首次打开前不挂载 → 加载永远不会执行 → 库列表空、标题显示「未命名管理库」。

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

  // 建库统一走 CreateLibraryDialog。之前这里是 modal.confirm：只有名称框、
  // 没有父级 / 行业模板 / 字段标签，还带 antd 默认的 exclamation-circle
  // （把正常的新建画成警告），而且 onOk 同步 return 会让空名提交直接关掉弹窗。
  // 可移动端唯一的建库路径恰好就是这里，所以老用户拿到的全是这个残废版本。
  const [creatingLib, setCreatingLib] = useState(false)

  const handleNewLibrary = () => {
    setCreatingLib(true)
    onNavigate?.()
  }

  // 在指定库下新建子库（同一个弹窗，预置父库）
  const [creatingChildOf, setCreatingChildOf] = useState<Library | null>(null)

  const handleNewChild = (parent: Library) => {
    setCreatingChildOf(parent)
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
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: async () => {
        await deleteLibrary(lib.id)
        if (currentLibraryId === lib.id) navigate('/')
        message.success(t('app.lib.deleted'))
      },
    })
  }

  // 改分类：setLibraryCategory 早就存在，但只有 AI 能调，
  // 导致用户建的库一律落进「默认」分组，侧边栏永远只有一组。
  const handleCategory = (lib: Library) => {
    let value = lib.category ?? ''
    const existing = Array.from(new Set(libraries.map((l) => l.category).filter(Boolean)))
    modal.confirm({
      title: t('app.lib.categoryTitle'),
      content: (
        <div>
          <Input
            defaultValue={lib.category ?? ''}
            placeholder={t('app.lib.categoryPlaceholder')}
            onChange={(e) => (value = e.target.value)}
            onPressEnter={() => {}}
          />
          {existing.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {existing.map((c) => (
                <Button key={c} size="small" onClick={() => { value = c }}>
                  {c}
                </Button>
              ))}
            </div>
          )}
        </div>
      ),
      okText: t('common.save'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await setLibraryCategory(lib.id, value.trim())
        } catch (e) {
          message.error(t('app.lib.categoryFailed', { msg: (e as Error).message }))
          throw e
        }
      },
    })
  }

  // 手动排序：reorderLibraries 同样是死代码，补上「上移/下移」即可，
  // 比拖拽更可靠（侧边栏是 antd Menu，拖拽排序要另外接 dnd 上下文）
  const move = async (lib: Library, dir: -1 | 1) => {
    const ids = libraries.map((l) => l.id)
    const i = ids.indexOf(lib.id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    try {
      await reorderLibraries(ids)
    } catch (e) {
      message.error(t('app.lib.reorderFailed', { msg: (e as Error).message }))
    }
  }

  // 单个库的「⋯」下拉菜单
  const libActions = (lib: Library): MenuProps => {
    const idx = libraries.findIndex((l) => l.id === lib.id)
    return {
    items: [
      { key: 'child', label: t('app.newChild'), icon: <PlusOutlined /> },
      { key: 'rename', label: t('common.rename'), icon: <EditOutlined /> },
      { key: 'category', label: t('app.lib.category'), icon: <TagsOutlined /> },
      { type: 'divider' },
      {
        key: 'up',
        label: t('app.lib.moveUp'),
        icon: <ArrowUpOutlined />,
        disabled: idx <= 0,
      },
      {
        key: 'down',
        label: t('app.lib.moveDown'),
        icon: <ArrowDownOutlined />,
        disabled: idx < 0 || idx >= libraries.length - 1,
      },
      { type: 'divider' },
      { key: 'delete', label: t('common.delete'), icon: <DeleteOutlined />, danger: true },
    ],
    onClick: ({ key, domEvent }) => {
      domEvent.stopPropagation()
      if (key === 'child') handleNewChild(lib)
      else if (key === 'rename') handleRename(lib)
      else if (key === 'category') handleCategory(lib)
      else if (key === 'up') void move(lib, -1)
      else if (key === 'down') void move(lib, 1)
      else if (key === 'delete') handleDelete(lib)
    },
  }
  }

  // 单个库的菜单项（含子库递归）
  const buildLibItems = (libs: Library[]) => {
    type MenuItem = NonNullable<MenuProps['items']>[number]
    const byParent = new Map<string | null, Library[]>()
    for (const l of libs) byParent.set(l.parentId ?? null, [...(byParent.get(l.parentId ?? null) ?? []), l])
    const makeItem = (l: Library): MenuItem => {
      const children: MenuItem[] = (byParent.get(l.id) ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(makeItem)
      return {
        key: `/library/${l.id}`,
        // 不给每个库都挂同一个 Appstore 图标——同一图标重复 N 次只剩噪声，
        // 库名本身就是最好的标识（去 AI 味规则：重复图标=删）
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
  }

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
        // /help 之前在应用内完全进不去（唯一入口是落地页导航），
        // 新手遇到问题只能出去找官网
        { key: '/help', label: t('app.help'), icon: <QuestionCircleOutlined /> },
      ],
    },
  ]

  const selectedKey =
    location.pathname === '/' || location.pathname === '/trash' || location.pathname === '/settings'
      ? location.pathname
      : currentLibraryId && location.pathname.startsWith('/library/')
        ? `/library/${currentLibraryId}`
        : location.pathname

  const handleClick = (key: string) => {
    if (key === 'new-library') {
      handleNewLibrary()
      onNavigate?.()
      return
    }
    navigate(key)
    // 移动端侧边栏是全屏抽屉：点了库必须自动收起，否则导航已经发生、
    // 抽屉却还盖在全屏上，用户会以为应用卡住了（曾是很高频的抱怨）
    onNavigate?.()
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
    // 统一收口：同步 + 清库数据 + 清 token（authStore.logout 内部会触发 libraryStore 清理）
    await resetSession({ syncFirst: false })
    navigate('/login')
  }

  return {
    account, isDark, menuItems, selectedKey, handleClick, handleLogout, loggingOut,
    creatingLib, setCreatingLib, creatingChildOf, setCreatingChildOf,
  }
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
  const {
    account, menuItems, selectedKey, handleClick, handleLogout, loggingOut,
    creatingLib, setCreatingLib, creatingChildOf, setCreatingChildOf,
  } = state
  return (
    <>
      <div
        onClick={() => handleClick('/')}
        style={{
          padding: '16px 16px 6px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 600,
          color: 'var(--app-ink)',
          cursor: 'pointer',
          fontSize: 14.5,
        }}
      >
        <span className="app-brand-dot" />
        {!collapsed && <span>{t('app.brand')}</span>}
      </div>

      <Menu
        className="app-menu"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={({ key }) => handleClick(key)}
        style={{ borderInlineEnd: 'none' }}
      />

      {/* 页脚不再用大块按钮：两行文字项 + kbd 提示，编辑部式收尾 */}
      <div
        className="app-side-foot"
        style={{
          position: 'sticky',
          bottom: 0,
          width: '100%',
        }}
      >
        <button ref={aiRef} type="button" className="app-foot-item" onClick={onOpenPanel}>
          <span>{collapsed ? '' : t('ai.clerk')}</span>
          {!collapsed && (
            // ⌘ 只在苹果平台存在；Win/Linux 上写 Ctrl，避免假快捷键说明
            <span className="app-foot-kbd">
              {/Mac|iP(hone|ad)/.test(navigator.platform) ? '⌘J' : 'Ctrl·J'}
            </span>
          )}
        </button>
        <button
          type="button"
          className="app-foot-item"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          <span>{collapsed ? '' : t('app.logout', { name: account?.username ?? '' })}</span>
        </button>
      </div>

      {/* 建库只有一个实现：桌面侧边栏和移动端抽屉共用 */}
      <CreateLibraryDialog open={creatingLib} onClose={() => setCreatingLib(false)} />
      <CreateLibraryDialog
        open={creatingChildOf !== null}
        defaultParentId={creatingChildOf?.id ?? null}
        onClose={() => setCreatingChildOf(null)}
      />
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
      width={220}
      style={{ height: '100dvh', overflow: 'auto' }}
      theme={isDark ? 'dark' : 'light'}
    >
      <SidebarBody state={state} collapsed={collapsed} onOpenPanel={onOpenPanel} aiRef={aiRef} />
    </Sider>
  )
}

// 移动端侧边栏内容（用于 Drawer 内）
export function SidebarContent({
  onOpenPanel,
  onNavigate,
}: {
  onOpenPanel: () => void
  onNavigate?: () => void
}) {
  const state = useSidebarState(onNavigate)

  return (
    <div style={{ height: '100dvh', overflow: 'auto', background: 'var(--app-surface)' }}>
      <SidebarBody state={state} collapsed={false} onOpenPanel={onOpenPanel} />
    </div>
  )
}
