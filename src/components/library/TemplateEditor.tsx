import { Modal, Button, Input, Select, Switch, App } from 'antd'
import { DeleteOutlined, HolderOutlined, PlusOutlined } from '@ant-design/icons'
import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
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
import EmptyPanel from './EmptyPanel'

// 字段类型选项在组件内按当前语言生成（fieldTypes）

interface Props {
  open: boolean
  libraryId: string
  fields: FieldDef[]
  onCancel: () => void
  onSave: (fields: FieldDef[]) => Promise<void>
}

/**
 * 字段模板编辑器（v4 SIGNAL PRESS）。
 *
 * 一行一个字段（行高 40、底边 1px line-soft），拖拽只给两种反馈——
 * 行位移 + 3px lime 插入线，不做缩放/阴影/背景高亮。
 * 逻辑（校验 label/key 唯一、sortOrder 重排、保存）与原来完全一致。
 */
export default function TemplateEditor({ open, libraryId, fields, onCancel, onSave }: Props) {
  const { message } = App.useApp()
  const t = useI18n()
  const [list, setList] = useState<FieldDef[]>(fields)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
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

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))
  const onDragOver = (e: DragOverEvent) => setOverId(e.over ? String(e.over.id) : null)

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    setActiveId(null)
    setOverId(null)
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
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      width="90%"
      style={{ maxWidth: 780 }}
      afterOpenChange={(o) => o && handleOpen()}
      styles={{ body: { maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' } }}
    >
      <div className="page-kicker" style={{ marginBottom: 8 }}>{t('lib.tpl.kicker')}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Button icon={<PlusOutlined />} onClick={addField}>{t('lib.tpl.addField')}</Button>
        <span className="field-hint">{t('lib.tpl.dragHint')}</span>
      </div>

      {list.length === 0 ? (
        <EmptyPanel surface={false} title={t('lib.tpl.empty')} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragCancel={() => {
            setActiveId(null)
            setOverId(null)
          }}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={list.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            {/* 表头：mono 大写小标签，与数据表表头同一口径 */}
            <div
              className="panel-kicker"
              style={{
                display: 'flex',
                gap: 8,
                padding: '0 8px 8px',
                borderBottom: 'var(--bw) solid var(--line)',
              }}
            >
              <span style={{ width: 16, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{t('lib.tpl.fieldName')}</span>
              <span style={{ width: 128, flexShrink: 0 }}>{t('lib.trash.col.type')}</span>
              <span style={{ width: 176, flexShrink: 0 }}>{t('common.required')} / {t('common.visible')}</span>
            </div>
            <div>
              {list.map((f) => (
                <div key={f.id}>
                  {/* 插入线：拖拽时只出现这一条 3px lime 线，不做缩放/阴影 */}
                  {activeId && overId === f.id && activeId !== f.id ? (
                    <div style={{ height: 3, background: 'var(--lime)', margin: '1px 0' }} />
                  ) : null}
                  <FieldRow
                    field={f}
                    fieldTypes={fieldTypes}
                    dragging={activeId === f.id}
                    onChange={(patch) => updateField(f.id, patch)}
                    onRemove={() => removeField(f.id)}
                  />
                </div>
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
  dragging,
}: {
  field: FieldDef
  fieldTypes: { label: string; value: FieldType }[]
  onChange: (patch: Partial<FieldDef>) => void
  onRemove: () => void
  dragging: boolean
}) {
  const t = useI18n()
  const { attributes, listeners, setNodeRef, transform } = useSortable({
    id: field.id,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    // 拖拽只跟手，不给回弹动画（v4：数据行禁用 overshoot）
    transition: undefined,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    minHeight: 40,
    padding: '4px 8px',
    background: 'transparent',
    borderBottom: '1px solid var(--line-soft)',
    // 拖起来的那行只降低不透明度，其他视觉一律不变
    opacity: dragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <span
        {...attributes}
        {...listeners}
        style={{ cursor: 'grab', color: 'var(--ink-faint)', width: 16, flexShrink: 0, display: 'inline-flex' }}
      >
        <HolderOutlined />
      </span>
      <Input
        size="small"
        value={field.label}
        onChange={(e) => onChange({ label: e.target.value })}
        style={{ width: 160, flex: 1, minWidth: 100 }}
        placeholder={t('lib.tpl.fieldName')}
        autoFocus
      />
      <Select
        size="small"
        value={field.type}
        onChange={(v) => onChange({ type: v })}
        options={fieldTypes}
        style={{ width: 128, flexShrink: 0 }}
      />
      {field.type === 'select' && (
        <Select
          size="small"
          mode="tags"
          value={field.options}
          onChange={(v) => onChange({ options: v })}
          // 选项多时独占第二行（order 10 让它排在开关之后），避免把「必填/显示」挤到第三行
          style={{ order: 10, flex: '1 1 100%', minWidth: 0, marginLeft: 24 }}
          placeholder={t('lib.tpl.optionsPlaceholder')}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span className="field-hint">{t('common.required')}</span>
        <Switch size="small" checked={field.required} onChange={(v) => onChange({ required: v })} />
        <span className="field-hint">{t('common.visible')}</span>
        <Switch size="small" checked={field.visible} onChange={(v) => onChange({ visible: v })} />
        <Button
          type="text"
          className="icon-btn is-sm is-danger"
          aria-label={t('tpl.field.remove')}
          title={t('tpl.field.remove')}
          icon={<DeleteOutlined />}
          onClick={onRemove}
        />
      </div>
    </div>
  )
}
