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

const T = {
  base: 'var(--text-base, 14px)',
  sm: 'var(--text-sm, 13px)',
  xs: 'var(--text-xs, 12px)',
  xxs: 'var(--text-2xs, 11px)',
}

/**
 * AI 写操作的确认弹窗（改版：宽 400、衬线标题、按钮右对齐、无颜色胶囊）。
 *
 * 两个安全改进（对应 03-ai.md 风险 P0-1 / P0-2）：
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

  return (
    <Modal
      title={
        <span className="serif" style={{ fontSize: 20, lineHeight: 1.4, color: 'var(--app-ink)' }}>
          {t('ai.confirm.itemTitle')}
        </span>
      }
      open={open}
      onCancel={onCancel}
      width={400}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <Button type="text" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            type="primary"
            danger={isDelete}
            loading={loading}
            onClick={() => void handleOk()}
          >
            {t('ai.confirm.ok')}
          </Button>
        </div>
      }
    >
      <div style={{ fontSize: T.base, lineHeight: 1.6, color: 'var(--app-ink)' }}>
        {/* 头部一行：动作 + 目标库名，代替旧的彩色 Tag */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
          <span style={{ color: isDelete ? 'var(--app-danger)' : 'var(--app-accent-text)', fontWeight: 500 }}>
            {actionLabel}
          </span>
          <span style={{ color: 'var(--app-ink-faint)', fontSize: T.sm }}>
            {library?.name ?? action.libraryId}
          </span>
        </div>

        {action.reason && (
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
            {action.reason}
          </p>
        )}

        {/* 删除：渲染被删条目的只读快照（用户必须能核对删的是什么） */}
        {isDelete ? (
          <div style={{ borderTop: '1px solid var(--app-rule)', paddingTop: 12 }}>
            <div
              className="eyebrow"
              style={{
                fontSize: T.xxs,
                letterSpacing: '0.06em',
                fontFamily: 'var(--font-mono)',
                color: 'var(--app-ink-faint)',
                marginBottom: 8,
              }}
            >
              {t('ai.confirm.snapshot')}
            </div>
            {existingItem ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(visibleFields.length > 0 ? visibleFields : fields).map((f) => (
                  <div key={f.key} style={{ display: 'flex', gap: 8, fontSize: T.sm, lineHeight: 1.6 }}>
                    <span style={{ minWidth: 76, flexShrink: 0, color: 'var(--app-ink-faint)' }}>
                      {f.label}
                    </span>
                    <span style={{ minWidth: 0, wordBreak: 'break-word', color: 'var(--app-ink)' }}>
                      {String(existingItem.fields[f.key] ?? '—')}
                    </span>
                  </div>
                ))}
                <div
                  className="mono num"
                  style={{ marginTop: 4, fontSize: T.xxs, color: 'var(--app-ink-faint)' }}
                >
                  {existingItem.id}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: T.sm, color: 'var(--app-ink-faint)' }}>
                {t('ai.confirm.snapshotMissing')}
                <span className="mono" style={{ marginLeft: 6 }}>
                  {action.itemId ?? '—'}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ borderTop: '1px solid var(--app-rule)', paddingTop: 12 }}>
            {action.action !== 'create' && (
              <div
                className="mono"
                style={{ fontSize: T.xxs, color: 'var(--app-ink-faint)', marginBottom: 8 }}
              >
                {t('ai.confirm.targetItem')}
                <span style={{ marginLeft: 6, color: 'var(--app-ink-soft)' }}>{action.itemId}</span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {visibleFields.map((f) => {
                const newVal = action.fields?.[f.key]
                const oldVal = existingItem?.fields[f.key]
                const changed = action.action === 'create' || String(newVal) !== String(oldVal)
                return (
                  <div key={f.key} style={{ display: 'flex', gap: 8, fontSize: T.sm, lineHeight: 1.6 }}>
                    <span style={{ minWidth: 76, flexShrink: 0, color: 'var(--app-ink-faint)' }}>
                      {f.label}
                    </span>
                    <span style={{ minWidth: 0, wordBreak: 'break-word' }}>
                      {action.action === 'update' && changed ? (
                        <>
                          <span
                            style={{
                              textDecorationLine: 'line-through',
                              color: 'var(--app-ink-faint)',
                            }}
                          >
                            {String(oldVal ?? '-')}
                          </span>
                          <span style={{ margin: '0 4px', color: 'var(--app-ink-faint)' }}>→</span>
                          <span style={{ color: 'var(--app-ink)', fontWeight: 500 }}>
                            {String(newVal ?? '-')}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: 'var(--app-ink)' }}>{String(newVal ?? '-')}</span>
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
          {t('ai.confirm.note')}
        </p>
      </div>
    </Modal>
  )
}
