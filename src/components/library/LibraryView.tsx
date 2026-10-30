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
import { Button, Input, Select, App, Modal, Dropdown, Grid } from 'antd'
import type { MenuProps } from 'antd'
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
import { usePagePadding } from './pageFrame'

/**
 * 空状态：一句话（衬线 20）+ 说明 + 一个动作。
 * 结构照 Lead 给的 `.empty-state / -title / -body / -actions`，
 * 不再用 antd <Empty> 的自带插画（那是模板脸，也是一张图占半屏）。
 */
function EmptyBlock({ title, body, actions }: { title: React.ReactNode; body?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="empty-state" style={{ padding: '48px 16px', textAlign: 'center' }}>
      <div className="empty-state-title">{title}</div>
      {body ? (
        <div className="empty-state-body" style={{ maxWidth: 440, margin: '6px auto 0' }}>{body}</div>
      ) : null}
      {actions ? (
        <div className="empty-state-actions" style={{ justifyContent: 'center' }}>{actions}</div>
      ) : null}
    </div>
  )
}

export default function LibraryView() {
  const { id } = useParams()
  const { message, modal } = App.useApp()
  const pad = usePagePadding()
  const narrow = !Grid.useBreakpoint().md
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
      // 文案带上原因，表格里才有「错误文字」可显示（原来只抛一个 sentinel）。
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

  // 导出菜单：文字项，无图标（工具栏图标只做辅助，文字优先）
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

  // 加载中：骨架屏而不是一行字。之前是 `if (loading) return <div>加载中</div>`，
  // 整个表格区域塌成一行文字，然后又整块跳出来，页面高度还会二次抖动。
  if (loading) {
    return (
      <div style={{ ...pad, height: '100%' }}>
        <PageSkeleton rows={8} />
      </div>
    )
  }


  // 库不存在/已删除：只给「回到首页 / 去回收站」两个出口，不提供任何写入口
  if (libMissing) {
    return (
      <div style={{ ...pad }}>
        <EmptyBlock
          title={t('lib.missing.title')}
          body={t('lib.missing.body')}
          actions={
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
    <div style={{ ...pad, height: '100%' }}>
      {/* 页面头：26px 衬线标题是每页唯一的大标题；右侧 12px mono 计数。
          不套 Card——「卡片里再套卡片」会让界面多出两层边框，
          研究结论是「需要描边的话，多半是需要更多留白」。 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          minHeight: 40,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, minWidth: 0, flexWrap: 'wrap' }}>
          <h1
            className="page-title"
            title={lib?.name ?? t('lib.untitled')}
            style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {lib?.name ?? t('lib.untitled')}
          </h1>
          {lib?.category && <span className="eyebrow">{lib.category}</span>}
          <span className="faint" style={{ fontSize: 'var(--text-xs)' }}>
            <span className="mono num">{items.length}</span> {t('lib.count.unit')}
          </span>
        </div>
      </div>

      {/* 工具栏压成一行 32px：左筛选/排序，右模板/复用/导入/导出/新建。
          行为与原来完全一致（搜索防抖、筛选、排序、复用、导入导出入口）。 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          minHeight: 32,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0 }}>
          {/* 还没有字段时，搜索/筛选/排序全是无效控件（选项为空），只留空状态引导去配模板 */}
          {fields.length > 0 && (
            <>
              <Input
                placeholder={t('lib.searchPlaceholder')}
                allowClear
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                style={{ width: 200, flex: '0 1 200px' }}
              />
              <Select
                placeholder={t('lib.filterField')}
                value={filterField || undefined}
                onChange={(v) => setFilterField(v ?? '')}
                allowClear
                style={{ width: 132 }}
                options={visibleFields.map((f) => ({ label: f.label, value: f.key }))}
              />
              {filterField && (
                <Input
                  placeholder={t('lib.filterValue')}
                  allowClear
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  style={{ width: 132 }}
                />
              )}
              <Select
                placeholder={t('lib.sort')}
                value={sortField || undefined}
                onChange={(v) => setSortField(v ?? '')}
                allowClear
                style={{ width: 132 }}
                options={visibleFields.map((f) => ({ label: f.label, value: f.key }))}
              />
              {sortField && (
                // 方向用文字按钮而不是 Switch：账页上不做彩色开关，升/降序写出来更清楚
                <Button type="text" size="small" onClick={() => setSortDesc((v) => !v)}>
                  {sortDesc ? t('lib.desc') : t('lib.asc')}
                </Button>
              )}
              {hasFilters && (
                <Button type="text" size="small" onClick={clearFilters}>{t('lib.clear')}</Button>
              )}
            </>
          )}
        </div>

        {/* 「新建」是这页唯一的主操作，墨色实心；其余工具一律降级为文字项——
            五个等权重图标按钮排排坐是后台模板的指纹。
            窄屏收进一个「⋯」，避免按钮在手机上折成三行、挤掉数据区。 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {narrow ? (
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'tpl', label: t('lib.menu.template'), onClick: () => setTemplateOpen(true) },
                  { key: 'clone', label: t('lib.menu.clone'), disabled: fields.length === 0, onClick: handleClone },
                  { type: 'divider' },
                  { key: 'imp', label: t('lib.menu.import'), onClick: () => ioRef.current?.openImport() },
                  { key: 'csv', label: t('lib.menu.exportCsv'), onClick: () => ioRef.current?.exportAs('csv') },
                  { key: 'xls', label: t('lib.menu.exportExcel'), onClick: () => ioRef.current?.exportAs('excel') },
                ],
              }}
            >
              <Button aria-label={t('lib.menu.more')} className="tap">
                {t('lib.menu.more')}
              </Button>
            </Dropdown>
          ) : (
            <>
              <Button type="text" onClick={() => setTemplateOpen(true)}>
                {t('lib.template')}
              </Button>
              <Button type="text" onClick={handleClone} disabled={fields.length === 0}>
                {t('lib.clone')}
              </Button>
              <Button type="text" onClick={() => ioRef.current?.openImport()}>
                {t('lib.importExport.import')}
              </Button>
              <Dropdown menu={exportMenu}>
                <Button type="text">{t('lib.importExport.export')}</Button>
              </Dropdown>
            </>
          )}
          <Button type="primary" onClick={handleNew}>
            {t('lib.new')}
          </Button>
        </div>
      </div>

      {/* ImportExport 必须始终挂载：桌面按钮与窄屏「⋯」菜单都通过 ioRef
          命令式触发该实例的上传框 / Blob 下载；卸载后 ref 为 null，入口会静默失效。
          所以它的两个可见按钮藏起来，只保留 hidden 常驻实例。 */}
      <div hidden>
        <ImportExport ref={ioRef} fields={fields} items={items} onImport={handleImport} />
      </div>

      {processed.length === 0 ? (
        <div>
          {items.length === 0 && fields.length === 0 ? (
            // 一个字段都没有时，「新建条目」是无效动作——先去配模板
            <EmptyBlock
              title={t('lib.empty.noFields.title')}
              body={t('lib.empty.noFields.body')}
              actions={
                <Button type="primary" onClick={() => setTemplateOpen(true)}>
                  {t('lib.empty.noFields.cta')}
                </Button>
              }
            />
          ) : items.length === 0 ? (
            // 首次使用：空状态是这里最好的新手引导位，要说清「这里将来会放什么」
            <EmptyBlock
              title={t('lib.empty.none.title')}
              body={
                <>
                  {t('lib.empty.none.body', { name: lib?.name ?? t('lib.untitled') })}
                  <div className="faint" style={{ fontSize: 'var(--text-xs)', marginTop: 6 }}>
                    {t('lib.empty.none.hint')}
                  </div>
                </>
              }
              actions={
                <Button type="primary" onClick={handleNew}>
                  {t('lib.empty.cta')}
                </Button>
              }
            />
          ) : (
            // 筛选无结果：给出退路，而不是死路
            <EmptyBlock
              title={t('lib.empty.noMatch.title')}
              body={t('lib.empty.noMatch.body')}
              actions={
                <>
                  <Button onClick={clearFilters}>{t('lib.clear')}</Button>
                  <span className="faint" style={{ fontSize: 'var(--text-xs)' }}>
                    <span className="mono num">{items.length}</span> {t('lib.count.unit')}
                  </span>
                </>
              }
            />
          )}
        </div>
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
      >
        <p className="muted" style={{ marginBottom: 12 }}>{t('lib.clone.pick')}</p>
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
