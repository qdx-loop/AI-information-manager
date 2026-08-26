import { useState, useMemo, useEffect } from 'react'

// 输入防抖：大数据量下每键击全量过滤会卡顿
function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
import { useParams } from 'react-router-dom'
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
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  ImportOutlined,
} from '@ant-design/icons'
import { useLibraryStore } from '@/store/libraryStore'
import LibraryTable from './LibraryTable'
import ItemEditor from './ItemEditor'
import TemplateEditor from './TemplateEditor'
import ImportExport from './ImportExport'
import type { Item, FieldValue } from '@/types'
import { useI18n } from '@/i18n'
import { track } from '@/utils/track'

const { Title, Text } = Typography

export default function LibraryView() {
  const { id } = useParams()
  const { message, modal } = App.useApp()
  const {
    libraries,
    currentLibraryId,
    fields,
    items,
    focusItemId,
    loading,
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
      selectLibrary(id).catch((e) => message.error(t('app.loadLibFailed', { msg: (e as Error).message })))
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
  const [sortDesc, setSortDesc] = useState(false)

  const lib = libraries.find((l) => l.id === id)

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
      await updateItem({ ...editing, fields: values })
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
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        await deleteItem(item.id)
        message.success(t('lib.del.done'))
      },
    })
  }

  const handleImport = async (rows: Record<string, FieldValue>[]) => {
    for (const r of rows) {
      await createItem(r)
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

  if (loading) return <div style={{ padding: 24 }}>{t('lib.view.loading')}</div>

  return (
    <div style={{ padding: 16, height: '100%' }}>
      <Card
        styles={{ body: { padding: 16 } }}
        style={{ marginBottom: 12 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Title level={4} style={{ margin: 0 }}>
              {lib?.name ?? '管理库'}
            </Title>
            {lib && <Tag color="green">{lib.category}</Tag>}
            <Text type="secondary">{t('common.totalItems', { n: items.length })}</Text>
          </Space>
          <Space wrap size="small">
            <Button icon={<PlusOutlined />} type="primary" onClick={handleNew}>{t('lib.new')}</Button>
            <Button icon={<SettingOutlined />} onClick={() => setTemplateOpen(true)}>{t('lib.template')}</Button>
            <Button icon={<ImportOutlined />} onClick={handleClone} disabled={fields.length === 0}>{t('lib.clone')}
            </Button>
            <ImportExport fields={fields} items={items} onImport={handleImport} />
          </Space>
        </div>
      </Card>

      <Card styles={{ body: { padding: 12 } }}>
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

        {processed.length === 0 ? (
          <Empty description={items.length === 0 ? t('lib.empty.none') : t('lib.empty.noMatch')}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleNew}>{t('lib.empty.cta')}</Button>
          </Empty>
        ) : (
          <LibraryTable
            fields={fields}
            items={processed}
            focusItemId={focusItemId}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPin={(item, pinned) => pinItem(item.id, pinned)}
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
          message.success('模板已保存')
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
