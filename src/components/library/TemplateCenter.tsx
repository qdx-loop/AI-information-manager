import { useMemo, useState, type ReactNode } from 'react'
import { Modal, Checkbox, Input, App } from 'antd'
import {
  AppstoreOutlined,
  TeamOutlined,
  InboxOutlined,
  HomeOutlined,
  HeartOutlined,
  AccountBookOutlined,
  IdcardOutlined,
  CheckSquareOutlined,
  CarOutlined,
  WarningOutlined,
  MedicineBoxOutlined,
} from '@/components/common/icons'
import { useNavigate } from 'react-router-dom'
import { LIB_TEMPLATES, applyTemplate, applySampleData, type LibTemplate } from '@/utils/libraryTemplates'
import { useLibraryStore } from '@/store/libraryStore'
import { useAuthStore } from '@/store/authStore'
import { useI18n } from '@/i18n'

import { consumeTopOverlay, useBackButtonLayer } from '@/utils/backButton'
import { useLibText } from './labels'

/** 模板图标：每个模板一个 Fluent 线性图标 */
const TPL_ICONS: Record<string, ReactNode> = {
  customer: <TeamOutlined />,
  inventory: <InboxOutlined />,
  realestate: <HomeOutlined />,
  fitness: <HeartOutlined />,
  ledger: <AccountBookOutlined />,
  staff: <IdcardOutlined />,
  tasks: <CheckSquareOutlined />,
  vehicle: <CarOutlined />,
  mistakes: <WarningOutlined />,
  medicine: <MedicineBoxOutlined />,
}

/**
 * 模板中心（v9 Win11 ContentDialog）。
 *
 * 左侧 = Win11 导航列表（分组 + 图标 + 名称 + 字段数，选中 = accent-soft + 左 3px）；
 * 右侧 = 模板预览（标题 18 semibold + 说明 + 字段设置式列表 + 附带示例数据 + 主按钮）。
 *
 * 业务逻辑（建库 → 套字段 → 可选示例数据 → 跳转）与原来完全一致。
 */
export default function TemplateCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const t = useI18n()
  const lt = useLibText()
  const { account } = useAuthStore()
  const { createLibrary, selectLibrary, loadLibraries } = useLibraryStore()
  const [withSample, setWithSample] = useState(true)

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

  const applyLibTemplate = (tpl: LibTemplate) => {
    let name = tpl.name
    modal.confirm({
      icon: null,
      title: t('tpl.center.nameTitle', { name: tpl.name }),
      content: (
        <Input
          defaultValue={tpl.name}
          placeholder={t('app.lib.namePlaceholder')}
          onChange={(e) => (name = e.target.value)}
        />
      ),
      okText: t('common.create'),
      onOk: async () => {
        const finalName = name.trim() || tpl.name
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
          // 它卸载时 cleanup 会 history.back()。而 back() 是**异步**的 ——
          // 即使 navigate 带 replace，那次 back() 仍会在之后落到上一个条目，
          // 把刚跳过去的库页弹回首页（实测：库建好了、数据写进去了、「已创建」也弹了，
          // 页面却纹丝不动停在 /，用户以为没生效）。
          // consumeTopOverlay() 把栈顶标记为已处理，cleanup 就不再回退。
          consumeTopOverlay()
          onClose()
          navigate(`/library/${id}`, { replace: true })
        } catch (e) {
          message.error(t('home.create.failed', { msg: (e as Error).message }))
        }
      },
    })
  }

  useBackButtonLayer(open, onClose)

  return (
    <Modal
      title={t('tpl.center.title')}
      open={open}
      onCancel={onClose}
      footer={null}
      width={880}
      style={{ maxWidth: 'calc(100vw - 24px)' }}
      destroyOnHidden
    >
      <p className="lib-dialog-sub">{t('tpl.center.subtitle')}</p>

      {grouped.length === 0 ? (
        <p className="lib-dialog-sub">{t('lib.tpl.empty')}</p>
      ) : (
        <div className="lib-tpl">
          {/* 左：模板导航列表（分组 + 选中 accent-soft + 左 3px） */}
          <div className="lib-tpl-nav">
            <div className="lib-tpl-nav-scroll">
              {grouped.map(([cat, tpls]) => (
                <div key={cat}>
                  <div className="lib-tpl-group">{cat}</div>
                  {tpls.map((tpl) => {
                    const on = tpl.key === selectedKey
                    return (
                      <button
                        key={tpl.key}
                        type="button"
                        className={`lib-tpl-item${on ? ' is-active' : ''}`}
                        aria-current={on ? 'true' : undefined}
                        onClick={() => setSelectedKey(tpl.key)}
                      >
                        <span className="lib-tpl-icon" aria-hidden>
                          {TPL_ICONS[tpl.key] ?? <AppstoreOutlined />}
                        </span>
                        <span className="lib-tpl-main">
                          <span className="lib-tpl-name">{tpl.name}</span>
                          <span className="lib-tpl-meta">
                            {tpl.fields.length} {t('tpl.center.fields')}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* 右：模板预览（标题 + 说明 + 字段设置式列表 + 主按钮） */}
          <div className="lib-tpl-preview">
            {selected ? (
              <>
                <div className="lib-tpl-preview-head">
                  <div className="lib-tpl-preview-title">{selected.name}</div>
                  <span className="w-tag">{lt('center.fieldsCount', { n: selected.fields.length })}</span>
                </div>
                <p className="lib-tpl-preview-desc">{selected.desc}</p>
                <div className="lib-tpl-fields">
                  {selected.fields.map((f) => (
                    <div key={f.key} className="lib-tpl-field-row">
                      <span className="lib-tpl-field-name">{f.label}</span>
                      <span className="w-tag">{t(`lib.tpl.type.${f.type}`)}</span>
                    </div>
                  ))}
                </div>
                <div className="lib-tpl-foot">
                  <Checkbox checked={withSample} onChange={(e) => setWithSample(e.target.checked)}>
                    {t('tpl.center.sample')}
                  </Checkbox>
                  <span className="lib-tpl-foot-spacer" />
                  <button type="button" className="w-btn w-btn--accent" onClick={() => applyLibTemplate(selected)}>
                    {t('tpl.center.use')}
                  </button>
                </div>
              </>
            ) : (
              <p className="lib-dialog-sub">{t('lib.tpl.empty')}</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
