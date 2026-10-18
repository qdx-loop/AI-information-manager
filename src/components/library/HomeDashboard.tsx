import { useEffect, useState } from 'react'
import { Alert, Button, Card, List, Space, Typography } from 'antd'
import { InlineSkeleton, EmptyState } from '@/components/common/PageSkeleton'
import { RightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { useLibraryStore } from '@/store/libraryStore'
import { useAuthStore } from '@/store/authStore'
import { gatherInsights, itemDisplayName, type InsightData } from '@/utils/insights'
import { useI18n } from '@/i18n'
import TemplateCenter from './TemplateCenter'

const { Text } = Typography

// 相对日期提示：已逾期 / 今天 / N 天后。
// 不再用彩色 Tag 药丸——时间是提醒内容的一部分，用文字色阶表达紧急度。
function useDateTag() {
  const t = useI18n()
  return (at: number) => {
    const now = dayjs().startOf('day')
    const target = dayjs(at).startOf('day')
    const diff = target.diff(now, 'day')
    if (diff < 0)
      return <Text style={{ color: 'var(--app-danger)', fontSize: 12.5 }}>{t('dash.overdue', { n: -diff })}</Text>
    if (diff === 0)
      return <Text style={{ color: 'var(--app-kiln-text)', fontSize: 12.5 }}>{t('dash.today')}</Text>
    return (
      <Text type="secondary" style={{ fontSize: 12.5 }}>
        {t('dash.inDays', { n: diff })}
      </Text>
    )
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
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [tplOpen, setTplOpen] = useState(false)
  const dateTag = useDateTag()

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    gatherInsights(libraries, { accountId, dataVersion })
      .then((d) => { if (alive) setData(d) })
      // 原来这里是 `.catch(() => {})`：失败后 data 保持 null，
      // 于是 Statistic 落到 `?? 0`，首页显示「0 条数据」，
      // 提醒区显示「没有提醒」。用户完全看不出是加载失败，
      // 只会以为自己的数据没了 —— 而数据其实好好地在本机。
      // 失败必须说出来，并且能重试。
      .catch((e: unknown) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [libraries, accountId, dataVersion, retryKey])

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
      {/*
        指标条的上一版是 4 个 <Card>，再上一版换成了带图标前缀的 Statistic。
        图标不承载信息（管理库标题配一个格子图标是同义反复），
        这一版做成编辑部数字条：小标签 + 等宽大数字，细线分隔，无图标无配色。
      */}
      <div className="stat-strip" style={{ marginBottom: 18 }}>
        <div className="stat-cell">
          <div className="stat-label">{t('dash.stat.libs')}</div>
          <div className="stat-num">{loading ? '—' : data?.totalLibs ?? libraries.length}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">{t('dash.stat.items')}</div>
          <div className="stat-num">{loading || error ? '—' : data?.totalItems ?? 0}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">{t('dash.stat.week')}</div>
          <div className="stat-num is-accent">{loading || error ? '—' : data?.itemsThisWeek ?? 0}</div>
        </div>
      </div>

      <Card
        size="small"
        style={{ borderColor: 'var(--app-border-soft)' }}
        title={<span style={{ fontSize: 13, fontWeight: 600 }}>{t('dash.alerts.title')}</span>}
        extra={
          <Space size={6}>
            <Text type="secondary" style={{ fontSize: 12 }}>{t('dash.alerts.hint')}</Text>
            <Button size="small" type="text" onClick={() => setTplOpen(true)}>
              {t('tpl.center.entry')}
            </Button>
          </Space>
        }
      >
        {error ? (
          <Alert
            type="error"
            showIcon
            message={t('dash.loadFailed')}
            description={<Space direction="vertical" size={4}>
              <Text style={{ fontSize: 12 }}>{error}</Text>
              <Button size="small" onClick={() => setRetryKey((n) => n + 1)}>{t('dash.retry')}</Button>
            </Space>}
          />
        ) : loading ? (
          <InlineSkeleton rows={4} />
        ) : alerts.length === 0 ? (
          <EmptyState
            compact
            title={t('dash.alerts.empty')}
            body={libraries.length === 0 ? t('dash.alerts.emptyNoLib') : t('dash.alerts.emptyHint')}
          />
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
                actions={[<RightOutlined key="go" style={{ color: 'var(--app-ink-faint)' }} />]}
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
