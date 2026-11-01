import { Modal, Form, App, DatePicker, Select, Button } from 'antd'
import { InfoCircleOutlined, DeleteOutlined } from '@ant-design/icons'
import { useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import type { FieldDef, Item, FieldValue } from '@/types'
import FieldRenderer from '@/components/fields/FieldRenderer'
import { useI18n } from '@/i18n'
import { REMINDER_FIELD_KEY, REMINDER_REPEAT_KEY, getReminderAt, getReminderRepeat, isoToLocalTs } from '@/utils/reminder'
import { getProvider } from '@/db/providerFactory'
import { notificationSupported } from '@/utils/reminderNotify'
import { LabelText } from './labels'

interface Props {
  open: boolean
  fields: FieldDef[]
  item: Item | null
  onCancel: () => void
  onSave: (values: Record<string, FieldValue>) => Promise<void>
  /** 编辑既有条目时的「删除」入口（走父组件的二次确认，不在这里直接删） */
  onDelete?: (item: Item) => void
}

/**
 * 条目编辑器（v4 SIGNAL PRESS）：Modal 760 / 0 圆角 / 2px ink / 硬投影；
 * 标题区手动（mono kicker + Outfit 800 24 标题）；字段两列 `.form-grid`；
 * 底部 sticky 操作条：左「删除」danger text，右「取消」ghost +「保存」lime primary。
 *
 * 业务逻辑与之前完全一致：并发冲突检测（updatedAt 快照 + 数据库复查）、
 * 提醒日历日字符串、Notification 不可用提示。
 */
export default function ItemEditor({ open, fields, item, onCancel, onSave, onDelete }: Props) {
  const { message, modal } = App.useApp()
  const [form] = Form.useForm()
  const t = useI18n()

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
      // 提醒存的是日历日字符串 'YYYY-MM-DD'，DatePicker 需要 dayjs
      const reminder = item ? getReminderAt(item) : null
      init[REMINDER_FIELD_KEY] = reminder != null ? dayjs(isoToLocalTs(reminder)) : null
      init[REMINDER_REPEAT_KEY] = item ? getReminderRepeat(item) : 'none'
      form.setFieldsValue(init)
    }
    // 只在「打开」或「切换条目」时重置表单。
    // 原来也把 fields 放进依赖里：而 refreshCurrent() 每次都安装新的 fields 数组，
    // 于是 AI 做任何写操作或同步回刷后，用户正在编辑的表单被静默重置(=丢草稿)。
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 刻意只放 open 和 item 身份
  }, [open, item?.id, form])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 打开那一刻快照一次，存盘时任务网比；之后条目变化不重置基线
  }, [open, item?.id])

  const handleOk = async () => {
    if (saving) return

    // 先做冲突检查再 validateFields：否则用户填完一屏表单，
    // 点保存却被一个「是否覆盖」的弹窗打断，填的东西还在但不明显。
    if (item) {
      // 必须查数据库，不能查 useLibraryStore.items：
      // store 的 deleteItem 会把条目从数组里 filter 掉，
      // 于是「已删除」这个最该被拦下的情况恰好变成 latest === undefined，
      // 被 `if (latest && ...)` 短路掉，冲突提示根本不弹。
      const latest = await getProvider().getItem(item.id)
      if (!latest) {
        // 打开编辑器之后这条被删了。不拦的话用户会以为保存成功，
        // 而 updateItem 只写 fields，实际上一条都存不进去。
        message.error(t('item.conflict.deletedBody'))
        return
      } else if (baseUpdatedAt.current != null && latest.updatedAt !== baseUpdatedAt.current) {
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
      // 提醒控件值为 dayjs，落库前转成 **日历日字符串**。
      // 原来存的是 startOf('day').valueOf()（本地零点时间戳），
      // 而提醒的语义是「某个日历日」不是「某个瞬间」——
      // 换一台时区不同的设备打开就会显示成前一天。
      const reminder = values[REMINDER_FIELD_KEY]
      if (reminder && dayjs.isDayjs(reminder)) {
        values[REMINDER_FIELD_KEY] = reminder.format('YYYY-MM-DD')
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

  const handleCancel = () => {
    form.resetFields()
    onCancel()
  }

  const visibleFields = fields.filter((f) => f.visible)

  return (
    <Modal
      // 标题区手动渲染（kicker + Outfit 800），因此不传 title
      title={null}
      open={open}
      onCancel={handleCancel}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          {item && onDelete ? (
            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => onDelete(item)}>
              {t('common.delete')}
            </Button>
          ) : null}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button onClick={handleCancel}>{t('common.cancel')}</Button>
            <Button type="primary" loading={saving} onClick={handleOk}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      }
      width={760}
      centered
      style={{ maxWidth: 'calc(100vw - 24px)', top: 0 }}
      styles={{ body: { maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' } }}
      destroyOnHidden
    >
      {/* 标题区：mono kicker + Outfit 800 24 标题 */}
      <div style={{ marginBottom: 'var(--s5)' }}>
        <div className="page-kicker">{t('lib.editor.kicker')}</div>
        <h2 className="page-title-sm" style={{ marginTop: 8 }}>
          {item ? t('lib.editor.editTitle') : t('lib.editor.newTitle')}
        </h2>
      </div>

      <Form form={form} layout="vertical" requiredMark={false}>
        <div className="form-grid">
          {visibleFields.map((f, i) => (
            <Form.Item
              key={f.key}
              name={f.key}
              label={<LabelText label={f.label} required={f.required} />}
              rules={f.required ? [{ required: true, message: t('common.requiredField', { name: f.label }) }] : []}
              style={{ marginBottom: 16 }}
              className={f.type === 'textarea' ? 'form-grid-full' : undefined}
            >
              <FieldRenderer field={f} value={null} onChange={() => {}} autoFocus={i === 0} />
            </Form.Item>
          ))}
        </div>
        {visibleFields.length === 0 && (
          <p className="page-sub">{t('lib.editor.noFields')}</p>
        )}

        <div className="divider" />
        <div className="form-grid">
          <Form.Item
            name={REMINDER_FIELD_KEY}
            label={<LabelText label={t('reminder.label')} />}
            style={{ marginBottom: 16 }}
          >
            <DatePicker style={{ width: '100%' }} placeholder={t('reminder.placeholder')} allowClear />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(a, b) => a[REMINDER_FIELD_KEY] !== b[REMINDER_FIELD_KEY]}>
            {() => {
              const picked = form.getFieldValue(REMINDER_FIELD_KEY)
              if (!picked) return null
              return (
                <Form.Item name={REMINDER_REPEAT_KEY} label={<LabelText label={t('reminder.repeat')} />} style={{ marginBottom: 16 }}>
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
        </div>
        {/*
          提醒依赖浏览器 Notification API。在安卓 App 壳（WebView）里
          window.Notification 根本不存在，notificationSupported() 恒为 false，
          checkAndNotify() 直接 return 0 —— 也就是说设了日期、显示保存成功，
          但永远不会有任何通知。
          之前界面上完全看不出这一点，用户只能自己发现「提醒从来没响过」。
          所以在设置提醒的地方直接说明它在这个环境里会不会生效。
        */}
        {notifyState !== 'ok' && (
          <div
            className="panel"
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              padding: '10px 12px',
              borderLeft: '6px solid var(--accent-2)',
              background: 'var(--surface)',
            }}
          >
            <InfoCircleOutlined style={{ fontSize: 16, color: 'var(--accent-2)', flexShrink: 0, marginTop: 1 }} aria-hidden />
            <span className="field-hint" style={{ lineHeight: 1.5 }}>
              {t(`reminder.unavailable.${notifyState}`)}
            </span>
          </div>
        )}
      </Form>
    </Modal>
  )
}
