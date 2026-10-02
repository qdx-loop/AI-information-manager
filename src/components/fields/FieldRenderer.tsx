import { Input, InputNumber, DatePicker, Select, Checkbox, Rate } from 'antd'
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

// 字段输入渲染器：按 type 渲染对应输入控件
export default function FieldRenderer({ field, value, onChange, autoFocus, compact }: Props) {
  const sz = compact ? ('small' as const) : ('middle' as const)
  const t = useI18n()
  switch (field.type) {
    case 'text':
      return <Input size={sz} autoFocus={autoFocus} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={t('field.inputPlaceholder', { name: field.label })} />
    case 'textarea':
      return <Input.TextArea size={sz} autoFocus={autoFocus} value={(value as string) ?? ''} rows={compact ? 2 : 3} onChange={(e) => onChange(e.target.value)} placeholder={t('field.inputPlaceholder', { name: field.label })} />
    case 'number':
      return <InputNumber size={sz} autoFocus={autoFocus} value={value as number} onChange={(v) => onChange(v ?? null)} style={{ width: '100%' }} placeholder={t('field.numberPlaceholder')} />
    case 'date':
      return (
        <DatePicker
          value={value ? dayjs(value as string) : null}
          onChange={(d) => onChange(d ? d.format('YYYY-MM-DD') : null)}
          style={{ width: '100%' }}
        />
      )
    case 'select':
      return (
        <Select
          size={sz}
          autoFocus={autoFocus}
          style={{ width: '100%' }}
          value={(value as string) ?? undefined}
          onChange={(v) => onChange(v ?? null)}
          options={field.options.map((o) => ({ label: o, value: o }))}
          allowClear
          placeholder={t('field.selectPlaceholder')}
        />
      )
    case 'checkbox':
      return <Checkbox autoFocus={autoFocus} checked={!!value} onChange={(e) => onChange(e.target.checked)}>{t('field.yes')}</Checkbox>
    case 'rating':
      return <Rate style={{ fontSize: compact ? 14 : 18 }} value={(value as number) ?? 0} onChange={(v) => onChange(v)} />
    default:
      return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
  }
}

// 表格单元格值展示
export function renderCellValue(field: FieldDef, value: FieldValue): string {
  if (value === null || value === undefined || value === '') return '-'
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
