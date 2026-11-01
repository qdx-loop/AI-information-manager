import { Button, Input, App, Dropdown, Tooltip } from 'antd'
import {
  DeleteRegular,
  SettingsRegular,
  AddRegular,
  MoreHorizontalRegular,
  EditRegular,
  HomeRegular,
  TagRegular,
  ArrowUpRegular,
  ArrowDownRegular,
  QuestionCircleRegular,
  SignOutRegular,
  SparkleRegular,
  ReOrderDotsVerticalRegular,
  FolderRegular,
  PeopleRegular,
  MoneyRegular,
  BoxRegular,
  ClipboardTaskRegular,
  DocumentRegular,
  DatabaseRegular,
  WeatherMoonRegular,
  WeatherSunnyRegular,
  GlobeRegular,
} from '@fluentui/react-icons'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { MenuProps } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'
import { useLibraryStore } from '@/store/libraryStore'
import { useMemo, useState } from 'react'
import type { Library } from '@/types'
import { syncNow } from '@/utils/autoSync'
import { resetSession } from '@/store/session'
import { useI18n } from '@/i18n'
import CreateLibraryDialog from '@/components/library/CreateLibraryDialog'
import AppIcon from '@/components/common/AppIcon'

/**
 * v9 · Windows 11 左导航（68px 图标栏）
 *
 * 结构：首页 → 分隔线 → 管理库（语义图标）→ 新建库 → 分隔线 → AI / 回收站 / 设置 / 帮助 → 账户
 * 行为与旧版完全一致：建库 / 子库 / 改名 / 分类 / 上下移 / 拖拽排序 / 删除 / 切库 / 退出。
 * 文字只在 hover 时通过 Win11 Tooltip 显示（提示词要求）。
 */

function iconForLibrary(lib: Library) {
  const text = `${lib.category ?? ''} ${lib.name}`.toLowerCase()
  if (/客户|联系|people|customer|contact/.test(text)) return PeopleRegular
  if (/财务|账本|收支|钱|money|finance|expense/.test(text)) return MoneyRegular
  if (/房产|房源|房|home|property|house/.test(text)) return HomeRegular
  if (/库存|商品|货|stock|inventory|product/.test(text)) return BoxRegular
  if (/项目|任务|project|task/.test(text)) return ClipboardTaskRegular
  if (/文档|笔记|doc|note/.test(text)) return DocumentRegular
  if (/数据|database/.test(text)) return DatabaseRegular
  return FolderRegular
}

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
        { key: 'child', label: t('app.newChild'), icon: <AddRegular fontSize={16} /> },
        { key: 'rename', label: t('common.rename'), icon: <EditRegular fontSize={15} /> },
        { key: 'category', label: t('app.lib.category'), icon: <TagRegular fontSize={15} /> },
        { type: 'divider' },
        { key: 'up', label: t('app.lib.moveUp'), icon: <ArrowUpRegular fontSize={15} />, disabled: idx <= 0 },
        {
          key: 'down',
          label: t('app.lib.moveDown'),
          icon: <ArrowDownRegular fontSize={15} />,
          disabled: idx < 0 || idx >= libraries.length - 1,
        },
        { type: 'divider' },
        { key: 'delete', label: t('common.delete'), icon: <DeleteRegular fontSize={16} />, danger: true },
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
    location.pathname === '/' || location.pathname === '/trash' ||
    location.pathname === '/settings' || location.pathname === '/help'
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
    grouped, childrenOf, libActions, libraries, reorderLibraries,
  }
}

function SortableLibIcon({
  lib,
  depth,
  active,
  actions,
  onOpen,
  tooltip,
  moreLabel,
  sheet,
}: {
  lib: Library
  depth: number
  active: boolean
  actions: React.ComponentProps<typeof Dropdown>['menu']
  onOpen: () => void
  tooltip: React.ReactNode
  moreLabel: string
  sheet?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lib.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 3 : undefined,
  }
  const Icon = iconForLibrary(lib)
  if (sheet) {
    return (
      <div ref={setNodeRef} style={style} className="w-sheet-lib-wrap">
        <button
          type="button"
          className={`w-sheet-item${active ? ' is-active' : ''}`}
          style={{ paddingLeft: 14 + depth * 16 }}
          onClick={onOpen}
          {...attributes}
          {...listeners}
        >
          <span className="w-sheet-lib-icon" aria-hidden>
            <Icon fontSize={18} />
          </span>
          <span className="w-sheet-item-label">{lib.name}</span>
        </button>
        <Dropdown menu={actions} trigger={['click']}>
          <button
            type="button"
            className="w-sheet-item-more"
            aria-label={moreLabel}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontalRegular fontSize={16} />
          </button>
        </Dropdown>
      </div>
    )
  }
  return (
    <div ref={setNodeRef} style={style} className="w-rail-lib-wrap">
      <Tooltip title={tooltip} placement="right" mouseEnterDelay={0.35}>
        <button
          type="button"
          className={`w-rail-lib${active ? ' is-active' : ''}`}
          onClick={onOpen}
          {...attributes}
          {...listeners}
        >
          <span className="w-rail-lib-icon" aria-hidden>
            <Icon fontSize={16} />
          </span>
          <span className="w-sr-only">{lib.name}</span>
        </button>
      </Tooltip>
      <Dropdown menu={actions} trigger={['click']}>
        <button
          type="button"
          className="w-rail-lib-more"
          aria-label={moreLabel}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontalRegular fontSize={10} />
        </button>
      </Dropdown>
      <span className="w-rail-drag-handle" aria-hidden>
        <ReOrderDotsVerticalRegular fontSize={10} />
      </span>
    </div>
  )
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
    grouped, childrenOf, libActions, libraries, reorderLibraries,
  } = state

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const libIds = libraries.map((l) => l.id)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active: a, over } = event
    if (!over || a.id === over.id) return
    const oldIndex = libIds.indexOf(String(a.id))
    const newIndex = libIds.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(libIds, oldIndex, newIndex)
    void reorderLibraries(next)
  }

  const renderLib = (lib: Library, depth: number): React.ReactNode => {
    const children = childrenOf.get(lib.id) ?? []
    const active = selectedKey === `/library/${lib.id}`
    return (
      <div key={lib.id}>
        <SortableLibIcon
          lib={lib}
          depth={depth}
          active={active}
          actions={libActions(lib)}
          onOpen={() => handleClick(`/library/${lib.id}`)}
          tooltip={
            <span style={{ display: 'block' }}>
              <strong style={{ fontWeight: 600 }}>{lib.name}</strong>
              {lib.category ? (
                <span style={{ display: 'block', opacity: 0.75, fontSize: 12 }}>{lib.category}</span>
              ) : null}
            </span>
          }
          moreLabel={t('common.more')}
        />
        {children.map((c) => renderLib(c, depth + 1))}
      </div>
    )
  }

  return (
    <>
      <div className="w-rail-top">
        <Tooltip title={t('app.home')} placement="right" mouseEnterDelay={0.35}>
          <button
            type="button"
            className={`w-rail-item${selectedKey === '/' ? ' is-active' : ''}`}
            aria-label={t('app.home')}
            aria-current={selectedKey === '/' ? 'page' : undefined}
            onClick={() => handleClick('/')}
          >
            <HomeRegular fontSize={20} />
          </button>
        </Tooltip>
        <div className="w-rail-divider" role="presentation" />
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={libIds} strategy={verticalListSortingStrategy}>
            {grouped.map(([cat, libs]) => {
              const roots = libs.filter((l) => !l.parentId)
              if (roots.length === 0) return null
              return (
                <div key={cat || '__none'}>
                  {roots.sort((a, b) => a.sortOrder - b.sortOrder).map((lib) => renderLib(lib, 0))}
                </div>
              )
            })}
          </SortableContext>
        </DndContext>
        <Tooltip title={t('app.newLibrary')} placement="right" mouseEnterDelay={0.35}>
          <button
            type="button"
            className="w-rail-add"
            aria-label={t('app.newLibrary')}
            onClick={() => handleClick('new-library')}
          >
            <AddRegular fontSize={16} />
          </button>
        </Tooltip>
      </div>

      <div className="w-rail-bottom">
        <Tooltip title={`${t('app.aiAssistant')} · Ctrl J`} placement="right" mouseEnterDelay={0.35}>
          <button
            ref={aiRef}
            type="button"
            className="w-rail-item"
            aria-label={t('app.aiAssistant')}
            onClick={onOpenPanel}
          >
            <SparkleRegular fontSize={20} />
          </button>
        </Tooltip>
        <div className="w-rail-divider" role="presentation" />
        <Tooltip title={t('app.trash')} placement="right" mouseEnterDelay={0.35}>
          <button
            type="button"
            className={`w-rail-item${selectedKey === '/trash' ? ' is-active' : ''}`}
            aria-label={t('app.trash')}
            aria-current={selectedKey === '/trash' ? 'page' : undefined}
            onClick={() => handleClick('/trash')}
          >
            <DeleteRegular fontSize={20} />
          </button>
        </Tooltip>
        <Tooltip title={t('app.settings')} placement="right" mouseEnterDelay={0.35}>
          <button
            type="button"
            className={`w-rail-item${selectedKey === '/settings' ? ' is-active' : ''}`}
            aria-label={t('app.settings')}
            aria-current={selectedKey === '/settings' ? 'page' : undefined}
            onClick={() => handleClick('/settings')}
          >
            <SettingsRegular fontSize={20} />
          </button>
        </Tooltip>
        <Tooltip title={t('app.help')} placement="right" mouseEnterDelay={0.35}>
          <button
            type="button"
            className={`w-rail-item${selectedKey === '/help' ? ' is-active' : ''}`}
            aria-label={t('app.help')}
            aria-current={selectedKey === '/help' ? 'page' : undefined}
            onClick={() => handleClick('/help')}
          >
            <QuestionCircleRegular fontSize={20} />
          </button>
        </Tooltip>
        <div className="w-rail-divider" role="presentation" />
        <Dropdown
          trigger={['click']}
          placement="topRight"
          menu={{
            items: [
              { key: 'who', label: account?.username ?? '', disabled: true },
              { type: 'divider' },
              {
                key: 'logout',
                icon: <SignOutRegular fontSize={16} />,
                label: t('app.signOut'),
                onClick: () => void handleLogout(),
              },
            ],
          }}
        >
          <button
            type="button"
            className="w-rail-account"
            aria-label={account?.username ?? t('app.signOut')}
            disabled={loggingOut}
          >
            <span className="w-avatar w-avatar--sm">{(account?.username ?? '?').slice(0, 1)}</span>
          </button>
        </Dropdown>
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
    <aside ref={siderRef as React.RefObject<HTMLElement>} className="w-rail">
      <SidebarBody state={state} onOpenPanel={onOpenPanel} aiRef={aiRef} />
    </aside>
  )
}

/**
 * 移动端导航面板（Drawer 内）：Win11 导航窗格形态——
 * 图标 + 文字整行 48px，库列表可点，底部工具与账户。
 */
export function SidebarContent({
  onOpenPanel,
  onNavigate,
}: {
  onOpenPanel: () => void
  onNavigate?: () => void
}) {
  const state = useSidebarState(onNavigate)
  const t = useI18n()
  const { settings, setTheme, setLanguage } = useAppStore()
  const {
    account, selectedKey, handleClick, handleLogout, loggingOut,
    grouped, childrenOf, libActions, libraries, reorderLibraries,
  } = state
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const libIds = libraries.map((l) => l.id)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active: a, over } = event
    if (!over || a.id === over.id) return
    const oldIndex = libIds.indexOf(String(a.id))
    const newIndex = libIds.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    void reorderLibraries(arrayMove(libIds, oldIndex, newIndex))
  }
  const renderLib = (lib: Library, depth: number): React.ReactNode => {
    const children = childrenOf.get(lib.id) ?? []
    const active = selectedKey === `/library/${lib.id}`
    return (
      <div key={lib.id}>
        <SortableLibIcon
          lib={lib}
          depth={depth}
          active={active}
          sheet
          actions={libActions(lib)}
          onOpen={() => handleClick(`/library/${lib.id}`)}
          tooltip={lib.name}
          moreLabel={t('common.more')}
        />
        {children.map((c) => renderLib(c, depth + 1))}
      </div>
    )
  }
  return (
    <aside className="w-sheet">
      <header className="w-sheet-head">
        <AppIcon size={24} />
        <div className="w-sheet-brand">
          <span className="w-sheet-brand-name">{t('app.brand')}</span>
          <span className="w-sheet-brand-sub">{account?.username ?? ''}</span>
        </div>
        <button
          type="button"
          className="w-iconbtn w-iconbtn--sm"
          aria-label={settings.theme === 'dark' ? t('app.theme.light') : t('app.theme.dark')}
          onClick={() => setTheme(settings.theme === 'dark' ? 'light' : 'dark')}
        >
          {settings.theme === 'dark' ? <WeatherSunnyRegular fontSize={16} /> : <WeatherMoonRegular fontSize={16} />}
        </button>
        <button
          type="button"
          className="w-iconbtn w-iconbtn--sm"
          aria-label={t('app.language')}
          onClick={() => setLanguage(settings.language === 'zh' ? 'en' : 'zh')}
        >
          <GlobeRegular fontSize={16} />
        </button>
      </header>
      <div className="w-sheet-body">
        <button
          type="button"
          className={`w-sheet-item${selectedKey === '/' ? ' is-active' : ''}`}
          onClick={() => { handleClick('/'); onNavigate?.() }}
        >
          <span className="w-sheet-lib-icon" aria-hidden><HomeRegular fontSize={18} /></span>
          <span className="w-sheet-item-label">{t('app.home')}</span>
        </button>
        <div className="w-sheet-group">{t('app.group.libraries')}</div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={libIds} strategy={verticalListSortingStrategy}>
            {grouped.map(([cat, libs]) => {
              const roots = libs.filter((l) => !l.parentId)
              if (roots.length === 0) return null
              return <div key={cat || '__none'}>{roots.sort((a, b) => a.sortOrder - b.sortOrder).map((lib) => renderLib(lib, 0))}</div>
            })}
          </SortableContext>
        </DndContext>
        <button type="button" className="w-sheet-add" onClick={() => handleClick('new-library')}>
          <AddRegular fontSize={16} />
          <span>{t('app.newLibrary')}</span>
        </button>
        <div className="w-sheet-group">{t('app.group.tools')}</div>
        <button
          type="button"
          className="w-sheet-item"
          onClick={() => { onOpenPanel(); onNavigate?.() }}
        >
          <span className="w-sheet-lib-icon" aria-hidden><SparkleRegular fontSize={18} /></span>
          <span className="w-sheet-item-label">{t('app.aiAssistant')}</span>
        </button>
        {[
          { key: '/trash', label: t('app.trash') },
          { key: '/settings', label: t('app.settings') },
          { key: '/help', label: t('app.help') },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            className={`w-sheet-item${selectedKey === item.key ? ' is-active' : ''}`}
            onClick={() => handleClick(item.key)}
          >
            <span className="w-sheet-lib-icon" aria-hidden>
              {item.key === '/trash' ? <DeleteRegular fontSize={18} /> : item.key === '/settings' ? <SettingsRegular fontSize={18} /> : <QuestionCircleRegular fontSize={18} />}
            </span>
            <span className="w-sheet-item-label">{item.label}</span>
          </button>
        ))}
      </div>
      <footer className="w-sheet-foot">
        <span className="w-avatar w-avatar--sm">{(account?.username ?? '?').slice(0, 1)}</span>
        <span className="w-sheet-user">{account?.username ?? ''}</span>
        <button
          type="button"
          className="w-btn w-btn--subtle w-btn--sm"
          disabled={loggingOut}
          onClick={() => void handleLogout()}
        >
          <SignOutRegular fontSize={16} />
          {t('app.signOut')}
        </button>
      </footer>
    </aside>
  )
}
