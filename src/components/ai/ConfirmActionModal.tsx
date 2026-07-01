import { Modal, Descriptions, Tag, App } from 'antd'
import { useEffect, useState } from 'react'
import type { ItemAction } from '@/ai/tools'
import type { Library, FieldDef, Item } from '@/types'

interface Props {
  open: boolean
  action: ItemAction | null
  library: Library | undefined
  fields: FieldDef[]
  existingItem: Item | null
  onConfirm: () => Promise<void>
  onCancel: () => void
}

const ACTION_LABEL: Record<ItemAction['action'], string> = {
  create: '新增条目',
  update: '修改条目',
  delete: '删除条目',
}

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
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(false)
  }, [open])

  if (!action) return null

  const handleOk = async () => {
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
          AI 请求执行操作 <Tag color={ACTION_COLOR[action.action]}>{ACTION_LABEL[action.action]}</Tag>
        </span>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="确认执行"
      cancelText="取消"
      okType={action.action === 'delete' ? 'danger' : 'primary'}
      confirmLoading={loading}
      width={560}
    >
      {action.reason && (
        <p style={{ background: '#f6ffed', padding: 12, borderRadius: 6, marginBottom: 16 }}>
          <strong>AI 理由：</strong>
          {action.reason}
        </p>
      )}

      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="目标管理库">
          {library?.name ?? action.libraryId}
        </Descriptions.Item>
        {action.action !== 'create' && (
          <Descriptions.Item label="目标条目 ID">{action.itemId}</Descriptions.Item>
        )}
        {action.action !== 'delete' && (
          <Descriptions.Item label="字段值">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {visibleFields.map((f) => {
                const newVal = action.fields?.[f.key]
                const oldVal = existingItem?.fields[f.key]
                const changed =
                  action.action === 'create' || String(newVal) !== String(oldVal)
                return (
                  <div key={f.key} style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: '#666', minWidth: 80 }}>{f.label}:</span>
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

      <p style={{ marginTop: 12, color: '#999', fontSize: 12 }}>
        确认后将立即生效。删除操作可从回收站恢复。
      </p>
    </Modal>
  )
}
