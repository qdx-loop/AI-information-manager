import { Modal, Form, App, DatePicker, Divider, Select } from 'antd'
import { BellOutlined } from '@ant-design/icons'
import { useEffect } from 'react'
import dayjs from 'dayjs'
import type { FieldDef, Item, FieldValue } from '@/types'
import FieldRenderer from '@/components/fields/FieldRenderer'
import { useI18n } from '@/i18n'
import { REMINDER_FIELD_KEY, REMINDER_REPEAT_KEY, getReminderAt, getReminderRepeat } from '@/utils/reminder'
import { useAuthStore } from '@/store/authStore'
import { markObStep } from '@/utils/onboarding'

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
  const t = useI18n()
  const { account } = useAuthStore()

  useEffect(() => {
    if (open) {
      const init: Record<string, unknown> = {}
      fields.forEach((f) => {
        init[f.key] = item?.fields[f.key] ?? null
      })
      const reminder = item ? getReminderAt(item) : null
      init[REMINDER_FIELD_KEY] = reminder != null ? dayjs(reminder) : null
      init[REMINDER_REPEAT_KEY] = item ? getReminderRepeat(item) : 'none'
      form.setFieldsValue(init)
    }
  }, [open, fields, item, form])

  const handleOk = async () => {
    try {
      const values = (await form.validateFields()) as Record<string, unknown>
      // 提醒控件值为 dayjs，落库前转为时间戳；未设置则一并移除重复规则
      const reminder = values[REMINDER_FIELD_KEY]
      if (reminder && dayjs.isDayjs(reminder)) {
        values[REMINDER_FIELD_KEY] = reminder.startOf('day').valueOf()
        if (account) markObStep(account.id, 'reminder')
      } else {
        delete values[REMINDER_FIELD_KEY]
        delete values[REMINDER_REPEAT_KEY]
      }
      await onSave(values as Record<string, FieldValue>)
    } catch (e) {
      if ((e as Error).message) message.error((e as Error).message)
    }
  }

  const visibleFields = fields.filter((f) => f.visible)

  return (
    <Modal
      title={item ? t('lib.editor.editTitle') : t('lib.editor.newTitle')}
      open={open}
      onCancel={() => {
        form.resetFields()
        onCancel()
      }}
      onOk={handleOk}
      width="90%"
      style={{ maxWidth: 560 }}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        {visibleFields.map((f) => (
          <Form.Item
            key={f.key}
            name={f.key}
            label={f.label}
            rules={f.required ? [{ required: true, message: `请填写${f.label}` }] : []}
          >
            <FieldRenderer field={f} value={null} onChange={() => {}} />
          </Form.Item>
        ))}
        {visibleFields.length === 0 && (
          <p style={{ color: 'var(--ant-color-text-secondary)', textAlign: 'center' }}>当前管理库尚未配置字段，请先在「字段模板」中添加字段。</p>
        )}
        <Divider style={{ margin: '12px 0' }} />
        <Form.Item
          name={REMINDER_FIELD_KEY}
          label={
            <span>
              <BellOutlined style={{ marginRight: 6, color: '#0D9488' }} />
              {t('reminder.label')}
            </span>
          }
        >
          <DatePicker style={{ width: '100%' }} placeholder={t('reminder.placeholder')} allowClear />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(a, b) => a[REMINDER_FIELD_KEY] !== b[REMINDER_FIELD_KEY]}>
          {() => {
            const picked = form.getFieldValue(REMINDER_FIELD_KEY)
            if (!picked) return null
            return (
              <Form.Item name={REMINDER_REPEAT_KEY} label={t('reminder.repeat')} style={{ marginBottom: 0 }}>
                <Select
                  options={[
                    { value: 'none', label: t('reminder.repeat.none') },
                    { value: 'daily', label: t('reminder.repeat.daily') },
                    { value: 'weekly', label: t('reminder.repeat.weekly') },
                    { value: 'monthly', label: t('reminder.repeat.monthly') },
                  ]}
                />
              </Form.Item>
            )
          }}
        </Form.Item>
      </Form>
    </Modal>
  )
}
