import { Modal, Descriptions, Tag, App } from 'antd'
import { useEffect, useState } from 'react'
import type { LibraryAction, TemplateAction } from '@/ai/tools'
import type { Library, FieldDef } from '@/types'

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: '文本（单行）',
  textarea: '文本（多行）',
  number: '数字',
  date: '日期',
  select: '下拉单选',
  checkbox: '复选框',
  rating: '评分',
}

const ACTION_LABELS: Record<string, string> = {
  create: '新建管理库',
  rename: '重命名管理库',
  delete: '删除管理库',
  setCategory: '修改分类',
  addField: '新增字段',
  updateField: '修改字段',
  deleteField: '删除字段',
}

const ACTION_COLORS: Record<string, string> = {
  create: 'green',
  rename: 'blue',
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
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(false)
  }, [open])

  const action = libAction ?? tplAction
  if (!action) return null

  const actionKey = action.action
  const isDelete = actionKey === 'delete' || actionKey === 'deleteField'

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

  return (
    <Modal
      title={
        <span>
          AI 请求执行操作 <Tag color={ACTION_COLORS[actionKey]}>{ACTION_LABELS[actionKey]}</Tag>
        </span>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="确认执行"
      cancelText="取消"
      okType={isDelete ? 'danger' : 'primary'}
      confirmLoading={loading}
      width={520}
    >
      {(libAction || tplAction)!.reason && (
        <p style={{ background: '#f6ffed', padding: 12, borderRadius: 6, marginBottom: 16 }}>
          <strong>AI 理由：</strong>
          {(libAction || tplAction)!.reason}
        </p>
      )}

      {libAction && (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="操作">
            {ACTION_LABELS[libAction.action]}
          </Descriptions.Item>
          {libAction.action !== 'create' && (
            <Descriptions.Item label="目标管理库">
              {library?.name ?? libAction.libraryId}
            </Descriptions.Item>
          )}
          {(libAction.action === 'create' || libAction.action === 'rename') && libAction.name && (
            <Descriptions.Item label="名称">{libAction.name}</Descriptions.Item>
          )}
          {(libAction.action === 'create' || libAction.action === 'setCategory') && libAction.category && (
            <Descriptions.Item label="分类">{libAction.category}</Descriptions.Item>
          )}
        </Descriptions>
      )}

      {tplAction && (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="目标管理库">
            {library?.name ?? tplAction.libraryId}
          </Descriptions.Item>
          <Descriptions.Item label="操作">
            {ACTION_LABELS[tplAction.action]}
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
            <Descriptions.Item label="字段类型">
              {FIELD_TYPE_LABELS[tplAction.type] ?? tplAction.type}
            </Descriptions.Item>
          )}
          {tplAction.options && tplAction.options.length > 0 && (
            <Descriptions.Item label="选项">
              {tplAction.options.map((o) => (
                <Tag key={o} style={{ marginBottom: 2 }}>{o}</Tag>
              ))}
            </Descriptions.Item>
          )}
          {tplAction.required !== undefined && (
            <Descriptions.Item label="是否必填">
              {tplAction.required ? '是' : '否'}
            </Descriptions.Item>
          )}
          {tplAction.visible !== undefined && (
            <Descriptions.Item label="是否可见">
              {tplAction.visible ? '是' : '否'}
            </Descriptions.Item>
          )}
        </Descriptions>
      )}

      <p style={{ marginTop: 12, color: '#999', fontSize: 12 }}>
        确认后将立即生效。删除管理库可从回收站恢复。
      </p>
    </Modal>
  )
}
