import { Modal, Button, Input, Select, Switch, Space, App, Empty } from 'antd'
import { PlusOutlined, DeleteOutlined, HolderOutlined } from '@ant-design/icons'
import { useState } from 'react'
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
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { FieldDef, FieldType } from '@/types'
import { newId } from '@/utils/id'

const FIELD_TYPES: { label: string; value: FieldType }[] = [
  { label: '文本（单行）', value: 'text' },
  { label: '文本（多行）', value: 'textarea' },
  { label: '数字', value: 'number' },
  { label: '日期', value: 'date' },
  { label: '下拉单选', value: 'select' },
  { label: '复选框', value: 'checkbox' },
  { label: '评分', value: 'rating' },
]

interface Props {
  open: boolean
  libraryId: string
  fields: FieldDef[]
  onCancel: () => void
  onSave: (fields: FieldDef[]) => Promise<void>
}

export default function TemplateEditor({ open, libraryId, fields, onCancel, onSave }: Props) {
  const { message } = App.useApp()
  const [list, setList] = useState<FieldDef[]>(fields)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // 同步外部 fields 变化
  if (open && list !== fields && fields.length !== list.length) {
    // 仅在打开瞬间同步
  }

  const handleOpen = () => setList(fields)

  const addField = () => {
    const f: FieldDef = {
      id: newId(),
      libraryId,
      key: `field_${newId().slice(0, 8)}`,
      label: '',
      type: 'text',
      options: [],
      required: false,
      visible: true,
      sortOrder: list.length,
    }
    setList([...list, f])
  }

  const updateField = (id: string, patch: Partial<FieldDef>) => {
    setList(list.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  const removeField = (id: string) => {
    setList(list.filter((f) => f.id !== id))
  }

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setList((prev) => {
      const oldIdx = prev.findIndex((f) => f.id === active.id)
      const newIdx = prev.findIndex((f) => f.id === over.id)
      return arrayMove(prev, oldIdx, newIdx).map((f, i) => ({ ...f, sortOrder: i }))
    })
  }

  const handleSave = async () => {
    // 校验 label 与 key 唯一
    const labels = list.map((f) => f.label.trim())
    if (labels.some((l) => !l)) {
      message.warning('字段名称不能为空')
      return
    }
    if (new Set(labels).size !== labels.length) {
      message.warning('字段名称不能重复')
      return
    }
    const keys = list.map((f) => f.key)
    if (new Set(keys).size !== keys.length) {
      message.warning('字段标识冲突')
      return
    }
    const final = list.map((f, i) => ({ ...f, sortOrder: i }))
    await onSave(final)
  }

  return (
    <Modal
      title="字段模板配置"
      open={open}
      onCancel={onCancel}
      onOk={handleSave}
      width={720}
      afterOpenChange={(o) => o && handleOpen()}
    >
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<PlusOutlined />} onClick={addField}>添加字段</Button>
        <span style={{ color: '#999', fontSize: 12 }}>拖拽 ⠿ 调整顺序</span>
      </Space>

      {list.length === 0 ? (
        <Empty description="暂无字段，点击「添加字段」开始" />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={list.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map((f) => (
                <FieldRow
                  key={f.id}
                  field={f}
                  onChange={(patch) => updateField(f.id, patch)}
                  onRemove={() => removeField(f.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </Modal>
  )
}

function FieldRow({
  field,
  onChange,
  onRemove,
}: {
  field: FieldDef
  onChange: (patch: Partial<FieldDef>) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: field.id,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: '#fafafa',
    borderRadius: 6,
    border: '1px solid #f0f0f0',
  }
  return (
    <div ref={setNodeRef} style={style}>
      <span {...attributes} {...listeners} style={{ cursor: 'grab', color: '#bbb' }}>
        <HolderOutlined />
      </span>
      <Input
        value={field.label}
        onChange={(e) => onChange({ label: e.target.value })}
        style={{ width: 140 }}
        placeholder="字段名"
        autoFocus
      />
      <Select
        value={field.type}
        onChange={(v) => onChange({ type: v })}
        options={FIELD_TYPES}
        style={{ width: 140 }}
      />
      {field.type === 'select' && (
        <Select
          mode="tags"
          value={field.options}
          onChange={(v) => onChange({ options: v })}
          style={{ flex: 1 }}
          placeholder="输入选项后回车"
        />
      )}
      <Space size="small">
        <span style={{ fontSize: 12 }}>必填</span>
        <Switch size="small" checked={field.required} onChange={(v) => onChange({ required: v })} />
        <span style={{ fontSize: 12 }}>显示</span>
        <Switch size="small" checked={field.visible} onChange={(v) => onChange({ visible: v })} />
        <Button type="text" danger icon={<DeleteOutlined />} onClick={onRemove} />
      </Space>
    </div>
  )
}
