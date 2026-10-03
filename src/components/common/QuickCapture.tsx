import { useEffect, useMemo, useState } from 'react'
import { App, Button, Input, Modal, Select, Space, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useLibraryStore } from '@/store/libraryStore'
import { useAuthStore } from '@/store/authStore'
import { getProvider } from '@/db/providerFactory'
import { useI18n } from '@/i18n'
import { newId } from '@/utils/id'
import { FREE_TEXT_KEY } from '@/utils/freeText'
import type { Item, Library } from '@/types'

const { Text } = Typography

/** 兜底速记库的名称：没有它的话，「随手记」就得先建一个库，用���等于回到原来的门槛 */
const INBOX_NAME = '速记'

/**
 * 全局速记。
 *
 * 这一整轮改动的目标是「记录摩擦」，而摩擦的最后一层是**选库**：
 * 想到一句话要先想「这属于哪个库」，然后点进那个库，然后点新建。
 * 于是很多想法根本没被记下来 —— 这是所有捕获优先产品
 * （Apple Notes / Notly / TWO）都在解决、也是它们「2 秒 vs 20 分钟」的差距来源。
 *
 * 所以这里提供一个全局入口：不选库、不配字段，直接写。
 *
 * 落点规则（尽量不让人做选择）：
 * 1. 当前正处在某个库里 → 默认记到那个库（符合直觉）
 * 2. 否则 → 记到一个名为「速记」的库；没有就自动建一个（永远零选择）
 * 仍然可以展开下拉改到别的库 —— 但那是可选的，不是必须的。
 *
 * 内容写进保留键 __text（和零配置速记同一个机制），
 * 所以即使目标库一个字段都没有也存得下来。
 */
export default function QuickCapture({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const t = useI18n()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const account = useAuthStore((s) => s.account)
  const libraries = useLibraryStore((s) => s.libraries)
  const currentLibraryId = useLibraryStore((s) => s.currentLibraryId)
  const loadLibraries = useLibraryStore((s) => s.loadLibraries)
  const selectLibrary = useLibraryStore((s) => s.selectLibrary)
  const bumpDataVersion = useLibraryStore((s) => s.bumpDataVersion)

  const [text, setText] = useState('')
  const [targetId, setTargetId] = useState<string>('')
  const [saving, setSaving] = useState(false)

  // 打开时决定默认落点：当前所在库 > 名为「速记」的库
  useEffect(() => {
    if (!open) return
    setText('')
    const inbox = libraries.find((l) => l.name === INBOX_NAME)
    setTargetId(currentLibraryId ?? inbox?.id ?? '')
  }, [open, currentLibraryId, libraries])

  const options = useMemo(
    () => libraries.map((l) => ({ value: l.id, label: l.name })),
    [libraries],
  )

  /** 没有可用落点时按需建一个「速记」库 */
  const ensureTarget = async (): Promise<Library | null> => {
    if (targetId) {
      const found = libraries.find((l) => l.id === targetId)
      if (found) return found
    }
    const existing = libraries.find((l) => l.name === INBOX_NAME)
    if (existing) return existing
    if (!account) return null
    // 名字撞车就加后缀，避免默默覆盖用户的库
    let name = INBOX_NAME
    for (let i = 2; libraries.some((l) => l.name === name); i++) {
      name = `${INBOX_NAME} ${i}`
    }
    const lib = await getProvider().createLibrary({
      id: newId(),
      accountId: account.id,
      name,
      category: '',
      sortOrder: 9999, // 排最后，别打乱用户自己排的序
      deletedAt: null,
      parentId: null,
      updatedAt: Date.now(),
    } as Library)
    await loadLibraries()
    return lib
  }

  const save = async () => {
    const body = text.trim()
    if (!body || saving) return
    if (!account) {
      message.error(t('common.sessionExpired'))
      return
    }
    setSaving(true)
    try {
      const lib = await ensureTarget()
      if (!lib) throw new Error(t('quickCapture.noTarget'))

      const now = Date.now()
      const items = await getProvider().listItems(lib.id)
      const order = items.reduce((m, i) => Math.max(m, i.sortOrder), -1) + 1
      const item: Item = {
        id: newId(),
        libraryId: lib.id,
        accountId: account.id,
        // 只写 __text：目标库可能一个字段都没有（那就正好对应零配置速记）
        fields: { [FREE_TEXT_KEY]: body },
        pinned: false,
        sortOrder: order,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      await getProvider().createItem(item)

      // 让当前界面立刻反映出来：切到目标库并重新载入
      await selectLibrary(lib.id)
      bumpDataVersion()

      const createdNew = !libraries.some((l) => l.id === lib.id)
      message.success(
        createdNew
          ? t('quickCapture.savedNewLib', { name: lib.name })
          : t('quickCapture.saved', { name: lib.name }),
      )
      onClose()
      // 只在「本来没有当前库」时才跳走：正在编辑时把用户弹走是干扰
      if (!currentLibraryId) navigate(`/library/${lib.id}`)
    } catch (e) {
      message.error(t('quickCapture.failed', { msg: (e as Error).message }))
    } finally {
      setSaving(false)
    }
  }

  const targetName =
    libraries.find((l) => l.id === targetId)?.name ??
    libraries.find((l) => l.name === INBOX_NAME)?.name ??
    INBOX_NAME

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('quickCapture.title')}
      width={560}
      destroyOnHidden
      footer={
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('quickCapture.foot', { name: targetName })}
          </Text>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="primary" loading={saving} disabled={!text.trim()} onClick={save}>
            {t('quickCapture.save')}
          </Button>
        </Space>
      }
    >
      <Input.TextArea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('quickCapture.placeholder')}
        autoSize={{ minRows: 4, maxRows: 12 }}
        onPressEnter={(e) => {
          // Ctrl/Cmd+Enter 保存；普通 Enter 换行（多行文本里换行必须是默认行为）
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            void save()
          }
        }}
      />
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('quickCapture.target')}
        </Text>
        <Select
          size="small"
          value={targetId || undefined}
          placeholder={INBOX_NAME}
          onChange={setTargetId}
          options={options}
          style={{ minWidth: 180, maxWidth: 280 }}
          popupMatchSelectWidth
          maxTagCount={1}
        />
      </div>
      <Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginTop: 10 }}>
        {t('quickCapture.hint')}
      </Text>
    </Modal>
  )
}