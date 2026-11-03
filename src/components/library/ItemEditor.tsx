import { useEffect, useRef, useState } from 'react'
import {
  Button,
  Dropdown,
  Field,
  MessageBar,
  MessageBarBody,
  Option,
  Text,
} from '@fluentui/react-components'
import { App, DatePicker } from 'antd'
import { ClockRegular, DeleteRegular, InfoRegular } from '@fluentui/react-icons'
import dayjs from 'dayjs'
import type { FieldDef, Item, FieldValue } from '@/types'
import FieldRenderer from '@/components/fields/FieldRenderer'
import { useI18n } from '@/i18n'
import { REMINDER_FIELD_KEY, REMINDER_REPEAT_KEY, getReminderAt, getReminderRepeat, isoToLocalTs } from '@/utils/reminder'
import { getProvider } from '@/db/providerFactory'
import { notificationSupported } from '@/utils/reminderNotify'
import { isBlankFieldValue } from '@/utils/fieldValue'
import { LibConfirm, LibDialog, useLibText } from './labels'

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
 * 条目编辑器（v10 Fluent Dialog）。
 *
 * 结构：DialogTitle + 元信息行 + 两列 Fluent Field 网格 + 提醒分区 +
 * 右下角取消/保存（删除在左下角）。
 *
 * 业务逻辑与之前完全一致：并发冲突检测（updatedAt 快照 + 数据库复查，冲突时用
 * Fluent 确认框二次询问）、必填校验、提醒日历日字符串、Notification 不可用提示。
 */
export default function ItemEditor({ open, fields, item, onCancel, onSave, onDelete }: Props) {
  const { message } = App.useApp()
  const t = useI18n()
  const lt = useLibText()

  const [values, setValues] = useState<Record<string, FieldValue>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [reminder, setReminder] = useState<dayjs.Dayjs | null>(null)
  const [repeat, setRepeat] = useState('none')
  const [saving, setSaving] = useState(false)
  const [conflictAt, setConflictAt] = useState<number | null>(null)
  const conflictResolve = useRef<((ok: boolean) => void) | null>(null)

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

  const visibleFields = fields.filter((f) => f.visible)

  /**
   * 打开编辑器时的 updatedAt 快照。同步是 last-write-wins：用户在 A 设备打开条目，
   * 编辑器开着不动，B 设备改同一条并同步过来，用户在 A 上点保存 —— 那次修改会被
   * 静默覆盖。这里记下打开时的版本，保存前比一次，变了就问一句。
   */
  const baseUpdatedAt = useRef<number | null>(null)

  useEffect(() => {
    if (!open) return
    const init: Record<string, FieldValue> = {}
    fields.forEach((f) => {
      init[f.key] = item?.fields[f.key] ?? null
    })
    setValues(init)
    setErrors({})
    // 提醒存的是日历日字符串 'YYYY-MM-DD'，DatePicker 需要 dayjs
    const r = item ? getReminderAt(item) : null
    setReminder(r != null ? dayjs(isoToLocalTs(r)) : null)
    setRepeat(item ? getReminderRepeat(item) : 'none')
    baseUpdatedAt.current = item?.updatedAt ?? null
    // 只在「打开」或「切换条目」时重置：fields 每次 refresh 都是新数组，
    // 放进依赖会把用户正在编辑的草稿静默重置。
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 刻意只放 open 和 item 身份
  }, [open, item?.id])

  /** 冲突二次确认：返回一个 Promise，由 Fluent 确认框的按钮 resolve。 */
  const askConflict = (at: number) =>
    new Promise<boolean>((resolve) => {
      conflictResolve.current = resolve
      setConflictAt(at)
    })

  const handleOk = async () => {
    if (saving) return

    // 先做冲突检查（与旧版顺序一致）：用户填完一屏表单，点保存却被
    // 「是否覆盖」的弹窗打断时，草稿还在、语义清楚。
    if (item) {
      const latest = await getProvider().getItem(item.id)
      if (!latest) {
        message.error(t('item.conflict.deletedBody'))
        return
      } else if (baseUpdatedAt.current != null && latest.updatedAt !== baseUpdatedAt.current) {
        const go = await askConflict(latest.updatedAt)
        if (!go) return
      }
    }

    // 必填校验（同一份规则同时约束弹窗与表格内联编辑）
    const nextErrors: Record<string, string> = {}
    for (const f of visibleFields) {
      if (f.required && isBlankFieldValue(values[f.key])) {
        nextErrors[f.key] = t('common.requiredField', { name: f.label })
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    try {
      const out: Record<string, FieldValue> = { ...values }
      // 提醒落库前转成 **日历日字符串**（不是本地零点时间戳，避免跨时区显示成前一天）
      if (reminder) {
        out[REMINDER_FIELD_KEY] = reminder.format('YYYY-MM-DD')
        out[REMINDER_REPEAT_KEY] = repeat
      } else {
        delete out[REMINDER_FIELD_KEY]
        delete out[REMINDER_REPEAT_KEY]
      }
      await onSave(out)
    } catch (e) {
      if ((e as Error).message) message.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const repeatOptions = [
    { value: 'none', label: t('reminder.repeat.none') },
    { value: 'daily', label: t('reminder.repeat.daily') },
    { value: 'weekly', label: t('reminder.repeat.weekly') },
    { value: 'monthly', label: t('reminder.repeat.monthly') },
  ]
  const repeatLabel = repeatOptions.find((o) => o.value === repeat)?.label ?? repeatOptions[0].label

  return (
    <>
      <LibDialog
        open={open}
        onClose={onCancel}
        title={item ? t('lib.editor.editTitle') : t('lib.editor.newTitle')}
        contentClassName="lib-dialog-content"
        width="min(640px, calc(100vw - 32px))"
        actions={
          <div className="lib-dialog-footer">
            {item && onDelete ? (
              <Button
                appearance="subtle"
                icon={<DeleteRegular />}
                className="lib-editor-delete"
                onClick={() => onDelete(item)}
              >
                {t('common.delete')}
              </Button>
            ) : null}
            <span className="lib-dialog-footer-spacer" />
            <Button appearance="secondary" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button appearance="primary" onClick={handleOk} disabled={saving}>
              {saving ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        }
      >
        {item ? (
          <div className="lib-editor-meta">
            <ClockRegular />
            <Text size={200}>
              {lt('editor.updatedAt')} · {dayjs(item.updatedAt).format('YYYY-MM-DD HH:mm')}
              {item.pinned ? ` · ${t('common.pinned')}` : ''}
            </Text>
          </div>
        ) : null}

        <div className="lib-dialog-content--grid">
          {visibleFields.map((f) => (
            <div key={f.key} className={f.type === 'textarea' ? 'lib-form-full' : undefined}>
              <Field
                label={f.label}
                required={f.required}
                validationMessage={errors[f.key]}
                validationState={errors[f.key] ? 'error' : 'none'}
              >
                <FieldRenderer
                  field={f}
                  value={values[f.key] ?? null}
                  onChange={(v) => {
                    setValues((prev) => ({ ...prev, [f.key]: v }))
                    if (errors[f.key]) setErrors((prev) => ({ ...prev, [f.key]: '' }))
                  }}
                  autoFocus={f.key === visibleFields[0]?.key}
                />
              </Field>
            </div>
          ))}
        </div>
        {visibleFields.length === 0 && (
          <Text size={200} className="lib-dialog-sub">
            {t('lib.editor.noFields')}
          </Text>
        )}

        {/* 提醒分区：分区标题 + 两列控件 */}
        <div className="lib-section">
          <div className="lib-section-head">
            <Text weight="semibold">{lt('editor.reminder')}</Text>
          </div>
          <Text size={200} className="lib-section-desc">
            {lt('editor.reminderDesc')}
          </Text>
          <div className="lib-dialog-content--grid">
            <Field label={t('reminder.label')}>
              <DatePicker
                style={{ width: '100%', fontVariantNumeric: 'tabular-nums' }}
                placeholder={t('reminder.placeholder')}
                value={reminder}
                onChange={(d) => setReminder(d ?? null)}
                allowClear
              />
            </Field>
            {reminder ? (
              <Field label={t('reminder.repeat')}>
                <Dropdown
                  value={repeatLabel}
                  selectedOptions={[repeat]}
                  onOptionSelect={(_, data) => {
                    if (data.optionValue) setRepeat(data.optionValue)
                  }}
                >
                  {repeatOptions.map((o) => (
                    <Option key={o.value} value={o.value} text={o.label}>
                      {o.label}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
            ) : null}
          </div>
        </div>

        {/*
          提醒依赖浏览器 Notification API。安卓 App 壳（WebView）里
          window.Notification 不存在，设了日期、显示保存成功也永远不会有通知；
          这里用 Fluent MessageBar 直接说明它在这个环境里会不会生效。
        */}
        {notifyState !== 'ok' && (
          <MessageBar intent="warning">
            <MessageBarBody>
              <InfoRegular /> {t(`reminder.unavailable.${notifyState}`)}
            </MessageBarBody>
          </MessageBar>
        )}
      </LibDialog>

      {/* 并发冲突二次确认（Fluent Dialog 套 Dialog；只在检测到远端更新时出现） */}
      <LibConfirm
        open={conflictAt !== null}
        title={t('item.conflict.title')}
        body={t('item.conflict.body', { at: conflictAt ? dayjs(conflictAt).format('MM-DD HH:mm') : '' })}
        confirmText={t('item.conflict.overwrite')}
        danger
        onConfirm={() => {
          conflictResolve.current?.(true)
          conflictResolve.current = null
          setConflictAt(null)
        }}
        onClose={() => {
          conflictResolve.current?.(false)
          conflictResolve.current = null
          setConflictAt(null)
        }}
      />
    </>
  )
}
