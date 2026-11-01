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

/** 模板图标：每个模板一个线性图标（只用 Outlined），与左侧索引行同一视觉重量 */
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
 * 模板中心（v4 SIGNAL PRESS）。
 *
 * 结构：左侧 = 硬边 panel + `.index-row` 模板索引（编号 01..、名称、字段数），
 * 选中行 lime-wash + 3px ink 左条；右侧 = `.sheet` 纸面预览（细线字段表 + 主按钮）。
 * 业务逻辑（建库 → 套字段 → 可选示例数据 → 跳转）与原来完全一致。
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
      width={920}
      style={{ maxWidth: 'calc(100vw - 24px)' }}
    >
      <div className="page-kicker" style={{ marginBottom: 8 }}>{t('tpl.center.kicker')}</div>
      <p className="page-sub" style={{ marginBottom: 12 }}>{t('tpl.center.subtitle')}</p>
      <Checkbox checked={withSample} onChange={(e) => setWithSample(e.target.checked)} style={{ marginBottom: 16 }}>
        {t('tpl.center.sample')}
      </Checkbox>

      {grouped.length === 0 ? (
        <p className="field-hint">{t('lib.tpl.empty')}</p>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flexWrap: 'wrap' }}>
          {/* 左：模板索引（panel + index-row；选中 lime-wash + 3px ink 左条） */}
          <div className="panel" style={{ width: 320, flexShrink: 0, maxHeight: 460, overflowY: 'auto' }}>
            <div className="panel-head">
              <span className="panel-kicker">TEMPLATES / INDEX</span>
              <span className="table-count">{grouped.reduce((n, [, list]) => n + list.length, 0)}</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              {grouped.map(([cat, tpls]) => (
                <div key={cat}>
                  <div className="panel-kicker" style={{ padding: '10px 16px 4px' }}>{cat}</div>
                  <div className="index-list">
                    {tpls.map((tpl, i) => {
                      const on = tpl.key === selectedKey
                      return (
                        <div
                          key={tpl.key}
                          role="button"
                          tabIndex={0}
                          className="index-row"
                          aria-current={on ? 'true' : undefined}
                          onClick={() => setSelectedKey(tpl.key)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelectedKey(tpl.key)
                            }
                          }}
                          style={on ? { background: 'var(--lime-wash)', boxShadow: 'inset 3px 0 0 var(--line)' } : undefined}
                        >
                          <span className="index-num" aria-hidden>
                            <span style={{ display: 'inline-flex', color: on ? 'var(--ink)' : 'var(--ink-faint)', fontSize: 16 }}>
                              {TPL_ICONS[tpl.key] ?? <AppstoreOutlined />}
                            </span>
                          </span>
                          <span className="index-main">
                            <span className="index-title" style={{ fontWeight: on ? 700 : 600 }}>{tpl.name}</span>
                            <span className="index-meta">{String(i + 1).padStart(2, '0')} · {tpl.fields.length} {t('tpl.center.fields')}</span>
                          </span>
                          <span className="tag-mono">{tpl.fields.length}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 右：纸面预览（sheet + 细线字段表 + 主按钮） */}
          <div className="sheet" style={{ flex: '1 1 420px', minWidth: 0, padding: 'var(--s5)' }}>
            {selected ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--t-lg)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                    {selected.name}
                  </h3>
                  <span className="table-count">{selected.fields.length} {t('tpl.center.fields')}</span>
                </div>
                <p className="page-sub" style={{ fontSize: 'var(--t-xs)', margin: '6px 0 16px' }}>{selected.desc}</p>
                <div style={{ borderTop: 'var(--bw) solid var(--line)' }}>
                  {selected.fields.map((f, i) => (
                    <div
                      key={f.key}
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: 12,
                        minHeight: 40,
                        padding: '8px 0',
                        borderBottom: '1px solid var(--line-soft)',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
                        <span className="index-num">{String(i + 1).padStart(2, '0')}</span>
                        <span style={{ fontSize: 'var(--t-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.label}
                        </span>
                      </span>
                      <span className="tag-mono">{t(`lib.tpl.type.${f.type}`)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 'var(--s5)' }}>
                  <Button type="primary" onClick={() => applyLibTemplate(selected)}>
                    {t('tpl.center.use')}
                  </Button>
                </div>
              </>
            ) : (
              <p className="field-hint">{t('lib.tpl.empty')}</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
