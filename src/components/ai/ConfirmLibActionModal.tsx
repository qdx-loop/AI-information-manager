import { Modal, Descriptions, Tag, App, Checkbox } from 'antd'
import { useEffect, useState } from 'react'
import type { LibraryAction, TemplateAction } from '@/ai/tools'
import type { Library, FieldDef } from '@/types'
import { useI18n } from '@/i18n'
import { useAutoConfirm } from '@/ai/autoConfirm'

const ACTION_COLORS: Record<string, string> = {
  create: 'green',
  rename: 'green',
  delete: 'red',
  setCategory: 'orange',
  addField: 'green',
  updateField: 'orange',
  deleteField: 'red',
}

interface Props {
  open: boolean
  libAction: LibraryAction | null
  tplAction: TemplateAction | null
  library: Library | undefined
  fields: FieldDef[]
  onConfirm: () => Promise<void>
  onCancel: () => void
}

export default function ConfirmLibActionModal({
  open,
  libAction,
  tplAction,
  library,
  fields,
  onConfirm,
  onCancel,
}: Props) {
  const { message } = App.useApp()
  const t = useI18n()
  const [loading, setLoading] = useState(false)
  const { alwaysAllowFor, setAlwaysAllowFor } = useAutoConfirm()
  const [always, setAlways] = useState(false)

  useEffect(() => {
    setLoading(false)
  }, [open])

  const action = libAction ?? tplAction
  if (!action) return null

  const actionKey = action.action
  const isDelete = actionKey === 'delete' || actionKey === 'deleteField'

  const LIB_ACTION_LABEL: Record<string, string> = {
    create: t('ai.action.create'),
    rename: t('common.rename'),
    delete: t('common.delete'),
    setCategory: t('ai.action.update'),
  }
  const TPL_ACTION_LABEL: Record<string, string> = {
    addField: t('lib.tpl.addField'),
    updateField: t('ai.action.update'),
    deleteField: t('ai.action.delete'),
  }
  const FIELD_TYPE_LABEL: Record<string, string> = {
    text: t('lib.tpl.type.text'),
    textarea: t('lib.tpl.type.textarea'),
    number: t('lib.tpl.type.number'),
    date: t('lib.tpl.type.date'),
    select: t('lib.tpl.type.select'),
    checkbox: t('lib.tpl.type.checkbox'),
    rating: t('lib.tpl.type.rating'),
  }
  const actionLabel = (libAction ? LIB_ACTION_LABEL[actionKey] : TPL_ACTION_LABEL[actionKey]) ?? actionKey

  const handleOk = async () => {
    if (always) setAlwaysAllowFor(libAction ? 'lib' : 'tpl')
    setLoading(true)
    try {
      await onConfirm()
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={
        <span>
          {t('ai.confirm.libTitle')} <Tag color={ACTION_COLORS[actionKey]}>{actionLabel}</Tag>
        </span>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText={t('ai.confirm.ok')}
      cancelText={t('common.cancel')}
      okType={isDelete ? 'danger' : 'primary'}
      confirmLoading={loading}
      width={520}
    >
      {(libAction || tplAction)!.reason && (
        <p style={{ background: '#f6ffed', padding: 12, borderRadius: 6, marginBottom: 16 }}>
          <strong>{t('ai.confirm.reason')}</strong>
          {(libAction || tplAction)!.reason}
        </p>
      )}

      {libAction && (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label={t('ai.confirm.lib.op')}>
            {actionLabel}
          </Descriptions.Item>
          {libAction.action !== 'create' && (
            <Descriptions.Item label={t('ai.confirm.lib.targetLib')}>
              {library?.name ?? libAction.libraryId}
            </Descriptions.Item>
          )}
          {(libAction.action === 'create' || libAction.action === 'rename') && libAction.name && (
            <Descriptions.Item label={t('ai.confirm.lib.name')}>{libAction.name}</Descriptions.Item>
          )}
          {(libAction.action === 'create' || libAction.action === 'setCategory') && libAction.category && (
            <Descriptions.Item label={t('ai.confirm.lib.category')}>{libAction.category}</Descriptions.Item>
          )}
        </Descriptions>
      )}

      {tplAction && (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label={t('ai.confirm.lib.targetLib')}>
            {library?.name ?? tplAction.libraryId}
          </Descriptions.Item>
          <Descriptions.Item label={t('ai.confirm.lib.op')}>
            {actionLabel}
          </Descriptions.Item>
          {tplAction.action !== 'addField' && tplAction.fieldId && (
            <Descriptions.Item label="目标字段">
              {fields.find((f) => f.id === tplAction.fieldId)?.label ?? tplAction.fieldId}
            </Descriptions.Item>
          )}
          {tplAction.label && (
            <Descriptions.Item label="字段名">{tplAction.label}</Descriptions.Item>
          )}
          {tplAction.type && (
            <Descriptions.Item label={t('ai.confirm.lib.fieldType')}>
              {FIELD_TYPE_LABEL[tplAction.type ?? ''] ?? tplAction.type}
            </Descriptions.Item>
          )}
          {tplAction.options && tplAction.options.length > 0 && (
            <Descriptions.Item label={t('ai.confirm.lib.options')}>
              {tplAction.options.map((o) => (
                <Tag key={o} style={{ marginBottom: 2 }}>{o}</Tag>
              ))}
            </Descriptions.Item>
          )}
          {tplAction.required !== undefined && (
            <Descriptions.Item label={t('ai.confirm.lib.required')}>
              {tplAction.required ? '是' : '否'}
            </Descriptions.Item>
          )}
          {tplAction.visible !== undefined && (
            <Descriptions.Item label={t('ai.confirm.lib.visible')}>
              {tplAction.visible ? '是' : '否'}
            </Descriptions.Item>
          )}
        </Descriptions>
      )}

      <Checkbox
        checked={always}
        onChange={(e) => setAlways(e.target.checked)}
        disabled={alwaysAllowFor.has(libAction ? 'lib' : 'tpl')}
        style={{ marginTop: 10, fontSize: 12 }}
      >
        本轮会话后续此类操作不再询问
      </Checkbox>

      <p style={{ marginTop: 12, color: 'var(--ant-color-text-secondary)', fontSize: 12 }}>
        {t('ai.confirm.lib.note')}
      </p>
    </Modal>
  )
}
