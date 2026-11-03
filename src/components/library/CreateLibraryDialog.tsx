import { useEffect, useMemo, useState } from 'react'
import { Button, Dropdown, Field, Input, Option } from '@fluentui/react-components'
import { App } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useLibraryStore } from '@/store/libraryStore'
import { useI18n } from '@/i18n'
import { LIB_TEMPLATES, applyTemplate, copyTemplateToLibrary } from '@/utils/libraryTemplates'
import { consumeTopOverlay, useBackButtonLayer } from '@/utils/backButton'
import { getProvider } from '@/db/providerFactory'
import { LibDialog } from './labels'

/**
 * 新建管理库 —— 全应用唯一的建库入口（v10 Fluent Dialog）。
 *
 * 业务逻辑（唯一入口、空名/失败时撑住弹窗、选父库时继承字段结构、
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
  const [nameError, setNameError] = useState('')

  // 每次打开重置，并接受外部传入的默认父库
  useEffect(() => {
    if (open) {
      setName('')
      setParentId(defaultParentId)
      setTplKey('blank')
      setCreating(false)
      setNameError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在打开时重置
  }, [open])

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
  useBackButtonLayer(open, onClose)

  const handleOk = async () => {
    if (creating) return
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError(t('app.lib.nameRequired'))
      message.warning(t('app.lib.nameRequired'))
      return
    }
    setCreating(true)
    try {
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
      message.success(
        tpl && tpl.fields.length > 0
          ? t('home.create.doneTpl', { name: trimmed })
          : t('home.create.done', { name: trimmed }),
      )
      setCreating(false)
      onCreated?.(id)
      // 关闭前先消费掉栈顶：否则 cleanup 里那次异步 history.back() 会把
      // 刚做的导航撤销掉（实测会停在 /）。详见 backButton.ts 的说明。
      consumeTopOverlay()
      onClose()
      navigate(`/library/${id}`, { replace: true })
    } catch (e) {
      setCreating(false)
      message.error(t('home.create.failed', { msg: (e as Error).message }))
    }
  }

  const parentLabel = parentOptions.find((o) => o.value === parentId)?.label ?? ''
  const tplLabel = LIB_TEMPLATES.find((x) => x.key === tplKey)?.name ?? LIB_TEMPLATES[0]?.name ?? ''

  return (
    <LibDialog
      open={open}
      onClose={() => {
        if (!creating) onClose()
      }}
      title={t('home.create.modalTitle')}
      width="min(520px, calc(100vw - 32px))"
      actions={
        <div className="lib-dialog-footer">
          <span className="lib-dialog-footer-spacer" />
          <Button appearance="secondary" onClick={onClose} disabled={creating}>
            {t('common.cancel')}
          </Button>
          <Button appearance="primary" onClick={handleOk} disabled={creating}>
            {creating ? t('common.loading') : t('home.create.ok')}
          </Button>
        </div>
      }
    >
      <Field label={t('home.create.nameLabel')} required validationMessage={nameError} validationState={nameError ? 'error' : 'none'}>
        <Input
          value={name}
          autoFocus
          disabled={creating}
          placeholder={t('home.create.placeholder')}
          onChange={(_, data) => {
            setName(data.value)
            if (nameError) setNameError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleOk()
          }}
        />
      </Field>

      <Field label={t('home.create.parentLabel')}>
        <Dropdown
          value={parentLabel}
          selectedOptions={parentId ? [parentId] : []}
          clearable
          disabled={creating}
          placeholder={t('home.create.parentHint')}
          onOptionSelect={(_, data) => setParentId(data.optionValue ?? null)}
        >
          {parentOptions.map((o) => (
            <Option key={o.value} value={o.value} text={o.label}>
              {o.label}
            </Option>
          ))}
        </Dropdown>
      </Field>

      <Field label={t('home.create.tplLabel')} hint={t('home.create.tplHint')}>
        <Dropdown
          value={tplLabel}
          selectedOptions={[tplKey]}
          disabled={creating}
          onOptionSelect={(_, data) => {
            if (data.optionValue) setTplKey(data.optionValue)
          }}
        >
          {LIB_TEMPLATES.map((x) => (
            <Option key={x.key} value={x.key} text={`${x.name} · ${x.desc}`}>
              {`${x.name} · ${x.desc}`}
            </Option>
          ))}
        </Dropdown>
      </Field>
    </LibDialog>
  )
}
