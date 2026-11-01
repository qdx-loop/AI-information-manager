import { Modal, Input, Select, Switch, App } from 'antd'
import { DeleteRegular, AddRegular, ReOrderDotsVerticalRegular } from '@fluentui/react-icons'
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
import { useLibText } from './labels'

// 字段类型选项在组件内按当前语言生成（fieldTypes）

interface Props {
  open: boolean
  libraryId: string
  fields: FieldDef[]
  onCancel: () => void
  onSave: (fields: FieldDef[]) => Promise<void>
}

/**
 * 字段模板编辑器（v9 Win11 ContentDialog · 设置式列表）。
 *
 * 一行一个字段（行高 44、仅底边 1px 分割线），拖拽只给两种反馈：
 * 行位移 + 2px 强调色插入线，不做缩放/阴影/背景高亮。
 * 逻辑（校验 label 唯一、key 唯一、sortOrder 重排、保存）与原来完全一致。
 */
export default function TemplateEditor({ open, libraryId, fields, onCancel, onSave }: Props) {
  const { message } = App.useApp()
  const t = useI18n()
  const lt = useLibText()
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
      width={860}
      style={{ maxWidth: 'calc(100vw - 24px)' }}
      afterOpenChange={(o) => o && handleOpen()}
      styles={{ body: { maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' } }}
      destroyOnHidden
      footer={
        <div className="lib-dialog-footer">
          <button type="button" className="w-btn" onClick={addField}>
            <AddRegular />
            {t('lib.tpl.addField')}
          </button>
          <span className="lib-dialog-footer-spacer" />
          <button type="button" className="w-btn" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="button" className="w-btn w-btn--accent" onClick={handleSave}>
            {t('common.save')}
          </button>
        </div>
      }
    >
      <p className="lib-dialog-sub">{lt('tpl.dragHint')}</p>

      {list.length === 0 ? (
        <EmptyPanel surface={false} title={t('lib.tpl.empty')} body={lt('tpl.emptyHint')} />
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
            <div className="lib-fields">
              {/* 表头：12 semibold 次级色，与数据表表头同一口径 */}
              <div className="lib-field-head" aria-hidden>
                <span className="lib-field-col-handle" />
                <span className="lib-field-col-name">{t('lib.tpl.fieldName')}</span>
                <span className="lib-field-col-type">{lt('tpl.type')}</span>
                <span className="lib-field-col-switch">{lt('tpl.cols')}</span>
                <span className="lib-field-col-remove" />
              </div>
              {list.map((f) => (
                <div key={f.id}>
                  {/* 插入线：拖拽时只出现这一条 2px 强调线，不做缩放/阴影 */}
                  {activeId && overId === f.id && activeId !== f.id ? (
                    <div className="lib-field-insert" aria-hidden />
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
    // 拖拽只跟手，不给回弹动画（数据行禁用 overshoot）
    transition: undefined,
  }
  return (
    <div ref={setNodeRef} style={style} className={`lib-field-row${dragging ? ' is-dragging' : ''}`}>
      <span className="lib-field-handle" {...attributes} {...listeners} aria-label={t('lib.tpl.dragHint')}>
        <ReOrderDotsVerticalRegular />
      </span>
      <Input
        size="small"
        className="lib-field-name"
        value={field.label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder={t('lib.tpl.fieldName')}
        autoFocus
      />
      <Select
        size="small"
        className="lib-field-type"
        value={field.type}
        onChange={(v) => onChange({ type: v })}
        options={fieldTypes}
        style={{ width: 132 }}
      />
      <div className="lib-field-switches">
        <span className="lib-field-switch-group">
          <span className="lib-field-switch-label">{t('common.required')}</span>
          <Switch size="small" checked={field.required} onChange={(v) => onChange({ required: v })} />
        </span>
        <span className="lib-field-switch-group">
          <span className="lib-field-switch-label">{t('common.visible')}</span>
          <Switch size="small" checked={field.visible} onChange={(v) => onChange({ visible: v })} />
        </span>
      </div>
      <button
        type="button"
        className="w-iconbtn w-iconbtn--sm"
        aria-label={t('tpl.field.remove')}
        title={t('tpl.field.remove')}
        onClick={onRemove}
        style={{ color: 'var(--w-danger)' }}
      >
        <DeleteRegular />
      </button>
      {field.type === 'select' && (
        <Select
          size="small"
          mode="tags"
          className="lib-field-options"
          value={field.options}
          onChange={(v) => onChange({ options: v })}
          placeholder={t('lib.tpl.optionsPlaceholder')}
          style={{ width: '100%' }}
        />
      )}
    </div>
  )
}
