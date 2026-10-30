import { Modal, Button, App, Checkbox } from 'antd'
import { useEffect, useState } from 'react'
import type { LibraryAction, TemplateAction } from '@/ai/tools'
import type { Library, FieldDef } from '@/types'
import { useI18n } from '@/i18n'
import { autoConfirmKey, isDestructiveAction, useAutoConfirm } from '@/ai/autoConfirm'

import { useBackButtonLayer } from '@/utils/backButton'

const T = {
  base: 'var(--text-base, 14px)',
  sm: 'var(--text-sm, 13px)',
  xs: 'var(--text-xs, 12px)',
  xxs: 'var(--text-2xs, 11px)',
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

interface Row {
  label: string
  value: string
}

/**
 * 管理库 / 字段模板操作的确认弹窗。
 *
 * 与 `ConfirmActionModal` 同语言：宽 400~440、衬线标题、右侧按钮、
 * 「不再询问」按动作粒度授权；**删库 / 删字段永不提供自动放行**
 * （删库连条目一起进回收站、删字段会改模板，两者都不是可轻率重复的动作）。
 */
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
    setAlways(false)
  }, [open])

  const action = libAction ?? tplAction

  // 必须排在 `if (!action) return null` 之前，否则 action 由 null 变有值时
  // React 会因渲染中途新增 Hook 而抛错，整个应用被 ErrorBoundary 打成错误页。
  useBackButtonLayer(open, onCancel)

  if (!action) return null

  const actionKey = action.action
  const isDelete = actionKey === 'delete' || actionKey === 'deleteField'
  const kind = libAction ? 'lib' : 'tpl'
  const key = autoConfirmKey(kind, actionKey)
  const canRemember = !!key && !isDestructiveAction(kind, actionKey)
  const alreadyRemembered = canRemember && alwaysAllowFor.has(key)

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
    if (always && canRemember && key) setAlwaysAllowFor(key)
    setLoading(true)
    try {
      await onConfirm()
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // 结构化行：不再用 Descriptions 的表格外观，改成「标签 + 值」两列文本
  const rows: Row[] = []
  if (libAction) {
    rows.push({ label: t('ai.confirm.lib.op'), value: actionLabel })
    if (libAction.action !== 'create') {
      rows.push({ label: t('ai.confirm.lib.targetLib'), value: library?.name ?? libAction.libraryId ?? '—' })
    }
    if ((libAction.action === 'create' || libAction.action === 'rename') && libAction.name) {
      rows.push({ label: t('ai.confirm.lib.name'), value: libAction.name })
    }
    if ((libAction.action === 'create' || libAction.action === 'setCategory') && libAction.category) {
      rows.push({ label: t('ai.confirm.lib.category'), value: libAction.category })
    }
  }
  if (tplAction) {
    rows.push({ label: t('ai.confirm.lib.targetLib'), value: library?.name ?? tplAction.libraryId })
    rows.push({ label: t('ai.confirm.lib.op'), value: actionLabel })
    if (tplAction.action !== 'addField' && tplAction.fieldId) {
      rows.push({
        label: '目标字段',
        value: fields.find((f) => f.id === tplAction.fieldId)?.label ?? tplAction.fieldId,
      })
    }
    if (tplAction.label) rows.push({ label: '字段名', value: tplAction.label })
    if (tplAction.type) {
      rows.push({ label: t('ai.confirm.lib.fieldType'), value: FIELD_TYPE_LABEL[tplAction.type] ?? tplAction.type })
    }
    if (tplAction.options && tplAction.options.length > 0) {
      rows.push({ label: t('ai.confirm.lib.options'), value: tplAction.options.join('、') })
    }
    if (tplAction.required !== undefined) {
      rows.push({ label: t('ai.confirm.lib.required'), value: tplAction.required ? '是' : '否' })
    }
    if (tplAction.visible !== undefined) {
      rows.push({ label: t('ai.confirm.lib.visible'), value: tplAction.visible ? '是' : '否' })
    }
  }

  return (
    <Modal
      title={
        <span className="serif" style={{ fontSize: 20, lineHeight: 1.4, color: 'var(--app-ink)' }}>
          {t('ai.confirm.libTitle')}
        </span>
      }
      open={open}
      onCancel={onCancel}
      width={440}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <Button type="text" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="primary" danger={isDelete} loading={loading} onClick={() => void handleOk()}>
            {t('ai.confirm.ok')}
          </Button>
        </div>
      }
    >
      <div style={{ fontSize: T.base, lineHeight: 1.6, color: 'var(--app-ink)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
          <span style={{ color: isDelete ? 'var(--app-danger)' : 'var(--app-accent-text)', fontWeight: 500 }}>
            {actionLabel}
          </span>
          <span style={{ color: 'var(--app-ink-faint)', fontSize: T.sm }}>
            {library?.name ?? libAction?.libraryId ?? tplAction?.libraryId ?? ''}
          </span>
        </div>

        {(libAction || tplAction)!.reason && (
          <p
            style={{
              margin: '0 0 16px',
              paddingTop: 10,
              borderTop: '1px solid var(--app-rule)',
              fontSize: T.sm,
              color: 'var(--app-ink-soft)',
            }}
          >
            <span style={{ color: 'var(--app-ink-faint)' }}>{t('ai.confirm.reason')}</span>
            {(libAction || tplAction)!.reason}
          </p>
        )}

        <div style={{ borderTop: '1px solid var(--app-rule)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map((r) => (
            <div key={r.label} style={{ display: 'flex', gap: 8, fontSize: T.sm, lineHeight: 1.6 }}>
              <span style={{ minWidth: 76, flexShrink: 0, color: 'var(--app-ink-faint)' }}>{r.label}</span>
              <span style={{ minWidth: 0, wordBreak: 'break-word', color: 'var(--app-ink)' }}>{r.value}</span>
            </div>
          ))}
        </div>

        {canRemember && (
          <Checkbox
            checked={always}
            disabled={alreadyRemembered}
            onChange={(e) => setAlways(e.target.checked)}
            style={{ marginTop: 14, fontSize: T.xs, color: 'var(--app-ink-soft)' }}
          >
            {t('ai.confirm.always', { action: actionLabel })}
          </Checkbox>
        )}

        <p
          style={{
            marginTop: 12,
            fontSize: T.xs,
            lineHeight: 1.6,
            color: isDelete ? 'var(--app-danger)' : 'var(--app-ink-faint)',
          }}
        >
          {t('ai.confirm.lib.note')}
        </p>
      </div>
    </Modal>
  )
}
