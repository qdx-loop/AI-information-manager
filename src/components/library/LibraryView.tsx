import { useState, useMemo, useEffect, useRef } from 'react'

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
import { Select, App, Modal, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import {
  AddRegular,
  ArrowImportRegular,
  ArrowExportUpRegular,
  ArrowLeftRegular,
  ArrowUpRegular,
  ArrowClockwiseRegular,
  SearchRegular,
  DismissRegular,
  FilterRegular,
  ArrowSortRegular,
  ArrowSortUpRegular,
  ArrowSortDownRegular,
  MoreHorizontalRegular,
  SettingsRegular,
  CopyRegular,
  HomeRegular,
  ChevronRightRegular,
  ChevronDownRegular,
  FolderRegular,
  TableRegular,
  WarningRegular,
} from '@fluentui/react-icons'
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
import { useLibText } from './labels'

/**
 * 库页工作区（v9 · Windows 11 文件资源管理器）。
 *
 * 结构：
 *   命令栏（44）：新建条目 / 导入 / 导出 / 模板 / 复用 / 更多
 *   地址条（32）：后退 · 上一级 · 刷新 · 首页 > 父库 > 当前库
 *   筛选行：搜索 + 字段筛选 + 排序 + 清除
 *   表格 / 空态：文件资源管理器式详细信息视图（移动端单列卡片）
 *   状态栏：共 N 项 · 已选 N 项 · 每页条数 · 分页
 *
 * 业务逻辑与原实现完全一致：搜索/筛选/排序、内联编辑必填校验、导入进度反馈、
 * 模板复用、库不存在时的只读兜底、所有对话框的返回键层级与隐藏 ImportExport 实例。
 */
export default function LibraryView() {
  const { id } = useParams()
  const { message, modal } = App.useApp()
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

  const lib = libraries.find((l) => l.id === id)
  /**
   * 库不存在 / 已被删除（含 AI 删除当前库后没有导航的情况）。
   *
   * 必须同时满足「已经加载过库列表」才谈得上不存在，
   * 否则冷启动第一帧 libraries 还是空的，会闪出假报错。
   * 这种情况下页面不接受任何写入操作，只给「回到首页 / 去回收站」两个出口。
   */
  const libMissing = libsReady && !loading && !lib

  // 搜索 + 筛选 + 排序（逻辑与原实现一致，只换了排序入口：列头 / 排序菜单共用 handleToggleSort）
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

  /** Ctrl/⌘ + F：聚焦搜索框（文件资源管理器的搜索快捷键） */
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

  /** 地址条：父库链路（首页 > … > 当前库） */
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
      modal.warning({
        icon: null,
        title: t('lib.needTemplate.title'),
        content: t('lib.needTemplate.content'),
        okText: t('lib.needTemplate.go'),
        onOk: () => setTemplateOpen(true),
      })
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

  const handleDelete = (item: Item) => {
    modal.confirm({
      icon: null,
      title: t('lib.del.title'),
      content: t('lib.del.content'),
      okText: t('lib.del.ok'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await deleteItem(item.id)
          message.success(t('lib.del.done'))
        } catch (e) {
          // 失败时要说清原因，否则用户看到的就是「点了没反应」
          message.error(t('lib.del.failed', { msg: (e as Error).message }))
          throw e // 让弹窗保持打开状态
        }
      },
    })
  }

  /** 批量删除：同样的二次确认与失败处理，只是逐条串行删除（沿用既有 deleteItem） */
  const handleBatchDelete = (targets: Item[]) => {
    if (targets.length === 0) return
    modal.confirm({
      icon: null,
      title: lt('sel.deleteTitle', { n: targets.length }),
      content: lt('sel.deleteBody'),
      okText: t('lib.del.ok'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: async () => {
        let done = 0
        try {
          for (const it of targets) {
            await deleteItem(it.id)
            done++
          }
          message.success(lt('sel.deleted', { n: done }))
        } catch (e) {
          message.error(lt('sel.deletedFailed', { msg: (e as Error).message }))
          throw e
        }
      },
    })
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
   * 但必填校验不能省：条目弹窗里有 required 规则，而这条内联路径直接落库，
   * 于是同一份数据有两个入口两套规则 —— 表格里能把必填字段清空并保存。
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
    // 用 message 报进度，中途失败要说清已经导了多少。
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

  /* —— 命令栏菜单 —— */
  const exportMenu: MenuProps = {
    items: [
      { key: 'csv', label: t('lib.importExport.exportCsv') },
      { key: 'excel', label: t('lib.importExport.exportExcel') },
    ],
    onClick: ({ key }) => ioRef.current?.exportAs(key as 'csv' | 'excel'),
  }

  // 更多菜单：窄屏与桌面都可用（桌面命令栏也有对应按钮，二者共用 ioRef）
  const moreMenu: MenuProps = {
    items: [
      { key: 'tpl', icon: <SettingsRegular fontSize={16} />, label: t('lib.menu.template'), onClick: () => setTemplateOpen(true) },
      { key: 'clone', icon: <CopyRegular fontSize={16} />, label: t('lib.menu.clone'), disabled: fields.length === 0, onClick: handleClone },
      { type: 'divider' },
      { key: 'imp', icon: <ArrowImportRegular fontSize={16} />, label: t('lib.menu.import'), onClick: () => ioRef.current?.openImport() },
      { key: 'csv', label: t('lib.menu.exportCsv'), onClick: () => ioRef.current?.exportAs('csv') },
      { key: 'xls', label: t('lib.menu.exportExcel'), onClick: () => ioRef.current?.exportAs('excel') },
    ],
  }

  /* —— 筛选 / 排序菜单 —— */
  const filterFieldMenu: MenuProps = {
    items: [
      { key: '__all', label: lt('filter.all') },
      { type: 'divider' },
      ...visibleFields.map((f) => ({ key: f.key, label: f.label })),
    ],
    selectable: true,
    selectedKeys: [filterField || '__all'],
    onClick: ({ key }) => {
      setFilterField(key === '__all' ? '' : key)
      setFilterValue('')
    },
  }

  const sortMenu: MenuProps = {
    items: [
      { key: '__none', label: lt('sort.none') },
      { type: 'divider' },
      ...visibleFields.map((f) => ({ key: f.key, label: f.label })),
    ],
    selectable: true,
    selectedKeys: [sortField || '__none'],
    onClick: ({ key }) => {
      if (key === '__none') {
        setSortField('')
        return
      }
      setSortField(key)
      setSortDesc(false)
    },
  }

  useBackButtonLayer(editorOpen, () => setEditorOpen(false))
  useBackButtonLayer(templateOpen, () => setTemplateOpen(false))
  useBackButtonLayer(cloneOpen, () => setCloneOpen(false))

  /* ────────────── 加载中：贴近最终布局的骨架，加载完成不位移 ────────────── */
  if (loading) {
    return (
      <div className="lib-page" aria-busy="true" aria-live="polite">
        <div className="lib-skeleton">
          <div className="lib-skeleton-cmd">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className="w-skeleton lib-skeleton-bar" style={{ width: i === 0 ? 120 : 88 }} />
            ))}
          </div>
          <div className="lib-skeleton-rows">
            {Array.from({ length: 8 }).map((_, i) => (
              <div className="lib-skeleton-row" key={i}>
                <span className="w-skeleton lib-skeleton-cell lib-skeleton-cell--sm" />
                <span className="w-skeleton lib-skeleton-cell lib-skeleton-cell--name" />
                <span className="w-skeleton lib-skeleton-cell lib-skeleton-cell--md" />
                <span className="w-skeleton lib-skeleton-cell lib-skeleton-cell--grow" />
                <span className="w-skeleton lib-skeleton-cell lib-skeleton-cell--md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ────────────── 库不存在 / 已删除：只给出口，不提供任何写入口 ────────────── */
  if (libMissing) {
    return (
      <div className="lib-page">
        <div className="lib-addrbar">
          <nav className="w-bcrumb" aria-label={t('app.home')}>
            <button type="button" className="w-bcrumb-item" onClick={() => navigate('/')}>
              <HomeRegular />
              {t('app.home')}
            </button>
          </nav>
        </div>
        <EmptyPanel
          icon={<WarningRegular />}
          title={t('lib.missing.title')}
          body={t('lib.missing.body')}
          action={
            <>
              <button type="button" className="w-btn w-btn--accent" onClick={() => navigate('/')}>
                {t('lib.missing.backHome')}
              </button>
              <button type="button" className="w-btn" onClick={() => navigate('/trash')}>
                {t('lib.missing.toTrash')}
              </button>
            </>
          }
        />
      </div>
    )
  }

  const isEmpty = processed.length === 0

  return (
    <div className="lib-page">
      {/* ══ 命令栏（44）══ */}
      <div className="lib-cmdbar" role="toolbar" aria-label={`${t('app.brand')} · ${lib?.name ?? t('lib.untitled')}`}>
        <button type="button" className="w-toolbar-btn w-toolbar-btn--primary" onClick={handleNew}>
          <AddRegular />
          <span>{t('lib.empty.cta')}</span>
        </button>
        <span className="lib-cmdbar-sep" role="presentation" />
        <button type="button" className="w-toolbar-btn lib-cmdbar-optional" onClick={() => ioRef.current?.openImport()}>
          <ArrowImportRegular />
          <span>{t('lib.importExport.import')}</span>
        </button>
        <Dropdown menu={exportMenu} trigger={['click']} placement="bottomLeft">
          <button type="button" className="w-toolbar-btn lib-cmdbar-optional">
            <ArrowExportUpRegular />
            <span>{t('lib.importExport.export')}</span>
          </button>
        </Dropdown>
        <span className="lib-cmdbar-sep lib-cmdbar-optional" role="presentation" />
        <button type="button" className="w-toolbar-btn lib-cmdbar-optional" onClick={() => setTemplateOpen(true)}>
          <SettingsRegular />
          <span>{t('lib.template')}</span>
        </button>
        <button
          type="button"
          className="w-toolbar-btn lib-cmdbar-optional"
          disabled={fields.length === 0}
          onClick={handleClone}
        >
          <CopyRegular />
          <span>{t('lib.clone')}</span>
        </button>
        <span className="lib-cmdbar-spacer" />
        <Dropdown menu={moreMenu} trigger={['click']} placement="bottomRight">
          <button
            type="button"
            className="w-toolbar-btn lib-cmdbar-icon"
            aria-label={t('common.more')}
            title={t('common.more')}
          >
            <MoreHorizontalRegular />
          </button>
        </Dropdown>
      </div>

      {/* ══ 地址条（32）══ */}
      <div className="lib-addrbar">
        <div className="lib-addr-nav">
          <button
            type="button"
            className="w-iconbtn"
            aria-label={lt('nav.back')}
            title={lt('nav.back')}
            disabled={!canGoBack}
            onClick={() => navigate(-1)}
          >
            <ArrowLeftRegular />
          </button>
          <button
            type="button"
            className="w-iconbtn"
            aria-label={lt('nav.up')}
            title={lt('nav.up')}
            onClick={() => navigate(lib?.parentId ? `/library/${lib.parentId}` : '/')}
          >
            <ArrowUpRegular />
          </button>
          <button type="button" className="w-iconbtn" aria-label={lt('nav.refresh')} title={lt('nav.refresh')} onClick={handleRefresh}>
            <ArrowClockwiseRegular />
          </button>
        </div>
        <nav className="w-bcrumb" aria-label={t('app.home')}>
          <button type="button" className="w-bcrumb-item" onClick={() => navigate('/')}>
            <HomeRegular />
            {t('app.home')}
          </button>
          {ancestors.map((a) => (
            <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <span className="w-bcrumb-sep" aria-hidden>
                <ChevronRightRegular />
              </span>
              <button type="button" className="w-bcrumb-item" onClick={() => navigate(`/library/${a.id}`)}>
                {a.name}
              </button>
            </span>
          ))}
          <span className="w-bcrumb-sep" aria-hidden>
            <ChevronRightRegular />
          </span>
          <span className="w-bcrumb-current" title={lib?.name ?? t('lib.untitled')}>
            <FolderRegular style={{ color: 'var(--w-accent)', fontSize: 14 }} />
            {lib?.name ?? t('lib.untitled')}
          </span>
        </nav>
        {lib?.category ? (
          <span className="lib-addr-meta" title={lib.category}>
            {lib.category}
          </span>
        ) : null}
      </div>

      {/* ══ 筛选行：搜索 / 字段筛选 / 排序 / 清除 ══ */}
      <div className="lib-filterbar" role="search">
        <label className="w-search lib-search">
          <SearchRegular />
          <input
            ref={searchRef}
            className="w-search-input"
            type="search"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder={t('lib.searchPlaceholder')}
            aria-label={lt('search.hint')}
          />
          {keywordInput ? (
            <button
              type="button"
              className="w-iconbtn w-iconbtn--sm"
              aria-label={lt('search.clear')}
              title={lt('search.clear')}
              onClick={() => setKeywordInput('')}
              style={{ marginRight: -4 }}
            >
              <DismissRegular />
            </button>
          ) : null}
        </label>

        <Dropdown menu={filterFieldMenu} trigger={['click']} placement="bottomLeft">
          <button type="button" className={`w-chip${filterField ? ' is-set' : ''}`} aria-label={t('lib.filterField')}>
            <FilterRegular />
            <span className="lib-filter-chip-text">
              {filterField ? visibleFields.find((f) => f.key === filterField)?.label ?? t('lib.filterField') : t('lib.filterField')}
            </span>
            <ChevronDownRegular style={{ fontSize: 11 }} />
          </button>
        </Dropdown>
        {filterField ? (
          <input
            className="lib-filter-value"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder={t('lib.filterValue')}
            aria-label={t('lib.filterValue')}
          />
        ) : null}

        <Dropdown menu={sortMenu} trigger={['click']} placement="bottomLeft">
          <button type="button" className={`w-chip${sortField ? ' is-set' : ''}`} aria-label={t('lib.sort')}>
            <ArrowSortRegular />
            <span className="lib-filter-chip-text">
              {sortField ? visibleFields.find((f) => f.key === sortField)?.label ?? t('lib.sort') : t('lib.sort')}
            </span>
            <ChevronDownRegular style={{ fontSize: 11 }} />
          </button>
        </Dropdown>
        {sortField ? (
          <button
            type="button"
            className="w-chip"
            aria-label={sortDesc ? t('lib.desc') : t('lib.asc')}
            title={sortDesc ? t('lib.desc') : t('lib.asc')}
            onClick={() => setSortDesc((v) => !v)}
          >
            {sortDesc ? <ArrowSortDownRegular /> : <ArrowSortUpRegular />}
            <span>{sortDesc ? t('lib.desc') : t('lib.asc')}</span>
          </button>
        ) : null}
        {hasFilters ? (
          <button type="button" className="w-btn w-btn--sm w-btn--subtle" onClick={clearFilters}>
            <DismissRegular />
            {t('lib.clear')}
          </button>
        ) : null}

        <span className="lib-filter-spacer" />
        {hasFilters ? (
          <span className="lib-filter-meta lib-filter-meta--desktop">
            {processed.length} / {items.length}
          </span>
        ) : null}
        <span className="lib-filter-meta lib-filter-meta--mobile">{lt('status.total', { n: processed.length })}</span>
      </div>

      {/* ══ 主体：表格或空态 ══ */}
      {isEmpty ? (
        <div className="lib-body">
          {items.length === 0 && fields.length === 0 ? (
            // 一个字段都没有时，「新建条目」是无效动作——先去配模板
            <EmptyPanel
              icon={<TableRegular />}
              title={t('lib.empty.noFields.title')}
              body={t('lib.empty.noFields.body')}
              action={
                <button type="button" className="w-btn w-btn--accent" onClick={() => setTemplateOpen(true)}>
                  {t('lib.empty.noFields.cta')}
                </button>
              }
            />
          ) : items.length === 0 ? (
            // 首次使用：空状态说清「这里将来会放什么」，并给新建 + 导入两个出口
            <EmptyPanel
              icon={<FolderRegular />}
              title={t('lib.empty.none.title')}
              body={
                <>
                  {t('lib.empty.none.body', { name: lib?.name ?? t('lib.untitled') })}
                  <span style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--w-text-3)' }}>
                    {t('lib.empty.none.hint')}
                  </span>
                </>
              }
              action={
                <>
                  <button type="button" className="w-btn w-btn--accent" onClick={handleNew}>
                    {t('lib.empty.cta')}
                  </button>
                  <button type="button" className="w-btn" onClick={() => ioRef.current?.openImport()}>
                    {t('lib.importExport.import')}
                  </button>
                </>
              }
            />
          ) : (
            // 筛选无结果：给出退路，而不是死路
            <EmptyPanel
              icon={<SearchRegular />}
              title={t('lib.empty.noMatch.title')}
              body={t('lib.empty.noMatch.body')}
              action={
                <>
                  <button type="button" className="w-btn" onClick={clearFilters}>
                    {t('lib.clear')}
                  </button>
                  <span className="lib-filter-meta">{t('lib.total', { n: items.length })}</span>
                </>
              }
            />
          )}
          <div className="lib-statusbar">
            <div className="lib-status-group">
              <span className="lib-status-strong">{lt('status.total', { n: items.length })}</span>
            </div>
            <span className="lib-status-spacer" />
            <span className="lib-status-group">{lt('view.details')}</span>
          </div>
        </div>
      ) : (
        <LibraryTable
          fields={fields}
          items={processed}
          focusItemId={focusItemId}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onPin={(item, pinned) => {
            pinItem(item.id, pinned).catch((e) => message.error(tNow('app.loadLibFailed', { msg: (e as Error).message })))
          }}
          onPatch={handlePatch}
          sortField={sortField}
          sortDesc={sortDesc}
          onToggleSort={handleToggleSort}
          onBatchDelete={handleBatchDelete}
          onBatchPin={handleBatchPin}
        />
      )}

      {/* ImportExport 必须始终挂载：命令栏按钮与「更多」菜单都通过 ioRef
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

      {/* 字段模板复用（ContentDialog） */}
      <Modal
        title={t('lib.clone.modalTitle')}
        open={cloneOpen}
        onCancel={() => setCloneOpen(false)}
        onOk={confirmClone}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        width={480}
        centered
        style={{ maxWidth: 'calc(100vw - 24px)', top: 0 }}
        destroyOnHidden
      >
        <p className="lib-dialog-sub" style={{ marginTop: 4 }}>{t('lib.clone.pick')}</p>
        <Select
          mode="multiple"
          placeholder={t('lib.clone.placeholder')}
          style={{ width: '100%' }}
          value={cloneTargets}
          onChange={setCloneTargets}
          options={cloneTargetsOptions.map((l) => ({ label: l.name, value: l.id }))}
        />
      </Modal>
    </div>
  )
}
