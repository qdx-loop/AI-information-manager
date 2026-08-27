import { Modal, Descriptions, Tag, App, Checkbox } from 'antd'
import { useEffect, useState } from 'react'
import type { ItemAction } from '@/ai/tools'
import type { Library, FieldDef, Item } from '@/types'
import { useI18n } from '@/i18n'
import { useAutoConfirm } from '@/ai/autoConfirm'

interface Props {
  open: boolean
  action: ItemAction | null
  library: Library | undefined
  fields: FieldDef[]
  existingItem: Item | null
  onConfirm: () => Promise<void>
  onCancel: () => void
}

// 动作标签在组件内按语言生成

const ACTION_COLOR: Record<ItemAction['action'], string> = {
  create: 'green',
  update: 'orange',
  delete: 'red',
}

export default function ConfirmActionModal({
  open,
  action,
  library,
  fields,
  existingItem,
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

  if (!action) return null

  const handleOk = async () => {
    if (always) setAlwaysAllowFor('item')
    setLoading(true)
    try {
      await onConfirm()
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const visibleFields = fields.filter((f) => f.visible)

  return (
    <Modal
      title={
        <span>
          {t('ai.confirm.itemTitle')} <Tag color={ACTION_COLOR[action.action]}>{t('ai.action.' + action.action)}</Tag>
        </span>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText={t('ai.confirm.ok')}
      cancelText={t('common.cancel')}
      okType={action.action === 'delete' ? 'danger' : 'primary'}
      confirmLoading={loading}
      width={560}
    >
      {action.reason && (
        <p style={{ background: '#f6ffed', padding: 12, borderRadius: 6, marginBottom: 16 }}>
          <strong>{t('ai.confirm.reason')}</strong>
          {action.reason}
        </p>
      )}

      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label={t('ai.confirm.targetLib')}>
          {library?.name ?? action.libraryId}
        </Descriptions.Item>
        {action.action !== 'create' && (
          <Descriptions.Item label={t('ai.confirm.targetItem')}>{action.itemId}</Descriptions.Item>
        )}
        {action.action !== 'delete' && (
          <Descriptions.Item label={t('ai.confirm.fields')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {visibleFields.map((f) => {
                const newVal = action.fields?.[f.key]
                const oldVal = existingItem?.fields[f.key]
                const changed =
                  action.action === 'create' || String(newVal) !== String(oldVal)
                return (
                  <div key={f.key} style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: 'var(--ant-color-text-secondary)', minWidth: 80 }}>{f.label}:</span>
                    <span>
                      {action.action === 'update' && changed ? (
                        <>
                          <span style={{ textDecoration: 'line-through', color: '#ccc' }}>
                            {String(oldVal ?? '-')}
                          </span>
                          <span style={{ margin: '0 4px' }}>→</span>
                          <span style={{ color: '#fa8c16', fontWeight: 500 }}>
                            {String(newVal ?? '-')}
                          </span>
                        </>
                      ) : (
                        String(newVal ?? '-')
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          </Descriptions.Item>
        )}
      </Descriptions>

      <Checkbox
        checked={always}
        onChange={(e) => setAlways(e.target.checked)}
        disabled={alwaysAllowFor.has('item')}
        style={{ marginTop: 10, fontSize: 12 }}
      >
        本轮会话后续此类操作不再询问
      </Checkbox>

      <p style={{ marginTop: 12, color: 'var(--ant-color-text-secondary)', fontSize: 12 }}>
        {t('ai.confirm.note')}
      </p>
    </Modal>
  )
}
