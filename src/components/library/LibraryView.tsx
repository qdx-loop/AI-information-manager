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
import { Button, Input, Select, App, Modal, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import {
  SearchOutlined,
  SettingOutlined,
  ImportOutlined,
  ExportOutlined,
  CopyOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@/components/common/icons'
import { useLibraryStore } from '@/store/libraryStore'
import LibraryTable from './LibraryTable'
import ItemEditor from './ItemEditor'
import TemplateEditor from './TemplateEditor'
import ImportExport, { type ImportExportHandle } from './ImportExport'
import type { Item, FieldValue } from '@/types'
import { useI18n, tNow } from '@/i18n'
import { track } from '@/utils/track'

import { useBackButtonLayer } from '@/utils/backButton'
import { isBlankFieldValue } from '@/utils/fieldValue'
import PageSkeleton from '@/components/common/PageSkeleton'
import EmptyPanel from './EmptyPanel'

export default function LibraryView() {
  const { id } = useParams()
  const { message, modal } = App.useApp()
  const ioRef = useRef<ImportExportHandle>(null)
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
   * 之前这里只把 `lib` 当成 undefined 继续渲染：标题显示「未命名管理库」、
   * 总数 0，还照常显示「新建条目」—— 点下去会把数据写进一个已软删的库，
   * 用户在回收站里也永远看不到。要挡住所有写入口并给出明确出口。
   */
  // 必须同时满足「已经加载过库列表」才谈得上不存在。
  // 否则冷启动第一帧 libraries 还是空的，会闪出假报错。
  const libMissing = libsReady && !loading && !lib

  // 搜索 + 筛选 + 排序
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

  const handleNew = () => {
    if (fields.length === 0) {
      modal.warning({
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
          // 之前没有 catch：失败时 antd 只把按钮复位，没有任何提示，
          // 用户看到的就是「点了没反应」
          message.error(t('lib.del.failed', { msg: (e as Error).message }))
          throw e // 让弹窗保持打开状态
        }
      },
    })
  }

  /**
   * 表格内联编辑落库。
   *
   * 刻意不弹成功 toast：连续录入时 toast 会盖住正在编辑的单元格。
   *
   * 但必填校验不能省。条目弹窗里有 `rules={[{required:true}]}`，
   * 而这条内联路径直接落库，于是同一份数据有两个入口两套规则：
   * 用户可以在表格里把「客户名称」清空并保存，弹窗却不让这么干。
   * 清空之后表格里那一格显示「（无内容）」，而库模板要求的字段没了。
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

  // 更多菜单：窄屏与桌面都可用（桌面工具栏也有对应按钮，二者共用 ioRef）
  const moreMenu: MenuProps = {
    items: [
      { key: 'tpl', icon: <SettingOutlined />, label: t('lib.menu.template'), onClick: () => setTemplateOpen(true) },
      { key: 'clone', icon: <CopyOutlined />, label: t('lib.menu.clone'), disabled: fields.length === 0, onClick: handleClone },
      { type: 'divider' },
      { key: 'imp', icon: <ImportOutlined />, label: t('lib.menu.import'), onClick: () => ioRef.current?.openImport() },
      { key: 'csv', label: t('lib.menu.exportCsv'), onClick: () => ioRef.current?.exportAs('csv') },
      { key: 'xls', label: t('lib.menu.exportExcel'), onClick: () => ioRef.current?.exportAs('excel') },
    ],
  }

  // 导出菜单：文字项，与「导入」并列在数据组
  const exportMenu: MenuProps = {
    items: [
      { key: 'csv', label: t('lib.importExport.exportCsv') },
      { key: 'excel', label: t('lib.importExport.exportExcel') },
    ],
    onClick: ({ key }) => ioRef.current?.exportAs(key as 'csv' | 'excel'),
  }

  useBackButtonLayer(editorOpen, () => setEditorOpen(false))
  useBackButtonLayer(templateOpen, () => setTemplateOpen(false))
  useBackButtonLayer(cloneOpen, () => setCloneOpen(false))

  // 加载中：骨架屏而不是一行字 —— 骨架贴近最终布局，加载完成时不会位移。
  if (loading) {
    return (
      <div className="workbench">
        <div className="panel">
          <div className="panel-body"><PageSkeleton rows={8} /></div>
        </div>
      </div>
    )
  }


  // 库不存在/已删除：只给「回到首页 / 去回收站」两个出口，不提供任何写入口
  if (libMissing) {
    return (
      <div className="workbench">
        <EmptyPanel
          title={t('lib.missing.title')}
          body={t('lib.missing.body')}
          action={
            <>
              <Button type="primary" onClick={() => navigate('/')}>
                {t('lib.missing.backHome')}
              </Button>
              <Button onClick={() => navigate('/trash')}>{t('lib.missing.toTrash')}</Button>
            </>
          }
        />
      </div>
    )
  }

  return (
    <div className="workbench">
      {/* 页头：kicker LIBRARY / 库 + 库名 40/800 + count-chip + 更多 */}
      <div className="page-head">
        <div className="page-head-main">
          <div className="page-kicker">{t('lib.kicker')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
            <h1
              className="page-title"
              title={lib?.name ?? t('lib.untitled')}
              style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {lib?.name ?? t('lib.untitled')}
            </h1>
            <span className="count-chip">
              {items.length} {t('lib.count.unit')}
            </span>
            {lib?.category && <span className="tag-mono">{lib.category}</span>}
          </div>
        </div>
        <div className="page-head-actions">
          <Dropdown menu={moreMenu} trigger={['click']}>
            <Button icon={<MoreOutlined />} aria-label={t('lib.menu.more')}>
              {t('common.more')}
            </Button>
          </Dropdown>
        </div>
      </div>
      <div className="page-bar" />

      {/* 工具条：一行 40，三组（视图 / 数据 / 动作） */}
      <div className="toolbar">
        <div className="toolbar-group">
          {fields.length > 0 && (
            <>
              <Input
                prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                placeholder={t('lib.searchPlaceholder')}
                allowClear
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                style={{ width: 240 }}
              />
              <Select
                placeholder={t('lib.filterField')}
                value={filterField || undefined}
                onChange={(v) => setFilterField(v ?? '')}
                allowClear
                style={{ width: 148 }}
                options={visibleFields.map((f) => ({ label: f.label, value: f.key }))}
              />
              {filterField && (
                <Input
                  placeholder={t('lib.filterValue')}
                  allowClear
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  style={{ width: 148 }}
                />
              )}
              <Select
                placeholder={t('lib.sort')}
                value={sortField || undefined}
                onChange={(v) => setSortField(v ?? '')}
                allowClear
                style={{ width: 148 }}
                options={visibleFields.map((f) => ({ label: f.label, value: f.key }))}
              />
              {sortField && (
                <Button type="text" onClick={() => setSortDesc((v) => !v)}>
                  {sortDesc ? t('lib.desc') : t('lib.asc')}
                </Button>
              )}
              {hasFilters && (
                <Button type="text" onClick={clearFilters}>{t('lib.clear')}</Button>
              )}
            </>
          )}
        </div>

        <span className="toolbar-spacer" />

        <div className="toolbar-group">
          {/* 数据组：模板 / 复用 / 导入 / 导出；文字优先，图标辅助 */}
          <Button icon={<SettingOutlined />} onClick={() => setTemplateOpen(true)}>{t('lib.template')}</Button>
          <Button icon={<CopyOutlined />} onClick={handleClone} disabled={fields.length === 0}>{t('lib.clone')}</Button>
          <Button icon={<ImportOutlined />} onClick={() => ioRef.current?.openImport()}>{t('lib.importExport.import')}</Button>
          <Dropdown menu={exportMenu}>
            <Button icon={<ExportOutlined />}>{t('lib.importExport.export')}</Button>
          </Dropdown>
        </div>

        <div className="toolbar-group">
          <Button type="primary" icon={<PlusOutlined />} onClick={handleNew}>{t('lib.new')}</Button>
        </div>
      </div>

      {/* ImportExport 必须始终挂载：桌面按钮与「更多」菜单都通过 ioRef
          命令式触发该实例的上传框 / Blob 下载；卸载后 ref 为 null，入口会静默失效。 */}
      <div hidden>
        <ImportExport ref={ioRef} fields={fields} items={items} onImport={handleImport} />
      </div>

      {processed.length === 0 ? (
        <>
          {items.length === 0 && fields.length === 0 ? (
            // 一个字段都没有时，「新建条目」是无效动作——先去配模板
            <EmptyPanel
              title={t('lib.empty.noFields.title')}
              body={t('lib.empty.noFields.body')}
              action={
                <Button type="primary" onClick={() => setTemplateOpen(true)}>
                  {t('lib.empty.noFields.cta')}
                </Button>
              }
            />
          ) : items.length === 0 ? (
            // 首次使用：空状态说清「这里将来会放什么」，并给新建 + 导入两个出口
            <EmptyPanel
              title={t('lib.empty.none.title')}
              body={
                <>
                  {t('lib.empty.none.body', { name: lib?.name ?? t('lib.untitled') })}
                  <span className="field-hint" style={{ display: 'block', marginTop: 6 }}>
                    {t('lib.empty.none.hint')}
                  </span>
                </>
              }
              action={
                <>
                  <Button type="primary" onClick={handleNew}>{t('lib.empty.cta')}</Button>
                  <Button onClick={() => ioRef.current?.openImport()}>{t('lib.importExport.import')}</Button>
                </>
              }
            />
          ) : (
            // 筛选无结果：给出退路，而不是死路
            <EmptyPanel
              title={t('lib.empty.noMatch.title')}
              body={t('lib.empty.noMatch.body')}
              action={
                <>
                  <Button onClick={clearFilters}>{t('lib.clear')}</Button>
                  <span className="table-count">{t('lib.total', { n: items.length })}</span>
                </>
              }
            />
          )}
        </>
      ) : (
        <LibraryTable
          fields={fields}
          items={processed}
          focusItemId={focusItemId}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onPin={(item, pinned) => pinItem(item.id, pinned)}
          onPatch={handlePatch}
        />
      )}

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
      <Modal
        title={t('lib.clone.modalTitle')}
        open={cloneOpen}
        onCancel={() => setCloneOpen(false)}
        onOk={confirmClone}
        okText={t('common.confirm')}
      >
        <p className="page-sub" style={{ marginBottom: 12 }}>{t('lib.clone.pick')}</p>
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
