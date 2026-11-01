import { Button, Input, App, Dropdown } from 'antd'
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
  LogoutOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useLibraryStore } from '@/store/libraryStore'
import { useMemo, useState } from 'react'
import type { Library } from '@/types'
import { syncNow } from '@/utils/autoSync'
import { resetSession } from '@/store/session'
import { useI18n } from '@/i18n'
import CreateLibraryDialog from '@/components/library/CreateLibraryDialog'

/**
 * v4 左侧「墨黑索引栏」。
 * 结构：品牌 → 工作区 → 管理库（按分类/父子层级）→ 工具 → 用户。
 * 视觉：264px 墨黑 rail、lime 选中块、2px 硬边、0 圆角；手机端收进 Drawer。
 * 逻辑（建库/改名/分类/排序/删除/退出/切库）与 v3 完全一致，只换外壳。
 */
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
  const [loggingOut, setLoggingOut] = useState(false)
  const t = useI18n()

  // 按分类分组（仅顶级库；子库通过 parentId 递归展示）
  const grouped = useMemo(() => {
    const map = new Map<string, Library[]>()
    libraries.forEach((l) => {
      const arr = map.get(l.category) ?? []
      arr.push(l)
      map.set(l.category, arr)
    })
    return Array.from(map.entries())
  }, [libraries])

  const childrenOf = useMemo(() => {
    const map = new Map<string, Library[]>()
    libraries.forEach((l) => {
      if (!l.parentId) return
      const arr = map.get(l.parentId) ?? []
      arr.push(l)
      map.set(l.parentId, arr)
    })
    for (const arr of map.values()) arr.sort((a, b) => a.sortOrder - b.sortOrder)
    return map
  }, [libraries])

  const [creatingLib, setCreatingLib] = useState(false)
  const handleNewLibrary = () => {
    setCreatingLib(true)
    onNavigate?.()
  }

  const [creatingChildOf, setCreatingChildOf] = useState<Library | null>(null)
  const handleNewChild = (parent: Library) => setCreatingChildOf(parent)

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

  const move = async (lib: Library, dir: -1 | 1) => {
    const ids = libraries.map((l) => l.id)
    const i = ids.indexOf(lib.id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= libraries.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    try {
      await reorderLibraries(ids)
    } catch (e) {
      message.error(t('app.lib.reorderFailed', { msg: (e as Error).message }))
    }
  }

  const libActions = (lib: Library): MenuProps => {
    const idx = libraries.findIndex((l) => l.id === lib.id)
    return {
      items: [
        { key: 'child', label: t('app.newChild'), icon: <PlusOutlined /> },
        { key: 'rename', label: t('common.rename'), icon: <EditOutlined /> },
        { key: 'category', label: t('app.lib.category'), icon: <TagsOutlined /> },
        { type: 'divider' },
        { key: 'up', label: t('app.lib.moveUp'), icon: <ArrowUpOutlined />, disabled: idx <= 0 },
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
      await syncNow()
    } catch (e) {
      console.error('[logout] 退出前同步失败:', e)
    } finally {
      setLoggingOut(false)
    }
    await resetSession({ syncFirst: false })
    navigate('/login')
  }

  return {
    account, selectedKey, handleClick, handleLogout, loggingOut,
    creatingLib, setCreatingLib, creatingChildOf, setCreatingChildOf,
    grouped, childrenOf, libActions,
  }
}

function SidebarBody({
  state,
  onOpenPanel,
  aiRef,
}: {
  state: ReturnType<typeof useSidebarState>
  onOpenPanel: () => void
  aiRef?: React.Ref<HTMLButtonElement>
}) {
  const t = useI18n()
  const {
    account, selectedKey, handleClick, handleLogout, loggingOut,
    grouped, childrenOf, libActions,
  } = state

  const renderLib = (lib: Library, depth: number): React.ReactNode => {
    const children = childrenOf.get(lib.id) ?? []
    const active = selectedKey === `/library/${lib.id}`
    return (
      <div key={lib.id}>
        <div className="rail-lib-row">
          <button
            type="button"
            className={`rail-lib${active ? ' is-active' : ''}`}
            style={{ paddingLeft: 14 + depth * 12 }}
            title={lib.name}
            onClick={() => handleClick(`/library/${lib.id}`)}
          >
            <span className="rail-lib-name">{lib.name}</span>
          </button>
          <Dropdown menu={libActions(lib)} trigger={['click']}>
            <button
              type="button"
              className="rail-lib-more"
              aria-label={t('common.more')}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreOutlined />
            </button>
          </Dropdown>
        </div>
        {children.map((c) => renderLib(c, depth + 1))}
      </div>
    )
  }

  return (
    <>
      <button type="button" className="rail-brand" onClick={() => handleClick('/')}>
        <span className="rail-mark" aria-hidden />
        <span style={{ minWidth: 0, textAlign: 'left' }}>
          <span className="rail-brand-name">{t('app.brand')}</span>
          <span className="rail-brand-sub">SIGNAL PRESS · LOCAL</span>
        </span>
      </button>

      <div className="rail-body">
        <button
          type="button"
          className={`rail-item${selectedKey === '/' ? ' is-active' : ''}`}
          onClick={() => handleClick('/')}
        >
          <HomeOutlined />
          <span className="rail-text">{t('app.home')}</span>
        </button>

        <div className="rail-group">{t('app.group.libraries')}</div>
        {grouped.map(([cat, libs]) => {
          const roots = libs.filter((l) => !l.parentId)
          if (roots.length === 0) return null
          return (
            <div key={cat}>
              {cat && <div className="rail-group rail-group--cat">{cat}</div>}
              {roots.sort((a, b) => a.sortOrder - b.sortOrder).map((lib) => renderLib(lib, 0))}
            </div>
          )
        })}
        <button type="button" className="rail-new" onClick={() => handleClick('new-library')}>
          <PlusOutlined />
          <span>{t('app.newLibrary')}</span>
        </button>

        <div className="rail-group">{t('app.group.tools')}</div>
        <button
          type="button"
          className={`rail-item${selectedKey === '/trash' ? ' is-active' : ''}`}
          onClick={() => handleClick('/trash')}
        >
          <DeleteOutlined />
          <span className="rail-text">{t('app.trash')}</span>
        </button>
        <button
          type="button"
          className={`rail-item${selectedKey === '/settings' ? ' is-active' : ''}`}
          onClick={() => handleClick('/settings')}
        >
          <SettingOutlined />
          <span className="rail-text">{t('app.settings')}</span>
        </button>
        <button
          type="button"
          className={`rail-item${selectedKey === '/help' ? ' is-active' : ''}`}
          onClick={() => handleClick('/help')}
        >
          <QuestionCircleOutlined />
          <span className="rail-text">{t('app.help')}</span>
        </button>
      </div>

      <div className="rail-foot">
        <button
          ref={aiRef}
          type="button"
          className="rail-ai"
          onClick={onOpenPanel}
          title={t('app.aiAssistant')}
        >
          <RobotOutlined />
          <span className="rail-ai-text">{t('app.aiAssistant')}</span>
          <kbd className="rail-ai-kbd">
            {/Mac|iP(hone|ad)/.test(navigator.platform) ? '⌘J' : 'Ctrl·J'}
          </kbd>
        </button>
        <div className="rail-user">
          <span className="rail-avatar" aria-hidden>
            {(account?.username ?? '?').slice(0, 1).toUpperCase()}
          </span>
          <span className="rail-username">{account?.username ?? ''}</span>
          <button
            type="button"
            className="rail-logout"
            aria-label={t('app.signOut')}
            title={t('app.signOut')}
            disabled={loggingOut}
            onClick={handleLogout}
          >
            <LogoutOutlined />
          </button>
        </div>
      </div>

      <CreateLibraryDialog open={state.creatingLib} onClose={() => state.setCreatingLib(false)} />
      <CreateLibraryDialog
        open={state.creatingChildOf !== null}
        defaultParentId={state.creatingChildOf?.id ?? null}
        onClose={() => state.setCreatingChildOf(null)}
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
  siderRef?: React.Ref<HTMLElement>
  aiRef?: React.Ref<HTMLButtonElement>
}) {
  const state = useSidebarState()
  return (
    <aside ref={siderRef as React.RefObject<HTMLElement>} className="app-rail">
      <SidebarBody state={state} onOpenPanel={onOpenPanel} aiRef={aiRef} />
    </aside>
  )
}

// 移动端侧边栏内容（Drawer 内）：复用同一套导航与逻辑
export function SidebarContent({
  onOpenPanel,
  onNavigate,
}: {
  onOpenPanel: () => void
  onNavigate?: () => void
}) {
  const state = useSidebarState(onNavigate)
  return (
    <aside className="app-rail" style={{ width: '100%', height: '100dvh' }}>
      <SidebarBody state={state} onOpenPanel={onOpenPanel} />
    </aside>
  )
}
