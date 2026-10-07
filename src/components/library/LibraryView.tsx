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
import {
  Button,
  Input,
  Select,
  Space,
  Card,
  Typography,
  Tag,
  App,
  Empty,
  Switch,
  Modal,
  Dropdown,
  Grid,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  ImportOutlined,
  CopyOutlined,
  MoreOutlined,
  FileTextOutlined,
  FileExcelOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons'
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

const { Title, Text } = Typography

export default function LibraryView() {
  const { id } = useParams()
  const { message, modal } = App.useApp()
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
   * 但必填校验不能省。条目弹窗里有 `rules={[{required:true}]`，
   * 而这条内联路径直接落库，于是同一份数据有两个入口两套规则：
   * 用户可以在表格里把「客户名称」清空并保存，弹窗却不让这么干。
   * 清空之后表格里那一格显示「（无内容）」，而库模板要求的字段没了。
   */
  const handlePatch = async (item: Item, nextFields: Item['fields']) => {
    const missing = fields.filter((f) => f.required && isBlankFieldValue(nextFields[f.key]))
    if (missing.length > 0) {
      message.error(t('lib.patch.requiredMissing', { names: missing.map((f) => f.label).join('、') }))
      // 抛出去让 LibraryTable 留在编辑态：用户能看到没保存成，并能改回来
      throw new Error('required-field-missing')
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

  useBackButtonLayer(editorOpen, () => setEditorOpen(false))
  useBackButtonLayer(templateOpen, () => setTemplateOpen(false))
  useBackButtonLayer(cloneOpen, () => setCloneOpen(false))

  // 加载中：骨架屏而不是一行字。之前是 `if (loading) return <div>加载中</div>`，
  // 整个表格区域塌成一行文字，然后又整块跳出来，页面高度还会二次抖动。
  if (loading) {
    return (
      <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
        <PageSkeleton rows={8} />
      </div>
    )
  }


  // 库不存在/已删除：只给「回到首页 / 去回收站」两个出口，不提供任何写入口
  if (libMissing) {
    return (
      <div style={{ padding: '48px 16px' }}>
        <Card>
          <Empty
            image={<FolderOpenOutlined style={{ fontSize: 44, color: 'var(--app-ink-faint)' }} />}
            description={
              <div style={{ maxWidth: 400, margin: '0 auto' }}>
                <div style={{ fontWeight: 600, color: 'var(--app-ink)', marginBottom: 6 }}>
                  {t('lib.missing.title')}
                </div>
                <div style={{ color: 'var(--app-ink-soft)', lineHeight: 1.75, marginBottom: 16 }}>
                  {t('lib.missing.body')}
                </div>
                <Space>
                  <Button type="primary" onClick={() => navigate('/')}>
                    {t('lib.missing.backHome')}
                  </Button>
                  <Button onClick={() => navigate('/trash')}>{t('lib.missing.toTrash')}</Button>
                </Space>
              </div>
            }
          />
        </Card>
      </div>
    )
  }

  return (
    <div style={{ padding: 16, height: '100%' }}>
      {/* 页面头：不再套一层 Card。原来的「卡片里再套卡片」让界面多出两层边框，
          研究结论是「需要描边的话，多半是需要更多留白」——用留白分层即可。 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Space wrap size={8} style={{ minWidth: 0 }}>
          <Title level={4} style={{ margin: 0, fontSize: 19 }}>
            {lib?.name ?? t('lib.untitled')}
          </Title>
          {lib?.category && <Tag color="teal">{lib.category}</Tag>}
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('lib.total', { n: items.length })}
          </Text>
        </Space>

        {/* 「新建」是这页唯一的主操作。桌面端把工具按钮平铺（便于发现），
            窄屏收进一个「⋯」，避免五个按钮在手机上折成三行、挤掉数据区。
            对应飞书多维表格「搭建与使用分离」：设置项不与主流程并排争夺注意力。 */}
        <Space size={8} wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleNew}>
            {t('lib.new')}
          </Button>
          {narrow ? (
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'tpl', icon: <SettingOutlined />, label: t('lib.menu.template'), onClick: () => setTemplateOpen(true) },
                  { key: 'clone', icon: <CopyOutlined />, label: t('lib.menu.clone'), disabled: fields.length === 0, onClick: handleClone },
                  { type: 'divider' },
                  { key: 'imp', icon: <ImportOutlined />, label: t('lib.menu.import'), onClick: () => ioRef.current?.openImport() },
                  { key: 'csv', icon: <FileTextOutlined />, label: t('lib.menu.exportCsv'), onClick: () => ioRef.current?.exportAs('csv') },
                  { key: 'xls', icon: <FileExcelOutlined />, label: t('lib.menu.exportExcel'), onClick: () => ioRef.current?.exportAs('excel') },
                ],
              }}
            >
              <Button icon={<MoreOutlined />} aria-label={t('lib.menu.more')} className="tap" />
            </Dropdown>
          ) : (
            <>
              <Button icon={<SettingOutlined />} onClick={() => setTemplateOpen(true)}>
                {t('lib.template')}
              </Button>
              <Button icon={<CopyOutlined />} onClick={handleClone} disabled={fields.length === 0}>
                {t('lib.clone')}
              </Button>
              <ImportExport ref={ioRef} fields={fields} items={items} onImport={handleImport} />
            </>
          )}
          {/* 窄屏把工具收进「⋯」菜单，但 ImportExport 必须始终挂载：
              菜单里的导入 / 导出 CSV / 导出 Excel 通过 ioRef 命令式触发该实例的
              上传框与 Blob 下载，卸载后 ref 为 null，菜单会静默失效。 */}
          {narrow && (
            <div hidden>
              <ImportExport ref={ioRef} fields={fields} items={items} onImport={handleImport} />
            </div>
          )}
        </Space>
      </div>

      <Card styles={{ body: { padding: 12 } }}>
        {/* 还没有字段时，搜索/筛选/排序全是无效控件（选项为空），只留空状态引导去配模板 */}
        {fields.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t('lib.searchPlaceholder')}
            allowClear
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            style={{ width: '100%', marginBottom: 4 }}
          />
          <Select
            placeholder={t('lib.filterField')}
            value={filterField || undefined}
            onChange={(v) => setFilterField(v ?? '')}
            allowClear
            style={{ flex: 1, minWidth: 120 }}
            options={visibleFields.map((f) => ({ label: f.label, value: f.key }))}
          />
          {filterField && (
            <Input
              placeholder={t('lib.filterValue')}
              allowClear
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              style={{ flex: 1, minWidth: 120 }}
            />
          )}
          <Select
            placeholder={t('lib.sort')}
            value={sortField || undefined}
            onChange={(v) => setSortField(v ?? '')}
            allowClear
            style={{ flex: 1, minWidth: 120 }}
            options={visibleFields.map((f) => ({ label: f.label, value: f.key }))}
          />
          {sortField && (
            <Switch
              checkedChildren={t('lib.desc')}
              unCheckedChildren={t('lib.asc')}
              checked={sortDesc}
              onChange={setSortDesc}
            />
          )}
          <Button type="link" onClick={() => { setKeywordInput(''); setFilterField(''); setFilterValue(''); setSortField('') }}>{t('lib.clear')}
          </Button>
        </div>
        )}

        {processed.length === 0 ? (
          <div style={{ padding: '32px 16px 40px' }}>
            {items.length === 0 && fields.length === 0 ? (
              // 一个字段都没有时，「新建条目」是无效动作——先去配模板
              <Empty
                image={<SettingOutlined style={{ fontSize: 44, color: 'var(--app-ink-faint)' }} />}
                description={
                  <span style={{ display: 'block', maxWidth: 380, margin: '0 auto' }}>
                    <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--ant-color-text)' }}>
                      {t('lib.empty.noFields.title')}
                    </span>
                    {t('lib.empty.noFields.body')}
                  </span>
                }
              >
                <Button type="primary" icon={<SettingOutlined />} onClick={() => setTemplateOpen(true)}>
                  {t('lib.empty.noFields.cta')}
                </Button>
              </Empty>
            ) : items.length === 0 ? (
              // 首次使用：空状态是这里最好的新手引导位，要说清「这里将来会放什么」
              <Empty
                image={<PlusOutlined style={{ fontSize: 44, color: 'var(--app-ink-faint)' }} />}
                description={
                  <span style={{ display: 'block', maxWidth: 400, margin: '0 auto' }}>
                    <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--ant-color-text)' }}>
                      {t('lib.empty.none.title')}
                    </span>
                    {t('lib.empty.none.body', { name: lib?.name ?? t('lib.untitled') })}
                  </span>
                }
              >
                <Space direction="vertical" size={10} style={{ alignItems: 'center' }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleNew}>
                    {t('lib.empty.cta')}
                  </Button>
                  <Text type="secondary" style={{ fontSize: 12.5 }}>
                    {t('lib.empty.none.hint')}
                  </Text>
                </Space>
              </Empty>
            ) : (
              // 筛选无结果：给出退路，而不是死路
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span style={{ display: 'block', maxWidth: 380, margin: '0 auto' }}>
                    <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--ant-color-text)' }}>
                      {t('lib.empty.noMatch.title')}
                    </span>
                    {t('lib.empty.noMatch.body')}
                  </span>
                }
              >
                <Space direction="vertical" size={10} style={{ alignItems: 'center' }}>
                  <Button
                    onClick={() => { setKeywordInput(''); setFilterField(''); setFilterValue(''); setSortField('') }}
                  >
                    {t('lib.clear')}
                  </Button>
                  <Text type="secondary" style={{ fontSize: 12.5 }}>
                    {t('lib.total', { n: items.length })}
                  </Text>
                </Space>
              </Empty>
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
      </Card>

      <ItemEditor
        open={editorOpen}
        fields={fields}
        item={editing}
        onCancel={() => {
          setEditorOpen(false)
          setEditing(null)
        }}
        onSave={handleSave}
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
        <p style={{ color: 'var(--ant-color-text-secondary)', marginBottom: 12 }}>{t('lib.clone.pick')}</p>
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
