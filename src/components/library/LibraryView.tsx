import { useState, useMemo, useEffect, useRef, Fragment } from 'react'

// 输入防抖：大数据量下每键击全量过滤会卡顿
function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
import { useParams, useNavigate } from 'react-router-dom'
import {
  Breadcrumb,
  BreadcrumbButton,
  BreadcrumbDivider,
  BreadcrumbItem,
  Button,
  Dropdown,
  Input,
  Field,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Option,
  SearchBox,
  Skeleton,
  SkeletonItem,
  Text,
  Toolbar,
  ToolbarButton,
  ToolbarDivider,
  Tooltip,
} from '@fluentui/react-components'
import {
  AddRegular,
  ArrowClockwiseRegular,
  ArrowExportUpRegular,
  ArrowImportRegular,
  ArrowLeftRegular,
  ArrowSortDownRegular,
  ArrowSortUpRegular,
  ArrowUpRegular,
  CopyRegular,
  DismissRegular,
  FolderRegular,
  HomeRegular,
  MoreHorizontalRegular,
  SearchRegular,
  SettingsRegular,
  TableRegular,
  WarningRegular,
} from '@fluentui/react-icons'
import { App } from 'antd'
import { useLibraryStore } from '@/store/libraryStore'
import LibraryTable from './LibraryTable'
import ItemEditor from './ItemEditor'
import TemplateEditor from './TemplateEditor'
import ImportExport, { type ImportExportHandle } from './ImportExport'
import type { Item, FieldValue, Library } from '@/types'
import { useI18n, tNow } from '@/i18n'
import { track } from '@/utils/track'
import { useBackButtonLayer } from '@/utils/backButton'
import { isBlankFieldValue } from '@/utils/fieldValue'
import EmptyPanel from './EmptyPanel'
import { LibConfirm, LibDialog, useLibText } from './labels'

/**
 * 库页工作区（v10 · Fluent UI 2 / Windows 11 应用）。
 *
 * 结构（资源管理器式信息架构，但全部是 Fluent 组件）：
 *   Toolbar（新建条目/导入/导出/模板/复用/更多）
 *   Breadcrumb 路径行（后退/上一级/刷新 + 首页 > 父库 > 当前库）
 *   筛选行（SearchBox + 字段 Dropdown + 排序 Dropdown）
 *   表格 / 空态（Fluent token 渲染的详细信息视图；移动端 Card 列表）
 *   状态栏（共 N 项 · 已选 N 项 · 每页条数 · 分页）
 *
 * 业务逻辑与原实现完全一致：搜索/筛选/排序、内联编辑必填校验、导入进度反馈、
 * 模板复用、库不存在时的只读兜底、对话框返回键层级与隐藏 ImportExport 实例。
 */
export default function LibraryView() {
  const { id } = useParams()
  const { message } = App.useApp()
  const ioRef = useRef<ImportExportHandle>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const lt = useLibText()
  const {
    libraries,
    currentLibraryId,
    fields,
    items,
    focusItemId,
    loading,
    libsReady,
    selectLibrary,
    refreshCurrent,
    createItem,
    updateItem,
    deleteItem,
    pinItem,
    saveTemplate,
    cloneTemplate,
  } = useLibraryStore()
  const t = useI18n()

  useEffect(() => {
    if (id && id !== currentLibraryId) {
      selectLibrary(id).catch((e) => message.error(tNow('app.loadLibFailed', { msg: (e as Error).message })))
    }
  }, [id, currentLibraryId, selectLibrary, message])

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [cloneTargets, setCloneTargets] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const keyword = useDebounced(keywordInput, 250)
  const [filterField, setFilterField] = useState<string>('')
  const [filterValue, setFilterValue] = useState<string>('')
  const [sortField, setSortField] = useState<string>('')
  const navigate = useNavigate()
  const [sortDesc, setSortDesc] = useState(false)
  const [needTemplate, setNeedTemplate] = useState(false)
  const [deleteTargets, setDeleteTargets] = useState<Item[] | null>(null)
  const [deleting, setDeleting] = useState(false)

  const lib = libraries.find((l) => l.id === id)
  /**
   * 库不存在 / 已被删除（含 AI 删除当前库后没有导航的情况）。
   *
   * 必须同时满足「已经加载过库列表」才谈得上不存在，否则冷启动第一帧
   * libraries 还是空的，会闪出假报错。这种情况下页面不接受任何写入操作。
   */
  const libMissing = libsReady && !loading && !lib

  // 搜索 + 筛选 + 排序（逻辑与原实现一致；列头点击 / 排序菜单共用 handleToggleSort）
  const processed = useMemo(() => {
    let list = [...items]
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      list = list.filter((it) =>
        Object.values(it.fields).some((v) => v != null && String(v).toLowerCase().includes(kw)),
      )
    }
    if (filterField && filterValue) {
      list = list.filter((it) => {
        const v = it.fields[filterField]
        return v != null && String(v).toLowerCase().includes(filterValue.toLowerCase())
      })
    }
    if (sortField) {
      list.sort((a, b) => {
        const va = a.fields[sortField]
        const vb = b.fields[sortField]
        if (va == null) return 1
        if (vb == null) return -1
        if (typeof va === 'number' && typeof vb === 'number') {
          return sortDesc ? vb - va : va - vb
        }
        return sortDesc
          ? String(vb).localeCompare(String(va))
          : String(va).localeCompare(String(vb))
      })
    } else {
      list.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return a.sortOrder - b.sortOrder
      })
    }
    return list
  }, [items, keyword, filterField, filterValue, sortField, sortDesc])

  const visibleFields = fields.filter((f) => f.visible)
  const hasFilters = Boolean(keywordInput || filterField || sortField)

  const clearFilters = () => {
    setKeywordInput('')
    setFilterField('')
    setFilterValue('')
    setSortField('')
  }

  const handleToggleSort = (key: string) => {
    if (!key) {
      setSortField('')
      return
    }
    if (sortField === key) setSortDesc((v) => !v)
    else {
      setSortField(key)
      setSortDesc(false)
    }
  }

  const handleRefresh = () => {
    refreshCurrent().catch((e) => message.error(tNow('app.loadLibFailed', { msg: (e as Error).message })))
  }

  /** Ctrl/⌘ + F：聚焦搜索框 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /** 路径行：父库链路（首页 > … > 当前库） */
  const ancestors = useMemo(() => {
    const out: Library[] = []
    if (!lib) return out
    let cursor = lib.parentId ? libraries.find((l) => l.id === lib.parentId) : undefined
    let guard = 0
    while (cursor && guard < 8) {
      out.unshift(cursor)
      cursor = cursor.parentId ? libraries.find((l) => l.id === cursor!.parentId) : undefined
      guard++
    }
    return out
  }, [lib, libraries])

  // react-router 的历史下标：idx > 0 说明应用内还有上一页
  const historyIdx = (window.history.state as { idx?: number } | null)?.idx ?? 0
  const canGoBack = historyIdx > 0

  const handleNew = () => {
    if (fields.length === 0) {
      setNeedTemplate(true)
      return
    }
    setEditing(null)
    setEditorOpen(true)
  }

  const handleEdit = (item: Item) => {
    setEditing(item)
    setEditorOpen(true)
  }

  const handleSave = async (values: Record<string, FieldValue>) => {
    if (editing) {
      // 必须合并而不是替换：编辑表单只注册了「可见字段」，
      // 整体替换会把被隐藏字段的历史数据静默清空（用户以为只是改了个备注）。
      await updateItem({ ...editing, fields: { ...editing.fields, ...values } })
      message.success(t('lib.saved.item'))
    } else {
      await createItem(values)
      track('item_created')
      message.success(t('lib.created.item'))
    }
    setEditorOpen(false)
    setEditing(null)
  }

  const handleDelete = (item: Item) => setDeleteTargets([item])
  const handleBatchDelete = (targets: Item[]) => {
    if (targets.length === 0) return
    setDeleteTargets(targets)
  }

  /** 单条 / 批量删除共用同一条确认与失败处理（逐条串行调用既有 deleteItem） */
  const confirmDelete = async () => {
    if (!deleteTargets || deleting) return
    setDeleting(true)
    let done = 0
    try {
      for (const it of deleteTargets) {
        await deleteItem(it.id)
        done++
      }
      message.success(
        deleteTargets.length === 1 ? t('lib.del.done') : lt('sel.deleted', { n: done }),
      )
      setDeleteTargets(null)
    } catch (e) {
      message.error(
        deleteTargets.length === 1
          ? t('lib.del.failed', { msg: (e as Error).message })
          : lt('sel.deletedFailed', { msg: (e as Error).message }),
      )
    } finally {
      setDeleting(false)
    }
  }

  /** 批量置顶 / 取消置顶（沿用既有 pinItem） */
  const handleBatchPin = async (targets: Item[], pinned: boolean) => {
    if (targets.length === 0) return
    try {
      for (const it of targets) {
        if (it.pinned !== pinned) await pinItem(it.id, pinned)
      }
      message.success(pinned ? lt('sel.pinned', { n: targets.length }) : lt('sel.unpinned', { n: targets.length }))
    } catch (e) {
      message.error(lt('sel.pinFailed', { msg: (e as Error).message }))
    }
  }

  /**
   * 表格内联编辑落库。
   *
   * 刻意不弹成功 toast：连续录入时 toast 会盖住正在编辑的单元格。
   * 但必填校验不能省：弹窗里有 required 规则，而这条内联路径直接落库。
   */
  const handlePatch = async (item: Item, nextFields: Item['fields']) => {
    const missing = fields.filter((f) => f.required && isBlankFieldValue(nextFields[f.key]))
    if (missing.length > 0) {
      const msg = t('lib.patch.requiredMissing', { names: missing.map((f) => f.label).join('、') })
      message.error(msg)
      // 抛出去让 LibraryTable 留在编辑态：用户能看到没保存成，并能改回来。
      throw new Error(msg)
    }
    await updateItem({ ...item, fields: nextFields })
  }

  const handleImport = async (rows: Record<string, FieldValue>[]) => {
    if (rows.length === 0) return
    // 大批量导入是「点了没反应」的重灾区：串行写入且毫无反馈。
    const key = 'lib.import.progress'
    let done = 0
    message.loading({ content: t('lib.import.progress', { n: 0, total: rows.length }), key, duration: 0 })
    try {
      for (const r of rows) {
        await createItem(r)
        done++
        if (done % 20 === 0 || done === rows.length) {
          message.loading({
            content: t('lib.import.progress', { n: done, total: rows.length }),
            key,
            duration: 0,
          })
        }
      }
      message.success({ content: t('lib.import.done', { n: rows.length }), key })
    } catch (e) {
      message.error({
        content: t('lib.import.partial', { n: done, total: rows.length, msg: (e as Error).message }),
        key,
        duration: 6,
      })
      throw e
    }
    if (rows.length > 0) track('items_imported', { count: rows.length })
  }

  // 模板复用：把当前库模板复制到其他库
  const cloneTargetsOptions = libraries.filter((l) => l.id !== id)
  const handleClone = () => {
    if (cloneTargetsOptions.length === 0) {
      message.info(t('lib.clone.none'))
      return
    }
    setCloneTargets([])
    setCloneOpen(true)
  }
  const confirmClone = async () => {
    if (!cloneTargets.length) {
      message.warning(t('lib.clone.pickRequired'))
      return
    }
    for (const tid of cloneTargets) {
      await cloneTemplate(id!, tid)
    }
    setCloneOpen(false)
    message.success(t('lib.clone.done', { n: cloneTargets.length }))
  }

  /* —— 筛选 / 排序下拉 —— */
  const filterFieldLabel =
    visibleFields.find((f) => f.key === filterField)?.label ?? lt('filter.all')
  const sortLabel = sortField
    ? visibleFields.find((f) => f.key === sortField)?.label ?? lt('sort.placeholder')
    : lt('sort.placeholder')

  useBackButtonLayer(editorOpen, () => setEditorOpen(false))
  useBackButtonLayer(templateOpen, () => setTemplateOpen(false))
  useBackButtonLayer(cloneOpen, () => setCloneOpen(false))

  /* ────────────── 加载中：Fluent Skeleton，布局贴近最终状态 ────────────── */
  if (loading) {
    return (
      <div className="lib-page" aria-busy="true" aria-live="polite">
        <div className="lib-toolbar">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonItem key={i} size={16} shape="rectangle" style={{ width: i === 0 ? 96 : 72, height: 24 }} />
          ))}
        </div>
        <div className="lib-content">
          <div className="lib-card" style={{ padding: 16 }}>
            <Skeleton>
              <div className="lib-skeleton">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div className="lib-skeleton-row" key={i}>
                    <SkeletonItem size={16} shape="square" />
                    <SkeletonItem size={16} shape="rectangle" style={{ width: 140 }} />
                    <SkeletonItem size={16} shape="rectangle" style={{ width: 90 }} />
                    <SkeletonItem size={16} shape="rectangle" style={{ flex: 1 }} />
                    <SkeletonItem size={16} shape="rectangle" style={{ width: 90 }} />
                  </div>
                ))}
              </div>
            </Skeleton>
          </div>
        </div>
      </div>
    )
  }

  /* ────────────── 库不存在 / 已删除：只给出口，不提供任何写入口 ────────────── */
  if (libMissing) {
    return (
      <div className="lib-page">
        <div className="lib-pathrow">
          <Breadcrumb aria-label={t('app.home')}>
            <BreadcrumbItem>
              <BreadcrumbButton icon={<HomeRegular />} onClick={() => navigate('/')}>
                {t('app.home')}
              </BreadcrumbButton>
            </BreadcrumbItem>
          </Breadcrumb>
        </div>
        <div className="lib-content">
          <EmptyPanel
            icon={<WarningRegular fontSize={24} />}
            title={t('lib.missing.title')}
            body={t('lib.missing.body')}
            action={
              <>
                <Button appearance="primary" onClick={() => navigate('/')}>
                  {t('lib.missing.backHome')}
                </Button>
                <Button appearance="secondary" onClick={() => navigate('/trash')}>
                  {t('lib.missing.toTrash')}
                </Button>
              </>
            }
          />
        </div>
      </div>
    )
  }

  const isEmpty = processed.length === 0

  return (
    <div className="lib-page">
      {/* ══ 工具栏（Fluent Toolbar）══ */}
      <Toolbar
        aria-label={`${t('app.brand')} · ${lib?.name ?? t('lib.untitled')}`}
        className="lib-toolbar"
        size="small"
      >
        <ToolbarButton appearance="primary" icon={<AddRegular />} onClick={handleNew}>
          {t('lib.empty.cta')}
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          className="lib-cmdbar-optional"
          icon={<ArrowImportRegular />}
          onClick={() => ioRef.current?.openImport()}
        >
          {t('lib.importExport.import')}
        </ToolbarButton>
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <ToolbarButton className="lib-cmdbar-optional" icon={<ArrowExportUpRegular />}>
              {t('lib.importExport.export')}
            </ToolbarButton>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem onClick={() => ioRef.current?.exportAs('csv')}>{t('lib.importExport.exportCsv')}</MenuItem>
              <MenuItem onClick={() => ioRef.current?.exportAs('excel')}>{t('lib.importExport.exportExcel')}</MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
        <ToolbarDivider className="lib-cmdbar-optional" />
        <ToolbarButton
          className="lib-cmdbar-optional"
          icon={<SettingsRegular />}
          onClick={() => setTemplateOpen(true)}
        >
          {t('lib.template')}
        </ToolbarButton>
        <ToolbarButton
          className="lib-cmdbar-optional"
          icon={<CopyRegular />}
          disabled={fields.length === 0}
          onClick={handleClone}
        >
          {t('lib.clone')}
        </ToolbarButton>
        <span className="lib-toolbar-spacer" />
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <ToolbarButton icon={<MoreHorizontalRegular />} aria-label={t('common.more')} />
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem icon={<SettingsRegular />} onClick={() => setTemplateOpen(true)}>
                {t('lib.menu.template')}
              </MenuItem>
              <MenuItem icon={<CopyRegular />} disabled={fields.length === 0} onClick={handleClone}>
                {t('lib.menu.clone')}
              </MenuItem>
              <MenuItem icon={<ArrowImportRegular />} onClick={() => ioRef.current?.openImport()}>
                {t('lib.menu.import')}
              </MenuItem>
              <MenuItem onClick={() => ioRef.current?.exportAs('csv')}>{t('lib.menu.exportCsv')}</MenuItem>
              <MenuItem onClick={() => ioRef.current?.exportAs('excel')}>{t('lib.menu.exportExcel')}</MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
      </Toolbar>

      {/* ══ 路径行（Fluent Breadcrumb）══ */}
      <div className="lib-pathrow">
        <div className="lib-pathrow-nav">
          <Tooltip content={lt('nav.back')} relationship="label">
            <Button
              appearance="transparent"
              size="small"
              icon={<ArrowLeftRegular />}
              aria-label={lt('nav.back')}
              disabled={!canGoBack}
              onClick={() => navigate(-1)}
            />
          </Tooltip>
          <Tooltip content={lt('nav.up')} relationship="label">
            <Button
              appearance="transparent"
              size="small"
              icon={<ArrowUpRegular />}
              aria-label={lt('nav.up')}
              onClick={() => navigate(lib?.parentId ? `/library/${lib.parentId}` : '/')}
            />
          </Tooltip>
          <Tooltip content={lt('nav.refresh')} relationship="label">
            <Button
              appearance="transparent"
              size="small"
              icon={<ArrowClockwiseRegular />}
              aria-label={lt('nav.refresh')}
              onClick={handleRefresh}
            />
          </Tooltip>
        </div>
        <Breadcrumb aria-label={t('app.home')}>
          <BreadcrumbItem>
            <BreadcrumbButton icon={<HomeRegular />} onClick={() => navigate('/')}>
              {t('app.home')}
            </BreadcrumbButton>
          </BreadcrumbItem>
          {ancestors.map((a) => (
            <Fragment key={a.id}>
              <BreadcrumbDivider />
              <BreadcrumbItem>
                <BreadcrumbButton onClick={() => navigate(`/library/${a.id}`)}>{a.name}</BreadcrumbButton>
              </BreadcrumbItem>
            </Fragment>
          ))}
          <BreadcrumbDivider />
          <BreadcrumbItem>
            <BreadcrumbButton current icon={<FolderRegular />}>
              {lib?.name ?? t('lib.untitled')}
            </BreadcrumbButton>
          </BreadcrumbItem>
        </Breadcrumb>
        {lib?.category ? <span className="lib-path-meta">{lib.category}</span> : null}
      </div>

      {/* ══ 筛选行：SearchBox + 字段 / 排序 Dropdown ══ */}
      <div className="lib-filterbar" role="search">
        <SearchBox
          ref={searchRef}
          className="lib-filter-search"
          placeholder={t('lib.searchPlaceholder')}
          aria-label={lt('search.hint')}
          value={keywordInput}
          onChange={(_, data) => setKeywordInput(data.value)}
        />
        <Dropdown
          className="lib-filter-drop"
          size="small"
          value={filterFieldLabel}
          selectedOptions={filterField ? [filterField] : []}
          aria-label={t('lib.filterField')}
          onOptionSelect={(_, data) => {
            setFilterField(data.optionValue === '__all' ? '' : data.optionValue ?? '')
            setFilterValue('')
          }}
        >
          <Option value="__all" text={lt('filter.all')}>
            {lt('filter.all')}
          </Option>
          {visibleFields.map((f) => (
            <Option key={f.key} value={f.key} text={f.label}>
              {f.label}
            </Option>
          ))}
        </Dropdown>
        {filterField ? (
          <Input
            className="lib-filter-input"
            value={filterValue}
            placeholder={t('lib.filterValue')}
            aria-label={t('lib.filterValue')}
            onChange={(_, data) => setFilterValue(data.value)}
          />
        ) : null}
        <Dropdown
          className="lib-filter-drop"
          size="small"
          value={sortLabel}
          selectedOptions={sortField ? [sortField] : []}
          aria-label={t('lib.sort')}
          onOptionSelect={(_, data) => {
            if (!data.optionValue || data.optionValue === '__none') {
              setSortField('')
              return
            }
            setSortField(data.optionValue)
            setSortDesc(false)
          }}
        >
          <Option value="__none" text={lt('sort.none')}>
            {lt('sort.none')}
          </Option>
          {visibleFields.map((f) => (
            <Option key={f.key} value={f.key} text={f.label}>
              {f.label}
            </Option>
          ))}
        </Dropdown>
        {sortField ? (
          <Tooltip content={sortDesc ? t('lib.desc') : t('lib.asc')} relationship="label">
            <Button
              appearance="subtle"
              size="small"
              icon={sortDesc ? <ArrowSortDownRegular /> : <ArrowSortUpRegular />}
              aria-label={sortDesc ? t('lib.desc') : t('lib.asc')}
              onClick={() => setSortDesc((v) => !v)}
            >
              {sortDesc ? t('lib.desc') : t('lib.asc')}
            </Button>
          </Tooltip>
        ) : null}
        {hasFilters ? (
          <Button appearance="subtle" size="small" icon={<DismissRegular />} onClick={clearFilters}>
            {t('lib.clear')}
          </Button>
        ) : null}
        <span className="lib-filter-spacer" />
        {hasFilters ? (
          <Text size={200} className="lib-filter-meta lib-filter-meta--desktop">
            {processed.length} / {items.length}
          </Text>
        ) : null}
        <Text size={200} className="lib-filter-meta lib-filter-meta--mobile">
          {lt('status.total', { n: processed.length })}
        </Text>
      </div>

      {/* ══ 主体：表格或空态 ══ */}
      <div className="lib-content">
        {isEmpty ? (
          <div className="lib-card lib-card--flush">
            {items.length === 0 && fields.length === 0 ? (
              // 一个字段都没有时，「新建条目」是无效动作——先去配模板
              <EmptyPanel
                icon={<TableRegular fontSize={24} />}
                title={t('lib.empty.noFields.title')}
                body={t('lib.empty.noFields.body')}
                action={
                  <Button appearance="primary" onClick={() => setTemplateOpen(true)}>
                    {t('lib.empty.noFields.cta')}
                  </Button>
                }
              />
            ) : items.length === 0 ? (
              // 首次使用：空状态说清「这里将来会放什么」，并给新建 + 导入两个出口
              <EmptyPanel
                icon={<FolderRegular fontSize={24} />}
                title={t('lib.empty.none.title')}
                body={
                  <>
                    {t('lib.empty.none.body', { name: lib?.name ?? t('lib.untitled') })}
                    <span style={{ display: 'block', marginTop: 6 }}>{t('lib.empty.none.hint')}</span>
                  </>
                }
                action={
                  <>
                    <Button appearance="primary" onClick={handleNew}>
                      {t('lib.empty.cta')}
                    </Button>
                    <Button appearance="secondary" icon={<ArrowImportRegular />} onClick={() => ioRef.current?.openImport()}>
                      {t('lib.importExport.import')}
                    </Button>
                  </>
                }
              />
            ) : (
              // 筛选无结果：给出退路，而不是死路
              <EmptyPanel
                icon={<SearchRegular fontSize={24} />}
                title={t('lib.empty.noMatch.title')}
                body={t('lib.empty.noMatch.body')}
                action={
                  <>
                    <Button appearance="secondary" onClick={clearFilters}>
                      {t('lib.clear')}
                    </Button>
                    <Text size={200}>{t('lib.total', { n: items.length })}</Text>
                  </>
                }
              />
            )}
            <div className="lib-statusbar">
              <div className="lib-status-group">
                <span className="lib-status-strong">{lt('status.total', { n: items.length })}</span>
              </div>
              <span className="lib-status-spacer" />
              <Text size={200}>{lt('view.details')}</Text>
            </div>
          </div>
        ) : (
          <div className="lib-card lib-card--flush">
            <LibraryTable
              fields={fields}
              items={processed}
              focusItemId={focusItemId}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onPin={(item, pinned) => {
                pinItem(item.id, pinned).catch((e) =>
                  message.error(tNow('app.loadLibFailed', { msg: (e as Error).message })),
                )
              }}
              onPatch={handlePatch}
              sortField={sortField}
              sortDesc={sortDesc}
              onToggleSort={handleToggleSort}
              onBatchDelete={handleBatchDelete}
              onBatchPin={handleBatchPin}
            />
          </div>
        )}
      </div>

      {/* ImportExport 必须始终挂载：工具栏按钮与「更多」菜单都通过 ioRef
          命令式触发该实例的上传框 / Blob 下载；卸载后 ref 为 null，入口会静默失效。 */}
      <div hidden>
        <ImportExport ref={ioRef} fields={fields} items={items} onImport={handleImport} />
      </div>

      <ItemEditor
        open={editorOpen}
        fields={fields}
        item={editing}
        onCancel={() => {
          setEditorOpen(false)
          setEditing(null)
        }}
        onSave={handleSave}
        onDelete={(it) => {
          // 编辑器里的「删除」走同一条二次确认路径；先收起编辑器，
          // 避免确认框关掉后还留着一个已不存在的条目表单
          setEditorOpen(false)
          setEditing(null)
          handleDelete(it)
        }}
      />
      <TemplateEditor
        open={templateOpen}
        libraryId={id!}
        fields={fields}
        onCancel={() => setTemplateOpen(false)}
        onSave={async (fs) => {
          await saveTemplate(id!, fs)
          await refreshCurrent()
          setTemplateOpen(false)
          message.success(t('lib.tpl.saved'))
        }}
      />

      {/* 字段模板复用（Fluent Dialog · 多选目标库） */}
      <LibDialog
        open={cloneOpen}
        onClose={() => setCloneOpen(false)}
        title={t('lib.clone.modalTitle')}
        width="min(480px, calc(100vw - 32px))"
        actions={
          <div className="lib-dialog-footer">
            <span className="lib-dialog-footer-spacer" />
            <Button appearance="secondary" onClick={() => setCloneOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button appearance="primary" onClick={confirmClone}>
              {t('common.confirm')}
            </Button>
          </div>
        }
      >
        <Text size={200} className="lib-dialog-sub">
          {t('lib.clone.pick')}
        </Text>
        <Field>
          <Dropdown
            multiselect
            value={cloneTargets
              .map((tid) => cloneTargetsOptions.find((l) => l.id === tid)?.name ?? '')
              .filter(Boolean)
              .join(', ')}
            selectedOptions={cloneTargets}
            placeholder={t('lib.clone.placeholder')}
            onOptionSelect={(_, data) => setCloneTargets(data.selectedOptions)}
          >
            {cloneTargetsOptions.map((l) => (
              <Option key={l.id} value={l.id} text={l.name}>
                {l.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </LibDialog>

      {/* 未配置字段模板时的提示（替代旧版 modal.warning） */}
      <LibConfirm
        open={needTemplate}
        title={t('lib.needTemplate.title')}
        body={t('lib.needTemplate.content')}
        confirmText={t('lib.needTemplate.go')}
        onConfirm={() => {
          setNeedTemplate(false)
          setTemplateOpen(true)
        }}
        onClose={() => setNeedTemplate(false)}
      />

      {/* 删除确认（单条 / 批量共用） */}
      <LibConfirm
        open={deleteTargets !== null}
        title={
          deleteTargets && deleteTargets.length > 1
            ? lt('sel.deleteTitle', { n: deleteTargets.length })
            : t('lib.del.title')
        }
        body={deleteTargets && deleteTargets.length > 1 ? lt('sel.deleteBody') : t('lib.del.content')}
        confirmText={t('lib.del.ok')}
        danger
        confirming={deleting}
        onConfirm={confirmDelete}
        onClose={() => {
          if (!deleting) setDeleteTargets(null)
        }}
      />
    </div>
  )
}
