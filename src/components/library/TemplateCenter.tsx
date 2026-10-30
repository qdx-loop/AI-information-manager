import { useMemo, useState } from 'react'
import { Modal, Button, Checkbox, Input, App } from 'antd'
import { useNavigate } from 'react-router-dom'
import { LIB_TEMPLATES, applyTemplate, applySampleData, type LibTemplate } from '@/utils/libraryTemplates'
import { useLibraryStore } from '@/store/libraryStore'
import { useAuthStore } from '@/store/authStore'
import { useI18n } from '@/i18n'

import { consumeTopOverlay, useBackButtonLayer } from '@/utils/backButton'

/**
 * 模板中心：按行业分组展示所有模板，一键建库并套用字段结构（可选附带示例数据）。
 *
 * 视觉从「两列模板卡」改成「左目录 + 右表样」：
 * 模板是一份账目表样，用户要先看见「栏目长什么样」再决定用不用。
 * 左列只放名称 + 字段数（mono），右侧是一张纸面预览——横向账线、字段名在左、类型在右，
 * 与真实表格同一套行线口径（01-ui-research §F8/F9）。
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
      width={760}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
    >
      <p className="page-lede" style={{ margin: '0 0 12px' }}>{t('tpl.center.subtitle')}</p>
      <Checkbox checked={withSample} onChange={(e) => setWithSample(e.target.checked)} style={{ marginBottom: 16 }}>
        {t('tpl.center.sample')}
      </Checkbox>

      {grouped.length === 0 ? (
        <p className="faint" style={{ fontSize: 'var(--text-sm)' }}>{t('lib.tpl.empty')}</p>
      ) : (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          {/* 左：模板目录（名称 + 字段数），选中 = 2px 朱砂左线 + wash 底 */}
          <div
            style={{
              width: 280,
              flexShrink: 0,
              borderRight: '1px solid var(--app-rule)',
              paddingRight: 12,
              maxHeight: 420,
              overflowY: 'auto',
            }}
          >
            {grouped.map(([cat, tpls]) => (
              <div key={cat} style={{ marginBottom: 8 }}>
                <div className="eyebrow" style={{ padding: '8px 6px 4px' }}>{cat}</div>
                {tpls.map((tpl) => {
                  const on = tpl.key === selectedKey
                  return (
                    <button
                      key={tpl.key}
                      type="button"
                      onClick={() => setSelectedKey(tpl.key)}
                      aria-current={on ? 'true' : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: 8,
                        width: '100%',
                        minHeight: 32,
                        padding: '4px 6px 4px 10px',
                        margin: 0,
                        border: 0,
                        borderLeft: on ? '2px solid var(--app-accent)' : '2px solid transparent',
                        background: on ? 'var(--app-accent-wash)' : 'transparent',
                        font: 'inherit',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: 'inherit',
                      }}
                    >
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: on ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tpl.name}
                      </span>
                      <span className="mono num faint" style={{ fontSize: 'var(--text-xs)', flexShrink: 0 }}>
                        {tpl.fields.length} {t('tpl.center.fields')}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* 右：一张纸的「表样」——横向账线、字段名在左、类型在右 */}
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            {selected ? (
              <div className="sheet" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span className="page-title-sm">{selected.name}</span>
                  <span className="mono num faint" style={{ fontSize: 'var(--text-xs)' }}>
                    {selected.fields.length} {t('tpl.center.fields')}
                  </span>
                </div>
                <p className="muted" style={{ margin: '4px 0 12px', fontSize: 'var(--text-xs)', lineHeight: 1.6 }}>
                  {selected.desc}
                </p>
                <div style={{ borderTop: '1px solid var(--app-border-strong)' }}>
                  {selected.fields.map((f) => (
                    <div
                      key={f.key}
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: 12,
                        height: 28,
                        borderBottom: '1px solid var(--app-rule)',
                      }}
                    >
                      <span style={{ fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.label}
                      </span>
                      <span className="faint" style={{ fontSize: 'var(--text-xs)', flexShrink: 0 }}>
                        {t(`lib.tpl.type.${f.type}`)}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16 }}>
                  <Button type="primary" onClick={() => applyLibTemplate(selected)}>
                    {t('tpl.center.use')}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="faint" style={{ fontSize: 'var(--text-sm)' }}>{t('lib.tpl.empty')}</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
