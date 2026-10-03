import { useEffect, useRef, useState } from 'react'
import { Alert, App, Button, Input, Modal, Space, Spin, Tag, Typography } from 'antd'
import { DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { draftFields, type DraftField } from '@/ai/draftFields'
import { getProvider } from '@/db/providerFactory'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/i18n'
import { newId } from '@/utils/id'
import type { FieldDef } from '@/types'

const { Text } = Typography

const TYPE_LABEL: Record<DraftField['type'], string> = {
  text: '文本',
  textarea: '多行文本',
  number: '数字',
  date: '日期',
  select: '下拉',
  checkbox: '复选框',
  rating: '评分',
}

/**
 * 「让 AI 建议字段」。
 *
 * 入口放在「这个库还没有任何字段」的空状态里，因为那正是用户卡住的地方：
 * 他不是不会用这个应用，是不知道该建哪些字段。
 *
 * 两条原则：
 * 1. **建议不等于写入**。先生成、让用户看、可以逐条删掉，确认后才落库。
 * 2. **失败必须看得见**。这里失败等于功能不存在，所以不静默、不吞异常。
 */
export default function AiFieldsModal({
  open,
  onClose,
  libraryId,
  libraryName,
  existingLabels,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  libraryId: string
  libraryName: string
  existingLabels: string[]
  onCreated?: () => Promise<void> | void
}) {
  const t = useI18n()
  const { message } = App.useApp()
  const settings = useAppStore((s) => s.settings)

  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)
  const [drafts, setDrafts] = useState<DraftField[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [needConfig, setNeedConfig] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // 每次打开都清空上一次的结果，避免上一轮的建议被误当成这一轮的
  useEffect(() => {
    if (!open) return
    setDrafts([])
    setErr(null)
    setHint('')
    setNeedConfig(false)
    return () => abortRef.current?.abort()
  }, [open])

  const run = async () => {
    if (busy) return
    setBusy(true)
    setErr(null)
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const res = await draftFields(
        {
          baseUrl: settings.ai.baseUrl,
          apiKey: settings.ai.apiKey,
          model: settings.ai.model,
          viaProxy: settings.ai.usePlatformAI === true,
        },
        libraryName,
        hint,
        ac.signal,
      )
      setDrafts(res)
    } catch (e) {
      if (ac.signal.aborted) return
      const msg = (e as Error).message || String(e)
      // 配置不完整要单独提示：这是最常见的失败原因，而且有明确的去处
      if (/配置不完整/.test(msg)) setNeedConfig(true)
      setErr(msg)
    } finally {
      if (!ac.signal.aborted) setBusy(false)
    }
  }

  const create = async () => {
    if (drafts.length === 0) return
    setBusy(true)
    try {
      const existing = await getProvider().getTemplate(libraryId)
      const known = new Set([...existing.map((f) => f.label), ...existingLabels])
      const now = Date.now()
      // 已存在的同名字段直接跳过，不要生成重复列
      const fresh = drafts.filter((d) => !known.has(d.label))
      if (fresh.length === 0) {
        message.warning(t('lib.aiFields.failed', { msg: '所有建议的字段都已存在' }))
        return
      }
      const defs: FieldDef[] = fresh.map((d, i) => ({
        id: newId(),
        libraryId,
        key: `k_${newId().slice(0, 8)}`,
        label: d.label,
        type: d.type,
        options: d.options ?? [],
        required: d.required,
        visible: true,
        sortOrder: existing.length + i,
        updatedAt: now,
        deletedAt: null,
      }))
      // saveTemplate 会把本次不在册的字段标成墓碑，所以要先带上现有字段
      await getProvider().saveTemplate(libraryId, [...existing, ...defs])
      await onCreated?.()
      message.success(t('lib.aiFields.created', { n: defs.length }))
      onClose()
    } catch (e) {
      message.error(t('lib.aiFields.failed', { msg: (e as Error).message }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('lib.aiFields.title')}
      width={520}
      destroyOnHidden
      footer={
        drafts.length > 0 ? (
          <Space>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="primary" loading={busy} onClick={create}>
              {t('lib.aiFields.create', { n: drafts.length })}
            </Button>
          </Space>
        ) : (
          <Button onClick={onClose}>{t('common.cancel')}</Button>
        )
      }
    >
      <Text type="secondary" style={{ fontSize: 12.5, display: 'block', marginBottom: 12 }}>
        {t('lib.aiFields.desc')}
      </Text>

      <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
        {t('lib.aiFields.hintLabel')}
      </label>
      <Input.TextArea
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        placeholder={t('lib.aiFields.hintPlaceholder')}
        autoSize={{ minRows: 2, maxRows: 4 }}
        style={{ marginBottom: 12 }}
      />

      <Button
        type="primary"
        icon={<ThunderboltOutlined />}
        loading={busy}
        onClick={run}
        disabled={busy}
        block
      >
        {busy ? t('lib.aiFields.thinking') : t('lib.aiFields.generate')}
      </Button>

      {busy && drafts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin />
        </div>
      )}

      {needConfig && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 12 }}
          message={t('lib.aiFields.needConfig')}
        />
      )}
      {err && !needConfig && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 12 }}
          message={t('lib.aiFields.failed', { msg: err })}
        />
      )}

      {drafts.length > 0 && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--app-border-soft)', paddingTop: 12 }}>
          {drafts.map((d, i) => (
            <div
              key={d.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 0',
                borderBottom: '1px solid var(--app-border-soft)',
              }}
            >
              <Text strong style={{ flex: 1, minWidth: 0 }}>
                {d.label}
              </Text>
              {d.required && <Tag color="teal">{t('lib.aiFields.required')}</Tag>}
              <Tag>{TYPE_LABEL[d.type]}</Tag>
              {d.options && d.options.length > 0 && (
                <Text type="secondary" style={{ fontSize: 11.5 }}>
                  {d.options.join(' / ')}
                </Text>
              )}
              <Button
                type="text"
                size="small"
                danger
                aria-label={t('lib.aiFields.remove', { label: d.label })}
                icon={<DeleteOutlined />}
                onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}
              />
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}