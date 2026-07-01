import { useState, useMemo, useEffect } from 'react'
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
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons'
import { useLibraryStore } from '@/store/libraryStore'
import LibraryTable from './LibraryTable'
import ItemEditor from './ItemEditor'
import TemplateEditor from './TemplateEditor'
import ImportExport from './ImportExport'
import type { Item, FieldValue } from '@/types'

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

  useEffect(() => {
    if (id && id !== currentLibraryId) {
      void selectLibrary(id)
    }
  }, [id, currentLibraryId, selectLibrary])

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [cloneTargets, setCloneTargets] = useState<string[]>([])
  const [keyword, setKeyword] = useState('')
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
        title: '请先配置字段模板',
        content: '当前管理库还没有字段模板，无法新建条目。请先添加至少一个字段（如姓名、编号等）。',
        okText: '去配置',
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
      message.success('已更新')
    } else {
      await createItem(values)
      message.success('已新建')
    }
    setEditorOpen(false)
    setEditing(null)
  }

  const handleDelete = (item: Item) => {
    modal.confirm({
      title: '删除该条目？',
      content: '删除后可在回收站恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await deleteItem(item.id)
        message.success('已移入回收站')
      },
    })
  }

  const handleImport = async (rows: Record<string, FieldValue>[]) => {
    for (const r of rows) {
      await createItem(r)
    }
  }

  // 模板复用：把当前库模板复制到其他库
  const cloneTargetsOptions = libraries.filter((l) => l.id !== id)
  const handleClone = () => {
    if (cloneTargetsOptions.length === 0) {
      message.info('没有其他管理库可复用')
      return
    }
    setCloneTargets([])
    setCloneOpen(true)
  }
  const confirmClone = async () => {
    if (!cloneTargets.length) {
      message.warning('请选择目标')
      return
    }
    for (const tid of cloneTargets) {
      await cloneTemplate(id!, tid)
    }
    setCloneOpen(false)
    message.success(`已复用到 ${cloneTargets.length} 个管理库`)
  }

  if (loading) return <div style={{ padding: 24 }}>加载中…</div>

  return (
    <div style={{ padding: 16, height: '100%' }}>
      <Card
        styles={{ body: { padding: 16 } }}
        style={{ marginBottom: 12 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Space>
            <Title level={4} style={{ margin: 0 }}>
              {lib?.name ?? '管理库'}
            </Title>
            {lib && <Tag color="blue">{lib.category}</Tag>}
            <Text type="secondary">共 {items.length} 条</Text>
          </Space>
          <Space wrap>
            <Button icon={<PlusOutlined />} type="primary" onClick={handleNew}>新建条目</Button>
            <Button icon={<SettingOutlined />} onClick={() => setTemplateOpen(true)}>字段模板</Button>
            <Button icon={<ImportOutlined />} onClick={handleClone} disabled={fields.length === 0}>
              复用模板
            </Button>
            <ImportExport fields={fields} items={items} onImport={handleImport} />
          </Space>
        </div>
      </Card>

      <Card styles={{ body: { padding: 12 } }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="关键词搜索"
            allowClear
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 220 }}
          />
          <Select
            placeholder="筛选字段"
            value={filterField || undefined}
            onChange={(v) => setFilterField(v ?? '')}
            allowClear
            style={{ width: 140 }}
            options={visibleFields.map((f) => ({ label: f.label, value: f.key }))}
          />
          {filterField && (
            <Input
              placeholder="筛选值"
              allowClear
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              style={{ width: 160 }}
            />
          )}
          <Select
            placeholder="排序字段"
            value={sortField || undefined}
            onChange={(v) => setSortField(v ?? '')}
            allowClear
            style={{ width: 140 }}
            options={visibleFields.map((f) => ({ label: f.label, value: f.key }))}
          />
          {sortField && (
            <Switch
              checkedChildren="降序"
              unCheckedChildren="升序"
              checked={sortDesc}
              onChange={setSortDesc}
            />
          )}
          <Button icon={<ArrowUpOutlined />} onClick={() => setSortDesc(false)} type="text" />
          <Button icon={<ArrowDownOutlined />} onClick={() => setSortDesc(true)} type="text" />
          <Button type="link" onClick={() => { setKeyword(''); setFilterField(''); setFilterValue(''); setSortField('') }}>
            清除
          </Button>
        </Space>

        {processed.length === 0 ? (
          <Empty description={items.length === 0 ? '暂无条目，点击「新建条目」开始' : '无匹配结果'}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleNew}>新建条目</Button>
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
        title="复用字段模板到"
        open={cloneOpen}
        onCancel={() => setCloneOpen(false)}
        onOk={confirmClone}
      >
        <p style={{ color: '#999', marginBottom: 12 }}>选择目标管理库（可多选）：</p>
        <Select
          mode="multiple"
          placeholder="选择目标管理库"
          style={{ width: '100%' }}
          value={cloneTargets}
          onChange={setCloneTargets}
          options={cloneTargetsOptions.map((l) => ({ label: l.name, value: l.id }))}
        />
      </Modal>
    </div>
  )
}
