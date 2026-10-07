import { useMemo, useState } from 'react'
import { Modal, Card, Row, Col, Tag, Button, Checkbox, Input, App, Typography, Empty } from 'antd'
import { AppstoreAddOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { LIB_TEMPLATES, applyTemplate, applySampleData, type LibTemplate } from '@/utils/libraryTemplates'
import { useLibraryStore } from '@/store/libraryStore'
import { useAuthStore } from '@/store/authStore'
import { useI18n } from '@/i18n'

import { consumeTopOverlay, useBackButtonLayer } from '@/utils/backButton'

const { Paragraph } = Typography

// 模板中心：按行业分组展示所有模板，一键建库并套用字段结构（可选附带示例数据）
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
      width={720}
    >
      <Paragraph type="secondary" style={{ marginBottom: 12 }}>
        {t('tpl.center.subtitle')}
      </Paragraph>
      <Checkbox checked={withSample} onChange={(e) => setWithSample(e.target.checked)} style={{ marginBottom: 16 }}>
        {t('tpl.center.sample')}
      </Checkbox>

      {grouped.length === 0 && <Empty />}
      {grouped.map(([cat, tpls]) => (
        <div key={cat} style={{ marginBottom: 18 }}>
          <Tag color="teal" style={{ marginBottom: 8 }}>{cat}</Tag>
          <Row gutter={[12, 12]}>
            {tpls.map((tpl) => (
              <Col xs={24} sm={12} key={tpl.key}>
                <Card
                  size="small"
                  hoverable
                  title={tpl.name}
                  extra={<AppstoreAddOutlined style={{ color: 'var(--app-glaze)' }} />}
                  onClick={() => applyLibTemplate(tpl)}
                  style={{ cursor: 'pointer' }}
                >
                  <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8, minHeight: 34 }}>
                    {tpl.desc}
                  </Paragraph>
                  <Button type="link" size="small" style={{ padding: 0 }}>
                    {t('tpl.center.use')} · {tpl.fields.length} {t('tpl.center.fields')}
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ))}
    </Modal>
  )
}
