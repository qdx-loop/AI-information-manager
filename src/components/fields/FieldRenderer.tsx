import { useEffect, useRef, useState } from 'react'
import {
  Button,
  Checkbox,
  Dropdown,
  Input,
  Option,
  Textarea,
} from '@fluentui/react-components'
import { StarFilled, StarRegular } from '@fluentui/react-icons'
import { DatePicker } from 'antd'
import dayjs from 'dayjs'
import { useI18n, tNow } from '@/i18n'
import type { FieldDef, FieldValue } from '@/types'

interface Props {
  field: FieldDef
  value: FieldValue
  onChange: (v: FieldValue) => void
  /** 表格内联编辑时自动聚焦，省掉一次点击 */
  autoFocus?: boolean
  /** 内联编辑用紧凑尺寸，避免把表格行撑高 */
  compact?: boolean
}

/** 输入焦点：Fluent 控件把 ref 透传给内部 input，这里在挂载后聚焦。 */
function useAutoFocus<T extends HTMLElement>(autoFocus: boolean | undefined) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])
  return ref
}

/** 数字输入：保留用户输入的字符串，只在能解析成数字时回写，避免中途变 null。 */
function NumberInput({
  value,
  onChange,
  autoFocus,
  placeholder,
  compact,
}: {
  value: FieldValue
  onChange: (v: FieldValue) => void
  autoFocus?: boolean
  placeholder?: string
  compact?: boolean
}) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const ref = useAutoFocus<HTMLInputElement>(autoFocus)
  useEffect(() => {
    setText(value == null ? '' : String(value))
  }, [value])
  return (
    <Input
      ref={ref}
      type="number"
      value={text}
      placeholder={placeholder}
      className={compact ? 'lib-inline-control' : undefined}
      onChange={(_, data) => {
        setText(data.value)
        if (data.value.trim() === '') {
          onChange(null)
          return
        }
        const n = Number(data.value)
        onChange(Number.isFinite(n) ? n : null)
      }}
    />
  )
}

/**
 * 字段输入渲染器（v10 Fluent）：
 * 文本 / 多行 / 数字 / 下拉 / 复选 / 评分全部使用 @fluentui/react-components；
 * 仅日期保留 antd DatePicker（Fluent UI React 没有日期选择器）。
 */
export default function FieldRenderer({ field, value, onChange, autoFocus, compact }: Props) {
  const t = useI18n()
  const textRef = useAutoFocus<HTMLInputElement>(autoFocus)
  const textareaRef = useAutoFocus<HTMLTextAreaElement>(autoFocus)
  const cls = compact ? 'lib-inline-control' : undefined

  switch (field.type) {
    case 'text':
      return (
        <Input
          ref={textRef}
          className={cls}
          value={(value as string) ?? ''}
          onChange={(_, data) => onChange(data.value)}
          placeholder={t('field.inputPlaceholder', { name: field.label })}
        />
      )
    case 'textarea':
      return (
        <Textarea
          ref={textareaRef}
          className={cls}
          value={(value as string) ?? ''}
          onChange={(_, data) => onChange(data.value)}
          resize="vertical"
          rows={compact ? 2 : 3}
          placeholder={t('field.inputPlaceholder', { name: field.label })}
        />
      )
    case 'number':
      return (
        <NumberInput
          value={value}
          onChange={onChange}
          autoFocus={autoFocus}
          compact={compact}
          placeholder={t('field.numberPlaceholder')}
        />
      )
    case 'date':
      return (
        <DatePicker
          size={compact ? 'small' : 'middle'}
          value={value ? dayjs(value as string) : null}
          onChange={(d) => onChange(d ? d.format('YYYY-MM-DD') : null)}
          style={{ width: '100%', fontVariantNumeric: 'tabular-nums' }}
        />
      )
    case 'select': {
      const current = value == null ? '' : String(value)
      return (
        <Dropdown
          className={cls}
          value={current}
          selectedOptions={current ? [current] : []}
          placeholder={t('field.selectPlaceholder')}
          clearable
          onOptionSelect={(_, data) => onChange(data.optionValue ?? null)}
        >
          {field.options.map((o) => (
            <Option key={o} value={o}>
              {o}
            </Option>
          ))}
        </Dropdown>
      )
    }
    case 'checkbox':
      return (
        <Checkbox
          checked={!!value}
          onChange={(_, data) => onChange(data.checked === true)}
          label={t('field.yes')}
        />
      )
    case 'rating': {
      const n = Math.max(0, Math.min(5, Number(value) || 0))
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }} role="group">
          {Array.from({ length: 5 }).map((_, i) => (
            <Button
              key={i}
              appearance="transparent"
              size="small"
              aria-label={tNow('field.stars', { n: String(i + 1) })}
              aria-pressed={i < n}
              style={{ minWidth: compact ? 22 : 26, padding: 0 }}
              icon={
                i < n ? (
                  <StarFilled style={{ color: 'var(--w-brand-fg)' }} />
                ) : (
                  <StarRegular style={{ color: 'var(--w-text-3)' }} />
                )
              }
              onClick={() => onChange(n === i + 1 ? 0 : i + 1)}
            />
          ))}
        </span>
      )
    }
    default:
      return (
        <Input
          ref={textRef}
          value={(value as string) ?? ''}
          onChange={(_, data) => onChange(data.value)}
        />
      )
  }
}

// 表格单元格值展示（移动端卡片标题 / 纯文本导出共用）
export function renderCellValue(field: FieldDef, value: FieldValue): string {
  if (value === null || value === undefined || value === '') return '—'
  switch (field.type) {
    case 'checkbox':
      return value ? tNow('field.yes') : tNow('field.no')
    case 'rating':
      return tNow('field.stars', { n: String(value) })
    case 'date':
      return dayjs(value as string).format('YYYY-MM-DD')
    default:
      return String(value)
  }
}
