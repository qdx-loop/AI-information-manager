import { Modal, Form, App } from 'antd'
import { useEffect } from 'react'
import type { FieldDef, Item, FieldValue } from '@/types'
import FieldRenderer from '@/components/fields/FieldRenderer'

interface Props {
  open: boolean
  fields: FieldDef[]
  item: Item | null
  onCancel: () => void
  onSave: (values: Record<string, FieldValue>) => Promise<void>
}

export default function ItemEditor({ open, fields, item, onCancel, onSave }: Props) {
  const { message } = App.useApp()
  const [form] = Form.useForm()

  useEffect(() => {
    if (open) {
      const init: Record<string, FieldValue> = {}
      fields.forEach((f) => {
        init[f.key] = item?.fields[f.key] ?? null
      })
      form.setFieldsValue(init)
    }
  }, [open, fields, item, form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      await onSave(values as Record<string, FieldValue>)
    } catch (e) {
      if ((e as Error).message) message.error((e as Error).message)
    }
  }

  const visibleFields = fields.filter((f) => f.visible)

  return (
    <Modal
      title={item ? '编辑条目' : '新建条目'}
      open={open}
      onCancel={() => {
        form.resetFields()
        onCancel()
      }}
      onOk={handleOk}
      width={560}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        {visibleFields.map((f) => (
          <Form.Item
            key={f.key}
            name={f.key}
            label={f.label}
            rules={f.required ? [{ required: true, message: `请填写${f.label}` }] : []}
            valuePropName={f.type === 'checkbox' ? 'checked' : 'value'}
          >
            <FieldRenderer field={f} value={null} onChange={() => {}} />
          </Form.Item>
        ))}
        {visibleFields.length === 0 && (
          <p style={{ color: '#999', textAlign: 'center' }}>当前管理库尚未配置字段，请先在「字段模板」中添加字段。</p>
        )}
      </Form>
    </Modal>
  )
}
