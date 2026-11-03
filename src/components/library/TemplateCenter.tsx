import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Checkbox,
  Field,
  Input,
  Text,
} from '@fluentui/react-components'
import {
  BookRegular,
  CheckboxCheckedRegular,
  ContactCardRegular,
  GridRegular,
  HeartRegular,
  HomeRegular,
  MailInboxRegular,
  PeopleRegular,
  PillRegular,
  VehicleCarRegular,
  WarningRegular,
  type FluentIcon,
} from '@fluentui/react-icons'
import { App } from 'antd'
import { useNavigate } from 'react-router-dom'
import { LIB_TEMPLATES, applyTemplate, applySampleData, type LibTemplate } from '@/utils/libraryTemplates'
import { useLibraryStore } from '@/store/libraryStore'
import { useAuthStore } from '@/store/authStore'
import { useI18n } from '@/i18n'
import { consumeTopOverlay, useBackButtonLayer } from '@/utils/backButton'
import { LibConfirm, LibDialog, useLibText } from './labels'

/** 模板图标：每个模板一个 Fluent 线性图标 */
const TPL_ICONS: Record<string, FluentIcon> = {
  customer: PeopleRegular,
  inventory: MailInboxRegular,
  realestate: HomeRegular,
  fitness: HeartRegular,
  ledger: BookRegular,
  staff: ContactCardRegular,
  tasks: CheckboxCheckedRegular,
  vehicle: VehicleCarRegular,
  mistakes: WarningRegular,
  medicine: PillRegular,
}

/**
 * 模板中心（v10 Fluent Dialog）。
 *
 * 左侧 = 模板导航列表（分组 + 图标 + 名称 + 字段数，选中 = Fluent subtle-selected + 左 3px）；
 * 右侧 = 模板预览（标题 + 说明 + 字段列表 + 附带示例数据 + 主按钮）。
 * 业务逻辑（建库 → 套字段 → 可选示例数据 → 跳转）与原来完全一致。
 */
export default function TemplateCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const t = useI18n()
  const lt = useLibText()
  const { account } = useAuthStore()
  const { createLibrary, selectLibrary, loadLibraries } = useLibraryStore()
  const [withSample, setWithSample] = useState(true)
  const [pendingTpl, setPendingTpl] = useState<LibTemplate | null>(null)
  const [pendingName, setPendingName] = useState('')
  const [creating, setCreating] = useState(false)

  const grouped = useMemo(() => {
    const map = new Map<string, LibTemplate[]>()
    for (const tpl of LIB_TEMPLATES) {
      if (tpl.key === 'blank') continue
      map.set(tpl.category, [...(map.get(tpl.category) ?? []), tpl])
    }
    return Array.from(map.entries())
  }, [])

  // 默认选中第一个模板，右栏永远有内容可看
  const [selectedKey, setSelectedKey] = useState<string>(() => {
    for (const tpl of LIB_TEMPLATES) if (tpl.key !== 'blank') return tpl.key
    return ''
  })
  const selected = LIB_TEMPLATES.find((x) => x.key === selectedKey) ?? null

  // 打开时重置创建对话框
  useEffect(() => {
    if (!open) {
      setPendingTpl(null)
      setCreating(false)
    }
  }, [open])

  const openCreate = (tpl: LibTemplate) => {
    setPendingName(tpl.name)
    setPendingTpl(tpl)
  }

  const confirmCreate = async () => {
    const tpl = pendingTpl
    if (!tpl || creating) return
    const finalName = pendingName.trim() || tpl.name
    setCreating(true)
    try {
      const id = await createLibrary(finalName, tpl.category)
      await applyTemplate(id, tpl)
      let sampleCount = 0
      if (withSample && account) sampleCount = await applySampleData(id, account.id, tpl)
      await loadLibraries()
      await selectLibrary(id)
      message.success(
        sampleCount > 0
          ? t('tpl.center.createdSample', { name: finalName, n: sampleCount })
          : t('tpl.center.created', { name: finalName }),
      )
      // 必须先消费栈顶再关：TemplateCenter 用 useBackButtonLayer 压了一个历史条目，
      // 它卸载时 cleanup 会 history.back()（异步），把刚做的导航撤销掉。
      consumeTopOverlay()
      setPendingTpl(null)
      onClose()
      navigate(`/library/${id}`, { replace: true })
    } catch (e) {
      setCreating(false)
      message.error(t('home.create.failed', { msg: (e as Error).message }))
    }
  }

  useBackButtonLayer(open, onClose)

  return (
    <>
      <LibDialog
        open={open}
        onClose={onClose}
        title={t('tpl.center.title')}
        width="min(920px, calc(100vw - 32px))"
        contentClassName="lib-dialog-content"
        actions={
          <div className="lib-dialog-footer">
            <span className="lib-dialog-footer-spacer" />
            <Button appearance="secondary" onClick={onClose}>
              {t('common.close')}
            </Button>
            {selected ? (
              <Button appearance="primary" onClick={() => openCreate(selected)}>
                {t('tpl.center.use')}
              </Button>
            ) : null}
          </div>
        }
      >
        <Text size={200} className="lib-dialog-sub">
          {t('tpl.center.subtitle')}
        </Text>

        {grouped.length === 0 ? (
          <Text size={200} className="lib-dialog-sub">
            {t('lib.tpl.empty')}
          </Text>
        ) : (
          <div className="lib-tpl">
            {/* 左：模板导航列表（分组 + 选中 subtle-selected + 左 3px） */}
            <div className="lib-tpl-nav">
              <div className="lib-tpl-nav-scroll">
                {grouped.map(([cat, tpls]) => (
                  <div key={cat}>
                    <div className="lib-tpl-group">{cat}</div>
                    {tpls.map((tpl) => {
                      const on = tpl.key === selectedKey
                      const Icon = TPL_ICONS[tpl.key] ?? GridRegular
                      const fields = `${tpl.fields.length} ${t('tpl.center.fields')}`
                      return (
                        <Button
                          key={tpl.key}
                          appearance="subtle"
                          className={`lib-tpl-item${on ? ' is-active' : ''}`}
                          aria-current={on ? 'true' : undefined}
                          icon={<Icon />}
                          onClick={() => setSelectedKey(tpl.key)}
                        >
                          <span className="lib-tpl-item-main">
                            <span className="lib-tpl-item-name">{tpl.name}</span>
                            <span className="lib-tpl-item-meta">{fields}</span>
                          </span>
                        </Button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* 右：模板预览 */}
            <div className="lib-tpl-preview">
              {selected ? (
                <>
                  <div className="lib-tpl-head">
                    <Text size={500} weight="semibold">
                      {selected.name}
                    </Text>
                    <Badge appearance="tint" color="brand" size="small">
                      {lt('center.fieldsCount', { n: selected.fields.length })}
                    </Badge>
                  </div>
                  <Text size={200} className="lib-tpl-desc">
                    {selected.desc}
                  </Text>
                  <div className="lib-tpl-fields">
                    {selected.fields.map((f) => (
                      <div key={f.key} className="lib-tpl-field-row">
                        <span className="lib-tpl-field-name">{f.label}</span>
                        <Badge appearance="outline" color="subtle" size="small">
                          {t(`lib.tpl.type.${f.type}`)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <div className="lib-tpl-foot">
                    <Checkbox
                      checked={withSample}
                      onChange={(_, data) => setWithSample(data.checked === true)}
                      label={t('tpl.center.sample')}
                    />
                    <span className="lib-tpl-foot-spacer" />
                  </div>
                </>
              ) : (
                <Text size={200} className="lib-dialog-sub">
                  {t('lib.tpl.empty')}
                </Text>
              )}
            </div>
          </div>
        )}
      </LibDialog>

      {/* 用模板建库：命名对话框（替代旧版 modal.confirm + 内嵌 Input） */}
      <LibConfirm
        open={pendingTpl !== null}
        title={pendingTpl ? t('tpl.center.nameTitle', { name: pendingTpl.name }) : ''}
        body={
          <Field label={lt('center.newName')} required>
            <Input
              value={pendingName}
              autoFocus
              onChange={(_, data) => setPendingName(data.value)}
              placeholder={t('app.lib.namePlaceholder')}
            />
          </Field>
        }
        confirmText={creating ? t('common.loading') : t('common.create')}
        confirming={creating}
        onConfirm={confirmCreate}
        onClose={() => {
          if (!creating) setPendingTpl(null)
        }}
      />
    </>
  )
}
