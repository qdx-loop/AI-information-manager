import { useMemo, useState } from 'react'
import { App, Form, Input, Modal, Select } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useLibraryStore } from '@/store/libraryStore'
import { useI18n } from '@/i18n'
import { LIB_TEMPLATES, applyTemplate, copyTemplateToLibrary } from '@/utils/libraryTemplates'
import { consumeTopOverlay, useBackButtonLayer } from '@/utils/backButton'
import { getProvider } from '@/db/providerFactory'
import { LabelText } from './labels'

/**
 * 新建管理库 —— 全应用唯一的建库入口。
 *
 * 视觉（v9 Win11 ContentDialog）：标题 20 semibold + 表单三行（名称 / 父级 / 字段模板）
 * + 说明 12 次级 + 右下角「取消 / 创建」。不再有 kicker、彩色方块或硬边阴影。
 *
 * 业务逻辑（唯一的建库入口、空名/失败时撑住弹窗、选父库时继承字段结构、
 * 返回键层级、创建后导航）与原来完全一致。
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
  // 父组件如果再登记一次 open，就会压两条历史条目，用户得按两次返回键。
  useBackButtonLayer(open, onClose)

  /** 空名 / 失败时返回一个永不 settle 的 Promise，弹窗就不会被关掉 */
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
      onCancel={onClose}
      width={520}
      centered
      style={{ maxWidth: 'calc(100vw - 24px)', top: 0 }}
      destroyOnHidden
      maskClosable={!creating}
      footer={
        <div className="lib-dialog-footer">
          <span className="lib-dialog-footer-spacer" />
          <button type="button" className="w-btn" onClick={onClose} disabled={creating}>
            {t('common.cancel')}
          </button>
          <button type="button" className="w-btn w-btn--accent" onClick={handleOk} disabled={creating}>
            {creating ? t('common.loading') : t('home.create.ok')}
          </button>
        </div>
      }
    >
      <Form layout="vertical" requiredMark={false} style={{ marginTop: 4 }}>
        <Form.Item
          label={<LabelText label={t('home.create.nameLabel')} required />}
          required
          validateStatus={name.length > 0 && !name.trim() ? 'error' : undefined}
          help={name.length > 0 && !name.trim() ? t('app.lib.nameRequired') : undefined}
          style={{ marginBottom: 14 }}
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
        <Form.Item label={<LabelText label={t('home.create.parentLabel')} />} style={{ marginBottom: 14 }}>
          <Select
            value={parentId ?? undefined}
            onChange={(v) => setParentId(v ?? null)}
            allowClear
            placeholder={t('home.create.parentHint')}
            options={parentOptions}
            disabled={creating}
          />
        </Form.Item>
        <Form.Item label={<LabelText label={t('home.create.tplLabel')} />} style={{ marginBottom: 8 }}>
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
      <div className="lib-dialog-sub" style={{ marginBottom: 0 }}>
        {t('home.create.tplHint')}
      </div>
    </Modal>
  )
}
