import { useEffect, useState } from 'react'
import {
  Button,
  Dropdown,
  Field,
  Input,
  Option,
  Switch,
  Text,
  Tooltip,
} from '@fluentui/react-components'
import { AddRegular, DeleteRegular, ReOrderDotsVerticalRegular } from '@fluentui/react-icons'
import { App } from 'antd'
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
import { LibDialog, useLibText } from './labels'

interface Props {
  open: boolean
  libraryId: string
  fields: FieldDef[]
  onCancel: () => void
  onSave: (fields: FieldDef[]) => Promise<void>
}

/**
 * 字段设置编辑器（v10 Fluent Dialog · 设置式列表）。
 *
 * 一行一个字段（行高 44、仅底边 1px 分割线），拖拽只给行位移 + 2px 强调插入线。
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

  // 打开时同步一次（与旧版 afterOpenChange 行为等价），之后由本地编辑状态接管
  useEffect(() => {
    if (open) setList(fields)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在打开时同步
  }, [open])

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
    <LibDialog
      open={open}
      onClose={onCancel}
      title={t('lib.tpl.modalTitle')}
      width="min(880px, calc(100vw - 32px))"
      actions={
        <div className="lib-dialog-footer">
          <Button appearance="secondary" icon={<AddRegular />} onClick={addField}>
            {t('lib.tpl.addField')}
          </Button>
          <span className="lib-dialog-footer-spacer" />
          <Button appearance="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button appearance="primary" onClick={handleSave}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <Text size={200} className="lib-dialog-sub">
        {lt('tpl.dragHint')}
      </Text>

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
              {/* 表头：与数据表表头同一口径（12 semibold 次级色） */}
              <div className="lib-field-head" aria-hidden>
                <span />
                <span>{t('lib.tpl.fieldName')}</span>
                <span>{lt('tpl.type')}</span>
                <span>{lt('tpl.cols')}</span>
                <span />
              </div>
              {list.map((f) => (
                <div key={f.id}>
                  {/* 插入线：拖拽时只出现这一条 2px 强调线 */}
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
    </LibDialog>
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
  const lt = useLibText()
  const { attributes, listeners, setNodeRef, transform } = useSortable({ id: field.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    // 拖拽只跟手，不给回弹动画（数据行禁用 overshoot）
    transition: undefined,
  }
  const typeLabel = fieldTypes.find((x) => x.value === field.type)?.label ?? field.type

  return (
    <div ref={setNodeRef} style={style} className={`lib-field-row${dragging ? ' is-dragging' : ''}`}>
      <span
        className="lib-field-handle"
        {...attributes}
        {...listeners}
        aria-label={t('lib.tpl.dragHint')}
        role="button"
        tabIndex={0}
      >
        <ReOrderDotsVerticalRegular />
      </span>
      <Field className="lib-field-name">
        <Input
          value={field.label}
          onChange={(_, data) => onChange({ label: data.value })}
          placeholder={t('lib.tpl.fieldName')}
          aria-label={t('lib.tpl.fieldName')}
          autoFocus
        />
      </Field>
      <Field className="lib-field-type">
        <Dropdown
          value={typeLabel}
          selectedOptions={[field.type]}
          aria-label={lt('tpl.type')}
          onOptionSelect={(_, data) => {
            if (data.optionValue) onChange({ type: data.optionValue as FieldType })
          }}
        >
          {fieldTypes.map((o) => (
            <Option key={o.value} value={o.value} text={o.label}>
              {o.label}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <div className="lib-field-switches">
        <span className="lib-field-switch-group">
          <Text size={200} className="lib-field-switch-label">
            {t('common.required')}
          </Text>
          <Switch
            checked={field.required}
            onChange={(_, data) => onChange({ required: data.checked })}
            aria-label={`${t('common.required')} ${field.label}`}
          />
        </span>
        <span className="lib-field-switch-group">
          <Text size={200} className="lib-field-switch-label">
            {t('common.visible')}
          </Text>
          <Switch
            checked={field.visible}
            onChange={(_, data) => onChange({ visible: data.checked })}
            aria-label={`${t('common.visible')} ${field.label}`}
          />
        </span>
      </div>
      <Tooltip content={lt('tpl.removeField')} relationship="label">
        <Button
          appearance="subtle"
          size="small"
          icon={<DeleteRegular />}
          aria-label={lt('tpl.removeField')}
          style={{ color: 'var(--w-danger)' }}
          onClick={onRemove}
        />
      </Tooltip>
      {field.type === 'select' && (
        <Field className="lib-field-options" label={lt('tpl.options')}>
          <Input
            value={field.options.join('，')}
            placeholder={lt('tpl.optionsPlaceholder')}
            onChange={(_, data) => {
              const options = data.value
                .split(/[，,]/)
                .map((s) => s.trim())
                .filter(Boolean)
              onChange({ options })
            }}
          />
        </Field>
      )}
    </div>
  )
}
