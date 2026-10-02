import { Alert, Modal, Form, App, DatePicker, Divider, Select } from 'antd'
import { BellOutlined } from '@ant-design/icons'
import { useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import type { FieldDef, Item, FieldValue } from '@/types'
import FieldRenderer from '@/components/fields/FieldRenderer'
import { useI18n } from '@/i18n'
import { REMINDER_FIELD_KEY, REMINDER_REPEAT_KEY, getReminderAt, getReminderRepeat } from '@/utils/reminder'
import { useAuthStore } from '@/store/authStore'
import { useLibraryStore } from '@/store/libraryStore'
import { markObStep } from '@/utils/onboarding'
import { notificationSupported } from '@/utils/reminderNotify'

interface Props {
  open: boolean
  fields: FieldDef[]
  item: Item | null
  onCancel: () => void
  onSave: (values: Record<string, FieldValue>) => Promise<void>
}

export default function ItemEditor({ open, fields, item, onCancel, onSave }: Props) {
  const { message, modal } = App.useApp()
  const [form] = Form.useForm()
  const t = useI18n()
  const { account } = useAuthStore()

  /**
   * 这个环境到底能不能弹提醒。分三种「不能」：
   * unsupported = 安卓 App 壳等没有 Notification API 的环境
   * denied      = 浏览器支持但用户此前拒绝过授权
   */
  const notifyState: 'ok' | 'unsupported' | 'denied' = (() => {
    if (!notificationSupported()) return 'unsupported'
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return 'denied'
    return 'ok'
  })()

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

  const [saving, setSaving] = useState(false)
  /**
   * 打开编辑器时的 updatedAt 快照。
   *
   * 同步是 last-write-wins：用户在 A 设备打开条目，编辑器开着不动，
   * B 设备（或同浏览器另一个标签页）改同一条并同步过来，
   * 用户在 A 上点保存 —— 那次修改被静默覆盖，没有任何提示。
   * 这里记下打开时的版本，保存前比一次，变了就问一句。
   */
  const baseUpdatedAt = useRef<number | null>(null)
  useEffect(() => {
    if (open) baseUpdatedAt.current = item?.updatedAt ?? null
  }, [open, item?.id])

  const handleOk = async () => {
    if (saving) return

    // 先做冲突检查再 validateFields：否则用户填完一屏表单，
    // 点保存却被一个「是否覆盖」的弹窗打断，填的东西还在但不明显。
    if (item) {
      const latest = useLibraryStore.getState().items.find((x) => x.id === item.id)
      if (latest && baseUpdatedAt.current != null && latest.updatedAt !== baseUpdatedAt.current) {
        const go = await new Promise<boolean>((resolve) => {
          modal.confirm({
            title: t('item.conflict.title'),
            content: t('item.conflict.body', { at: dayjs(latest.updatedAt).format('MM-DD HH:mm') }),
            okText: t('item.conflict.overwrite'),
            okButtonProps: { danger: true },
            cancelText: t('common.cancel'),
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          })
        })
        if (!go) return
      }
    }

    setSaving(true)
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
    } finally {
      setSaving(false)
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
      confirmLoading={saving}
      okText={t('common.save')}
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
            // 打开后直接可以打字，少按一次 Tab
            {...(f === visibleFields[0] ? { autoFocus: true } : {})}
            rules={f.required ? [{ required: true, message: t('common.requiredField', { name: f.label }) }] : []}
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
              <BellOutlined style={{ marginRight: 6, color: 'var(--app-glaze)' }} />
              {t('reminder.label')}
            </span>
          }
        >
          <DatePicker style={{ width: '100%' }} placeholder={t('reminder.placeholder')} allowClear />
        </Form.Item>
        {/*
          提醒依赖浏览器 Notification API。在安卓 App 壳（WebView）里
          window.Notification 根本不存在，notificationSupported() 恒为 false，
          checkAndNotify() 直接 return 0 —— 也就是说设了日期、显示保存成功，
          但永远不会有任何通知。
          之前界面上完全看不出这一点，用户只能自己发现「提醒从来没响过」。
          所以在设置提醒的地方直接说明它在这个环境里会不会生效。
        */}
        {notifyState !== 'ok' && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message={t(`reminder.unavailable.${notifyState}`)}
          />
        )}
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
