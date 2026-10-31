import { useMemo, useState, type ReactNode } from 'react'
import { Modal, Button, Checkbox, Input, App } from 'antd'
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
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { LIB_TEMPLATES, applyTemplate, applySampleData, type LibTemplate } from '@/utils/libraryTemplates'
import { useLibraryStore } from '@/store/libraryStore'
import { useAuthStore } from '@/store/authStore'
import { useI18n } from '@/i18n'

import { consumeTopOverlay, useBackButtonLayer } from '@/utils/backButton'

/** 模板图标：每个模板一个线性图标（只用 Outlined），比在卡片里放缩略图更克制 */
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
 * 模板中心：按行业分组展示所有模板，一键建库并套用字段结构（可选附带示例数据）。
 *
 * v3：左侧是一列白卡（图标 + 名称 + 字段数），右侧是白纸预览（细线表格 + 字段类型），
 * 选中靠 accent 边框 + wash 底表达。业务逻辑（建库 → 套字段 → 可选示例数据 → 跳转）
 * 与原来完全一致。
 */
export default function TemplateCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const t = useI18n()
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
      style={{ maxWidth: 'calc(100vw - 32px)' }}
    >
      <p className="page-lede" style={{ margin: '0 0 12px' }}>{t('tpl.center.subtitle')}</p>
      <Checkbox checked={withSample} onChange={(e) => setWithSample(e.target.checked)} style={{ marginBottom: 16 }}>
        {t('tpl.center.sample')}
      </Checkbox>

      {grouped.length === 0 ? (
        <p className="faint" style={{ fontSize: 'var(--text-sm)' }}>{t('lib.tpl.empty')}</p>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* 左：模板卡（白卡 + 图标 + 名称 + 字段数），选中 = accent 边框 + wash 底 */}
          <div style={{ width: 300, flexShrink: 0, maxHeight: 440, overflowY: 'auto', paddingRight: 4 }}>
            {grouped.map(([cat, tpls]) => (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div className="eyebrow" style={{ padding: '6px 4px' }}>{cat}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tpls.map((tpl) => {
                    const on = tpl.key === selectedKey
                    return (
                      <button
                        key={tpl.key}
                        type="button"
                        onClick={() => setSelectedKey(tpl.key)}
                        aria-current={on ? 'true' : undefined}
                        className="surface-card"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          width: '100%',
                          padding: '10px 12px',
                          borderColor: on ? 'var(--accent)' : 'var(--border)',
                          background: on ? 'var(--accent-wash)' : 'var(--bg-surface)',
                          boxShadow: on ? '0 0 0 3px var(--accent-ring)' : undefined,
                          font: 'inherit',
                          textAlign: 'left',
                          cursor: 'pointer',
                          color: 'inherit',
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            fontSize: 18,
                            display: 'inline-flex',
                            color: on ? 'var(--accent)' : 'var(--ink-faint)',
                            flexShrink: 0,
                          }}
                        >
                          {TPL_ICONS[tpl.key] ?? <AppstoreOutlined />}
                        </span>
                        <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tpl.name}
                          </span>
                          <span className="faint" style={{ display: 'block', fontSize: 'var(--text-2xs)', marginTop: 2 }}>
                            {tpl.fields.length} {t('tpl.center.fields')}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 右：白纸预览——细线表格，字段名左、类型右 */}
          <div className="surface-card" style={{ flex: '1 1 360px', minWidth: 0, padding: 20 }}>
            {selected ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span className="page-title-sm">{selected.name}</span>
                  <span className="faint" style={{ fontSize: 'var(--text-xs)' }}>
                    {selected.fields.length} {t('tpl.center.fields')}
                  </span>
                </div>
                <p className="muted" style={{ margin: '4px 0 16px', fontSize: 'var(--text-xs)', lineHeight: 1.6 }}>
                  {selected.desc}
                </p>
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {selected.fields.map((f) => (
                    <div
                      key={f.key}
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: 12,
                        height: 36,
                        borderBottom: '1px solid var(--border-rule)',
                      }}
                    >
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.label}
                      </span>
                      <span className="faint" style={{ fontSize: 'var(--text-2xs)', flexShrink: 0 }}>
                        {t(`lib.tpl.type.${f.type}`)}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 20 }}>
                  <Button type="primary" onClick={() => applyLibTemplate(selected)}>
                    {t('tpl.center.use')}
                  </Button>
                </div>
              </>
            ) : (
              <p className="faint" style={{ fontSize: 'var(--text-sm)' }}>{t('lib.tpl.empty')}</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
