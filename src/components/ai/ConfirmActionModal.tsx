import { App } from 'antd'
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Text,
} from '@fluentui/react-components'
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

/**
 * AI 写操作的确认弹窗（v10 Fluent Dialog）。
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

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onCancel()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>
            <Text size={500} weight="semibold">
              {t('ai.confirm.itemTitle')}
            </Text>
          </DialogTitle>
          <DialogContent>
            <div className="ai-confirm">
              {/* 头部一行：动作 + 目标库名 */}
              <div className="ai-confirm-head">
                <Text
                  size={300}
                  weight="semibold"
                  className={`ai-confirm-action${isDelete ? ' ai-confirm-action--danger' : ''}`}
                >
                  {actionLabel}
                </Text>
                <Text size={200} className="ai-confirm-target">
                  {library?.name ?? action.libraryId}
                </Text>
              </div>

              {action.reason && (
                <p className="ai-confirm-reason">
                  <span>{t('ai.confirm.reason')}</span>
                  {action.reason}
                </p>
              )}

              {/* 删除：渲染被删条目的只读快照（用户必须能核对删的是什么） */}
              {isDelete ? (
                <div className="ai-confirm-block">
                  <Text size={200} className="ai-confirm-kicker">
                    {t('ai.confirm.snapshot')}
                  </Text>
                  {existingItem ? (
                    <>
                      {(visibleFields.length > 0 ? visibleFields : fields).map((f) => (
                        <div key={f.key} className="ai-confirm-row">
                          <Text size={200} className="ai-confirm-label">
                            {f.label}
                          </Text>
                          <Text size={200} className="ai-confirm-value">
                            {String(existingItem.fields[f.key] ?? '—')}
                          </Text>
                        </div>
                      ))}
                      <Text size={100} font="monospace" className="ai-confirm-id">
                        {existingItem.id}
                      </Text>
                    </>
                  ) : (
                    <Text size={200} className="ai-confirm-missing">
                      {t('ai.confirm.snapshotMissing')}
                      <code style={{ marginLeft: 6 }}>{action.itemId ?? '—'}</code>
                    </Text>
                  )}
                </div>
              ) : (
                <div className="ai-confirm-block">
                  {action.action !== 'create' && (
                    <Text size={200} className="ai-confirm-kicker">
                      {t('ai.confirm.targetItem')}
                      <code style={{ marginLeft: 6 }}>{action.itemId}</code>
                    </Text>
                  )}
                  {visibleFields.map((f) => {
                    const newVal = action.fields?.[f.key]
                    const oldVal = existingItem?.fields[f.key]
                    const changed = action.action === 'create' || String(newVal) !== String(oldVal)
                    return (
                      <div key={f.key} className="ai-confirm-row">
                        <Text size={200} className="ai-confirm-label">
                          {f.label}
                        </Text>
                        <Text size={200} className="ai-confirm-value">
                          {action.action === 'update' && changed ? (
                            <>
                              <span className="ai-confirm-old">{String(oldVal ?? '-')}</span>
                              <span className="ai-confirm-arrow">→</span>
                              <span className="ai-confirm-new">{String(newVal ?? '-')}</span>
                            </>
                          ) : (
                            <span>{String(newVal ?? '-')}</span>
                          )}
                        </Text>
                      </div>
                    )
                  })}
                </div>
              )}

              {canRemember && (
                <Checkbox
                  className="ai-confirm-check"
                  checked={always}
                  disabled={alreadyRemembered}
                  onChange={(_, data) => setAlways(!!data.checked)}
                  label={t('ai.confirm.always', { action: actionLabel })}
                />
              )}

              <Text
                size={200}
                className={`ai-confirm-note${isDelete ? ' ai-confirm-note--danger' : ''}`}
              >
                {t('ai.confirm.note')}
              </Text>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button
              appearance="primary"
              className={isDelete ? 'ai-confirm-delete' : undefined}
              disabled={loading}
              onClick={() => void handleOk()}
            >
              {t('ai.confirm.ok')}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
