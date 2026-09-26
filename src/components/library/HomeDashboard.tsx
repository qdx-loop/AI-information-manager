import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, List, Tag, Empty, Spin, Space, Typography } from 'antd'
import {
  AppstoreOutlined,
  ProfileOutlined,
  RiseOutlined,
  BellOutlined,
  AppstoreAddOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { useLibraryStore } from '@/store/libraryStore'
import { useAuthStore } from '@/store/authStore'
import { gatherInsights, itemDisplayName, type InsightData } from '@/utils/insights'
import { useI18n } from '@/i18n'
import TemplateCenter from './TemplateCenter'

const { Text } = Typography

// 相对日期标签：已逾期 / 今天 / N 天后
function useDateTag() {
  const t = useI18n()
  return (at: number) => {
    const now = dayjs().startOf('day')
    const target = dayjs(at).startOf('day')
    const diff = target.diff(now, 'day')
    if (diff < 0) return <Tag color="red">{t('dash.overdue', { n: -diff })}</Tag>
    if (diff === 0) return <Tag color="orange">{t('dash.today')}</Tag>
    return <Tag color="blue">{t('dash.inDays', { n: diff })}</Tag>
  }
}

export default function HomeDashboard() {
  const navigate = useNavigate()
  const t = useI18n()
  const libraries = useLibraryStore((s) => s.libraries)
  const dataVersion = useLibraryStore((s) => s.dataVersion)
  const focusItem = useLibraryStore((s) => s.focusItem)
  const accountId = useAuthStore((s) => s.account?.id ?? '')
  const [data, setData] = useState<InsightData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tplOpen, setTplOpen] = useState(false)
  const dateTag = useDateTag()

  useEffect(() => {
    let alive = true
    setLoading(true)
    gatherInsights(libraries, { accountId, dataVersion })
      .then((d) => { if (alive) setData(d) })
      .catch(() => { /* 概览失败不阻塞首页 */ })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [libraries, accountId, dataVersion])

  const alerts = [
    ...(data?.reminders ?? []).map((r) => ({
      key: `r-${r.item.id}`,
      libId: r.libraryId,
      libName: r.libraryName,
      itemId: r.item.id,
      title: itemDisplayName(r.item),
      sub: t('dash.reminder'),
      at: r.at,
    })),
    ...(data?.dateAlerts ?? []).map((d) => ({
      key: `d-${d.item.id}-${d.fieldLabel}`,
      libId: d.libraryId,
      libName: d.libraryName,
      itemId: d.item.id,
      title: itemDisplayName(d.item),
      sub: d.fieldLabel,
      at: d.at,
    })),
  ].sort((a, b) => a.at - b.at).slice(0, 12)

  return (
    <div>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title={t('dash.stat.libs')} value={data?.totalLibs ?? libraries.length} prefix={<AppstoreOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title={t('dash.stat.items')} value={data?.totalItems ?? 0} prefix={<ProfileOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title={t('dash.stat.week')} value={data?.itemsThisWeek ?? 0} prefix={<RiseOutlined />} valueStyle={{ color: '#0D9488' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" hoverable onClick={() => setTplOpen(true)} style={{ cursor: 'pointer', textAlign: 'center' }}>
            <Space direction="vertical" size={2}>
              <AppstoreAddOutlined style={{ fontSize: 20, color: '#0D9488' }} />
              <Text style={{ fontSize: 13 }}>{t('tpl.center.entry')}</Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={<Space><BellOutlined />{t('dash.alerts.title')}</Space>}
        extra={<Text type="secondary" style={{ fontSize: 12 }}>{t('dash.alerts.hint')}</Text>}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
        ) : alerts.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('dash.alerts.empty')} />
        ) : (
          <List
            size="small"
            dataSource={alerts}
            renderItem={(a) => (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  focusItem(a.itemId)
                  navigate(`/library/${a.libId}`)
                }}
                actions={[<RightOutlined key="go" style={{ color: '#bbb' }} />]}
              >
                <List.Item.Meta
                  title={<Space>{dateTag(a.at)}<Text>{a.title}</Text></Space>}
                  description={<Text type="secondary" style={{ fontSize: 12 }}>{a.libName} · {a.sub} · {dayjs(a.at).format('MM-DD')}</Text>}
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <TemplateCenter open={tplOpen} onClose={() => setTplOpen(false)} />
    </div>
  )
}
