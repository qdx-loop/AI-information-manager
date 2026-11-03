import { useEffect, useState } from 'react'
import { Button, Field, Input } from '@fluentui/react-components'
import { App } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useLibraryStore } from '@/store/libraryStore'
import { useI18n } from '@/i18n'
import { consumeTopOverlay, useBackButtonLayer } from '@/utils/backButton'
import { LibDialog } from './labels'

/**
 * 新建管理库 / 新建子库 —— v11 简化版（Fluent Dialog）。
 *
 * 产品决策（2026-11-03 用户反馈）：
 *   1. 不再提供「父级管理库」下拉：子库在该库自己的库页里新建（默认父库由入口传入）；
 *   2. 移除整个「字段模板」功能：建库不再选模板，也不再从父库继承字段结构。
 *      建好后是空白库，直接在库页「字段」里添加该库需要的列。
 *
 * 业务逻辑保持不变：唯一入口、空名/失败时撑住弹窗、返回键层级、
 * create → loadLibraries → selectLibrary → consumeTopOverlay → close → navigate。
 */
export default function CreateLibraryDialog({
  open,
  onClose,
  /** 从某个库页的「新建子库」进来时预置父库；界面上不再让用户选择父库 */
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
  const { createLibrary, selectLibrary, loadLibraries } = useLibraryStore()

  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [nameError, setNameError] = useState('')

  // 每次打开重置，并接受外部传入的默认父库（子库创建入口）
  useEffect(() => {
    if (open) {
      setName('')
      setCreating(false)
      setNameError('')
    }
  }, [open])

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
      const id = await createLibrary(trimmed, undefined, defaultParentId)
      await loadLibraries()
      await selectLibrary(id)
      message.success(t('home.create.done', { name: trimmed }))
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

  const isChild = Boolean(defaultParentId)

  return (
    <LibDialog
      open={open}
      onClose={() => {
        if (!creating) onClose()
      }}
      title={isChild ? t('app.newChild') : t('home.create.modalTitle')}
      width="min(480px, calc(100vw - 32px))"
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
      <Field
        label={t('home.create.nameLabel')}
        required
        validationMessage={nameError}
        validationState={nameError ? 'error' : 'none'}
      >
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
    </LibDialog>
  )
}
