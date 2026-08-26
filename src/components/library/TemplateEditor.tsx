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
import { useI18n } from '@/i18n'

// 字段类型选项在组件内按当前语言生成（fieldTypes）

interface Props {
  open: boolean
  libraryId: string
  fields: FieldDef[]
  onCancel: () => void
  onSave: (fields: FieldDef[]) => Promise<void>
}

export default function TemplateEditor({ open, libraryId, fields, onCancel, onSave }: Props) {
  const { message } = App.useApp()
  const t = useI18n()
  const [list, setList] = useState<FieldDef[]>(fields)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleOpen = () => setList(fields)

  const fieldTypes: { label: string; value: FieldType }[] = [
    { label: t('lib.tpl.type.text'), value: 'text' },
    { label: t('lib.tpl.type.textarea'), value: 'textarea' },
    { label: t('lib.tpl.type.number'), value: 'number' },
    { label: t('lib.tpl.type.date'), value: 'date' },
    { label: t('lib.tpl.type.select'), value: 'select' },
    { label: t('lib.tpl.type.checkbox'), value: 'checkbox' },
    { label: t('lib.tpl.type.rating'), value: 'rating' },
  ]

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
      message.warning(t('lib.tpl.err.labelEmpty'))
      return
    }
    if (new Set(labels).size !== labels.length) {
      message.warning(t('lib.tpl.err.labelDup'))
      return
    }
    const keys = list.map((f) => f.key)
    if (new Set(keys).size !== keys.length) {
      message.warning(t('lib.tpl.err.keyDup'))
      return
    }
    const final = list.map((f, i) => ({ ...f, sortOrder: i }))
    await onSave(final)
  }

  return (
    <Modal
      title={t('lib.tpl.modalTitle')}
      open={open}
      onCancel={onCancel}
      onOk={handleSave}
      width="90%"
      style={{ maxWidth: 720 }}
      afterOpenChange={(o) => o && handleOpen()}
    >
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<PlusOutlined />} onClick={addField}>{t('lib.tpl.addField')}</Button>
        <span style={{ color: 'var(--ant-color-text-secondary)', fontSize: 12 }}>{t('lib.tpl.dragHint')}</span>
      </Space>

      {list.length === 0 ? (
        <Empty description={t('lib.tpl.empty')} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={list.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map((f) => (
                <FieldRow
                  key={f.id}
                  field={f}
                  fieldTypes={fieldTypes}
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
  fieldTypes,
  onChange,
  onRemove,
}: {
  field: FieldDef
  fieldTypes: { label: string; value: FieldType }[]
  onChange: (patch: Partial<FieldDef>) => void
  onRemove: () => void
}) {
  const t = useI18n()
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: field.id,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
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
        style={{ width: 140, flex: 1, minWidth: 100 }}
        placeholder={t('lib.tpl.fieldName')}
        autoFocus
      />
      <Select
        value={field.type}
        onChange={(v) => onChange({ type: v })}
        options={fieldTypes}
        style={{ width: 140, flexShrink: 0 }}
      />
      {field.type === 'select' && (
        <Select
          mode="tags"
          value={field.options}
          onChange={(v) => onChange({ options: v })}
          style={{ flex: 1 }}
          placeholder={t('lib.tpl.optionsPlaceholder')}
        />
      )}
      <Space size="small">
        <span style={{ fontSize: 12 }}>{t('common.required')}</span>
        <Switch size="small" checked={field.required} onChange={(v) => onChange({ required: v })} />
        <span style={{ fontSize: 12 }}>{t('common.visible')}</span>
        <Switch size="small" checked={field.visible} onChange={(v) => onChange({ visible: v })} />
        <Button type="text" danger icon={<DeleteOutlined />} onClick={onRemove} />
      </Space>
    </div>
  )
}
