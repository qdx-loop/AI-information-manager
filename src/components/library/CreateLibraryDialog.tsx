import { useMemo, useState } from 'react'
import { App, Form, Input, Modal, Select } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useLibraryStore } from '@/store/libraryStore'
import { useI18n } from '@/i18n'
import { LIB_TEMPLATES, applyTemplate, copyTemplateToLibrary } from '@/utils/libraryTemplates'
import { consumeTopOverlay, useBackButtonLayer } from '@/utils/backButton'
import { getProvider } from '@/db/providerFactory'

/**
 * 新建管理库 —— 全应用唯一的建库入口。
 *
 * 之前有两套实现，而且**方向是反的**：
 *   · EmptyHome 的 <Modal>：名称 + 父级 + 行业模板 + 提示
 *     但只在 `libraries.length === 0` 时才渲染（按钮在空态分支里）
 *   · Sidebar 的 modal.confirm：只有名称框，无父级、无模板、无字段标签，
 *     还带 antd 默认的 exclamation-circle（把正常的新建操作画成了警告），
 *     并且「确定」文案与前者不一致
 * 结果是新用户拿到完整版、**所有老用户拿到残废版**，而移动端唯一的建库路径
 * 恰好是 Sidebar 那条。另外 modal.confirm 的 onOk 同步 return 会让弹窗直接关闭，
 * 空名提交只留一个瞬时 toast。
 *
 * 现在两边都渲染这一个受控 <Modal>：字段标签齐全、模板可选、
 * 空名/失败时用一个不 settle 的 Promise 把弹窗撑住不关。
 */
export default function CreateLibraryDialog({
  open,
  onClose,
  /** 预置父库（从某个库的「新建子库」进来时） */
  defaultParentId = null,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  defaultParentId?: string | null
  onCreated?: (id: string) => void
}) {
  const { message } = App.useApp()
  const t = useI18n()
  const navigate = useNavigate()
  const { libraries, createLibrary, selectLibrary, loadLibraries } = useLibraryStore()

  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<string | null>(defaultParentId)
  const [tplKey, setTplKey] = useState('blank')
  const [creating, setCreating] = useState(false)

  // 每次打开重置，并接受外部传入的默认父库
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setName('')
      setParentId(defaultParentId)
      setTplKey('blank')
      setCreating(false)
    }
  }

  /** 带缩进的父级候选树，和侧边栏的分组顺序一致 */
  const parentOptions = useMemo(() => {
    const sorted = [...libraries].sort((a, b) => a.sortOrder - b.sortOrder)
    const byParent = new Map<string | null, typeof sorted>()
    for (const l of sorted) {
      const key = l.parentId ?? null
      byParent.set(key, [...(byParent.get(key) ?? []), l])
    }
    const out: { label: string; value: string }[] = []
    const walk = (pid: string | null, depth: number) => {
      for (const l of byParent.get(pid) ?? []) {
        out.push({
          label: `${'　'.repeat(depth)}${l.name}${l.category ? `（${l.category}）` : ''}`,
          value: l.id,
        })
        walk(l.id, depth + 1)
      }
    }
    walk(null, 0)
    return out
  }, [libraries])

  // 返回键关闭：登记在这一层，因为弹层由本组件渲染、也由本组件负责关。
  // 父组件如果再登记一次 open，就会压两条历史条目，用户得按两次返回键（这正是
  // backButton.ts 注释里写的那个坑）。
  useBackButtonLayer(open, onClose)

  /** 空名 / 失败时返回一个永不 settle 的 Promise，弹窗就不会被 antd 关掉 */
  const stayOpen = () => new Promise<never>(() => {})

  const handleOk = (): Promise<unknown> => {
    const trimmed = name.trim()
    if (!trimmed) {
      message.warning(t('app.lib.nameRequired'))
      return stayOpen()
    }
    setCreating(true)
    return (async () => {
      const id = await createLibrary(trimmed, undefined, parentId)
      const tpl = LIB_TEMPLATES.find((x) => x.key === tplKey)
      if (tpl && tpl.fields.length > 0) {
        await applyTemplate(id, tpl)
      } else if (parentId) {
        // 选了父库但未选行业模板：继承父库字段结构
        try {
          const parentTpl = await getProvider().getTemplate(parentId)
          if (parentTpl.length > 0) await copyTemplateToLibrary(parentTpl, id)
        } catch {
          /* 模板继承失败不阻塞建库 */
        }
      }
      await loadLibraries()
      await selectLibrary(id)
      message.success(tpl && tpl.fields.length > 0 ? t('home.create.doneTpl', { name: trimmed }) : t('home.create.done', { name: trimmed }))
      setCreating(false)
      onCreated?.(id)
      // 受控 open 不会因为 onOk 的 Promise resolve 而自动关闭，所以必须自己关。
      // 关闭前先消费掉栈顶：否则 cleanup 里那次异步 history.back() 会把
      // 刚做的导航撤销掉（实测会停在 /）。详见 backButton.ts 的说明。
      consumeTopOverlay()
      onClose()
      navigate(`/library/${id}`, { replace: true })
    })().catch((e) => {
      setCreating(false)
      message.error(t('home.create.failed', { msg: (e as Error).message }))
      return stayOpen()
    })
  }

  return (
    <Modal
      title={t('home.create.modalTitle')}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText={t('home.create.ok')}
      cancelText={t('common.cancel')}
      confirmLoading={creating}
      destroyOnHidden
      maskClosable={!creating}
    >
      <Form layout="vertical" style={{ marginTop: 8 }} requiredMark={false}>
        <Form.Item
          label={t('home.create.nameLabel')}
          required
          validateStatus={name.length > 0 && !name.trim() ? 'error' : undefined}
          help={name.length > 0 && !name.trim() ? t('app.lib.nameRequired') : undefined}
        >
          <Input
            placeholder={t('home.create.placeholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onPressEnter={handleOk}
            autoFocus
            disabled={creating}
          />
        </Form.Item>
        <Form.Item label={t('home.create.parentLabel')} style={{ marginBottom: 12 }}>
          <Select
            value={parentId ?? undefined}
            onChange={(v) => setParentId(v ?? null)}
            allowClear
            placeholder={t('home.create.parentHint')}
            options={parentOptions}
            disabled={creating}
          />
        </Form.Item>
        <Form.Item label={t('home.create.tplLabel')} style={{ marginBottom: 0 }}>
          <Select
            value={tplKey}
            onChange={setTplKey}
            options={LIB_TEMPLATES.map((x) => ({
              label: `${x.name} · ${x.desc}`,
              value: x.key,
            }))}
            listHeight={260}
            disabled={creating}
          />
        </Form.Item>
      </Form>
      <div style={{ fontSize: 12, color: 'var(--app-muted, #6b7280)', marginTop: 8 }}>{t('home.create.tplHint')}</div>
    </Modal>
  )
}
