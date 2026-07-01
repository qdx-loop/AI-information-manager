import { Input, InputNumber, DatePicker, Select, Checkbox, Rate } from 'antd'
import dayjs from 'dayjs'
import type { FieldDef, FieldValue } from '@/types'

interface Props {
  field: FieldDef
  value: FieldValue
  onChange: (v: FieldValue) => void
}

// 字段输入渲染器：按 type 渲染对应输入控件
export default function FieldRenderer({ field, value, onChange }: Props) {
  switch (field.type) {
    case 'text':
      return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={`请输入${field.label}`} />
    case 'textarea':
      return <Input.TextArea value={(value as string) ?? ''} rows={3} onChange={(e) => onChange(e.target.value)} placeholder={`请输入${field.label}`} />
    case 'number':
      return <InputNumber value={value as number} onChange={(v) => onChange(v ?? null)} style={{ width: '100%' }} placeholder="请输入数字" />
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
          value={(value as string) ?? undefined}
          onChange={(v) => onChange(v ?? null)}
          options={field.options.map((o) => ({ label: o, value: o }))}
          allowClear
          placeholder="请选择"
        />
      )
    case 'checkbox':
      return <Checkbox checked={!!value} onChange={(e) => onChange(e.target.checked)}>是</Checkbox>
    case 'rating':
      return <Rate value={(value as number) ?? 0} onChange={(v) => onChange(v)} />
    default:
      return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
  }
}

// 表格单元格值展示
export function renderCellValue(field: FieldDef, value: FieldValue): string {
  if (value === null || value === undefined || value === '') return '-'
  switch (field.type) {
    case 'checkbox':
      return value ? '是' : '否'
    case 'rating':
      return `${value} 星`
    case 'date':
      return dayjs(value as string).format('YYYY-MM-DD')
    default:
      return String(value)
  }
}
