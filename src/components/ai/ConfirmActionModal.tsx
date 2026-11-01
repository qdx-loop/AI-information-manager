import { Modal, Button, App, Checkbox } from 'antd'
import { useEffect, useState } from 'react'
import type { ItemAction } from '@/ai/tools'
import type { Library, FieldDef, Item } from '@/types'
import { useI18n } from '@/i18n'
import { autoConfirmKey, isDestructiveAction, useAutoConfirm } from '@/ai/autoConfirm'

import { useBackButtonLayer } from '@/utils/backButton'

interface Props {
  open: boolean
  action: ItemAction | null
  library: Library | undefined
  fields: FieldDef[]
  existingItem: Item | null
  onConfirm: () => Promise<void>
  onCancel: () => void
}

// v4 §2：弹窗正文 15/1.6，注脚 13，mono 小标签 11，标题 20
const T = {
  body: 'var(--t-base)',
  sm: 'var(--t-sm)',
  mono: 'var(--t-2xs)',
  title: 'var(--t-lg)',
}

/**
 * AI 写操作的确认弹窗（v3：440 宽、标题 20/600、正文 14/1.6、按钮右对齐）。
 *
 * 两个安全改进（对应 03-ai.md 风险 P0-1 / P0-2；本轮只改视觉，逻辑保持）：
 *  1. 删除时渲染**被删条目的只读字段快照**——旧版只显示 itemId，用户无法核对
 *     删的是什么，等于盲签。
 *  2. 「不再询问」按动作粒度授权，且**删除类永不提供**该选项。
 */
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
    setAlways(false)
  }, [open])

  // 必须在任何提前 return 之前调用：Hooks 规则要求每次渲染的调用顺序一致。
  // 原来它排在 `if (!action) return null` 之后 —— action 由 null 变成有值时
  // 渲染中途多出 2 个 Hook，React 直接抛 "Rendered more hooks than during the
  // previous render"，而捕获它的边界是全局 ErrorBoundary，于是「AI 提议一个操作」
  // 就会把整个应用打成错误页。
  useBackButtonLayer(open, onCancel)

  if (!action) return null

  const isDelete = action.action === 'delete'
  const key = autoConfirmKey('item', action.action)
  // 删除类永不自动放行；未登记动作也不给勾选框
  const canRemember = !!key && !isDestructiveAction('item', action.action)
  const alreadyRemembered = canRemember && alwaysAllowFor.has(key)

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

  const visibleFields = fields.filter((f) => f.visible)
  const actionLabel = t('ai.action.' + action.action)
  const labelStyle = { minWidth: 76, flexShrink: 0, color: 'var(--ink-soft)' }

  return (
    <Modal
      title={
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: T.title,
            fontWeight: 700,
            lineHeight: 1.3,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
          }}
        >
          {t('ai.confirm.itemTitle')}
        </span>
      }
      open={open}
      onCancel={onCancel}
      width={440}
      footer={
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--s2)',
            marginTop: 'var(--s1)',
          }}
        >
          <Button type="text" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="primary" danger={isDelete} loading={loading} onClick={() => void handleOk()}>
            {t('ai.confirm.ok')}
          </Button>
        </div>
      }
    >
      <div style={{ fontSize: T.body, lineHeight: 1.6, color: 'var(--ink)' }}>
        {/* 头部一行：动作 + 目标库名 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 'var(--s2)',
            marginBottom: 'var(--s3)',
          }}
        >
          <span style={{ color: isDelete ? 'var(--danger)' : 'var(--signal)', fontWeight: 500 }}>
            {actionLabel}
          </span>
          <span style={{ color: 'var(--ink-soft)', fontSize: T.sm }}>
            {library?.name ?? action.libraryId}
          </span>
        </div>

        {action.reason && (
          <p
            style={{
              margin: '0 0 var(--s4)',
              paddingTop: 'var(--s2)',
              borderTop: '1px solid var(--line-soft)',
              color: 'var(--ink-soft)',
            }}
          >
            <span style={{ color: 'var(--ink-faint)' }}>{t('ai.confirm.reason')}</span>
            {action.reason}
          </p>
        )}

        {/* 删除：渲染被删条目的只读快照（用户必须能核对删的是什么） */}
        {isDelete ? (
          <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 'var(--s3)' }}>
            <div
              className="eyebrow"
              style={{
                fontSize: T.mono,
                letterSpacing: '0.04em',
                color: 'var(--ink-faint)',
                marginBottom: 'var(--s2)',
              }}
            >
              {t('ai.confirm.snapshot')}
            </div>
            {existingItem ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s1)' }}>
                {(visibleFields.length > 0 ? visibleFields : fields).map((f) => (
                  <div key={f.key} style={{ display: 'flex', gap: 'var(--s2)', lineHeight: 1.6 }}>
                    <span style={labelStyle}>{f.label}</span>
                    <span style={{ minWidth: 0, wordBreak: 'break-word', color: 'var(--ink)' }}>
                      {String(existingItem.fields[f.key] ?? '—')}
                    </span>
                  </div>
                ))}
                <div
                  className="mono"
                  style={{ marginTop: 'var(--s1)', fontSize: T.mono, color: 'var(--ink-faint)' }}
                >
                  {existingItem.id}
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--ink-soft)' }}>
                {t('ai.confirm.snapshotMissing')}
                <span className="mono" style={{ marginLeft: 6 }}>
                  {action.itemId ?? '—'}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 'var(--s3)' }}>
            {action.action !== 'create' && (
              <div
                className="mono"
                style={{ fontSize: T.mono, color: 'var(--ink-faint)', marginBottom: 'var(--s2)' }}
              >
                {t('ai.confirm.targetItem')}
                <span style={{ marginLeft: 6, color: 'var(--ink-soft)' }}>{action.itemId}</span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s1)' }}>
              {visibleFields.map((f) => {
                const newVal = action.fields?.[f.key]
                const oldVal = existingItem?.fields[f.key]
                const changed = action.action === 'create' || String(newVal) !== String(oldVal)
                return (
                  <div key={f.key} style={{ display: 'flex', gap: 'var(--s2)', lineHeight: 1.6 }}>
                    <span style={labelStyle}>{f.label}</span>
                    <span style={{ minWidth: 0, wordBreak: 'break-word' }}>
                      {action.action === 'update' && changed ? (
                        <>
                          <span style={{ textDecorationLine: 'line-through', color: 'var(--ink-faint)' }}>
                            {String(oldVal ?? '-')}
                          </span>
                          <span style={{ margin: '0 4px', color: 'var(--ink-faint)' }}>→</span>
                          <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{String(newVal ?? '-')}</span>
                        </>
                      ) : (
                        <span style={{ color: 'var(--ink)' }}>{String(newVal ?? '-')}</span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {canRemember && (
          <Checkbox
            checked={always}
            disabled={alreadyRemembered}
            onChange={(e) => setAlways(e.target.checked)}
            style={{ marginTop: 'var(--s3)', fontSize: T.sm, color: 'var(--ink-soft)' }}
          >
            {t('ai.confirm.always', { action: actionLabel })}
          </Checkbox>
        )}

        <p
          style={{
            marginTop: 'var(--s3)',
            marginBottom: 0,
            fontSize: T.sm,
            lineHeight: 1.6,
            color: isDelete ? 'var(--danger)' : 'var(--ink-soft)',
          }}
        >
          {t('ai.confirm.note')}
        </p>
      </div>
    </Modal>
  )
}
