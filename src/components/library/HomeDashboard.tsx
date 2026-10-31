import { useEffect, useState } from 'react'
import { Button, Grid } from 'antd'
import { InlineSkeleton } from '@/components/common/PageSkeleton'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import { useLibraryStore } from '@/store/libraryStore'
import { useAuthStore } from '@/store/authStore'
import { gatherInsights, itemDisplayName, type InsightData } from '@/utils/insights'
import { getProvider } from '@/db/providerFactory'
import type { Library } from '@/types'
import { useI18n } from '@/i18n'
import TemplateCenter from './TemplateCenter'
import EmptyPanel from './EmptyPanel'

/** 首页「最近动态」的一行：只保留渲染需要的字段，避免把整份 Item 拖进 state */
interface RecentEntry {
  key: string
  itemId: string
  libId: string
  libName: string
  title: string
  updatedAt: number
}

/**
 * 最近修改的 6 条。
 *
 * 首页要回答「最近动了什么」，而 `gatherInsights` 的返回（统计 + 提醒）里
 * 没有这一项，utils 层不在本任务的写入范围内，所以在组件侧单独读一次。
 * 单个库读取失败时跳过该库而不是让整块失败：概览的其它部分仍然有用，
 * 这与 gatherInsights 内部「逐库 try/catch 后继续」的口径一致。
 */
async function loadRecentItems(libraries: Library[]): Promise<RecentEntry[]> {
  const provider = getProvider()
  const perLib = await Promise.all(
    libraries.map(async (lib) => {
      try {
        const items = await provider.listItems(lib.id)
        return items.map((it) => ({
          key: `${lib.id}:${it.id}`,
          itemId: it.id,
          libId: lib.id,
          libName: lib.name,
          title: itemDisplayName(it),
          updatedAt: it.updatedAt,
        }))
      } catch {
        return [] as RecentEntry[]
      }
    }),
  )
  return perLib
    .flat()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6)
}

/** 千分位：KPI 数字要能一眼读出量级 */
function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

/** KPI 变化值的语义色：正向 is-up / 风险 is-down，其余中性（颜色由 CSS 负责） */
function KpiCard({ label, value, delta, tone = 'muted' }: { label: string; value: string; delta: string; tone?: 'up' | 'down' | 'muted' }) {
  const cls = tone === 'up' ? 'kpi-delta is-up' : tone === 'down' ? 'kpi-delta is-down' : 'kpi-delta'
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className={cls}>{delta}</div>
    </div>
  )
}

/** 列表行：div + role=button，样式全部交给 .card-row（含 hover/行线），避免内联覆盖 */
function CardRow({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="card-row"
      style={{ minHeight: 44, padding: '0 20px' }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {children}
    </div>
  )
}

export default function HomeDashboard({ onCreate }: { onCreate: () => void }) {
  const navigate = useNavigate()
  const t = useI18n()
  const bp = Grid.useBreakpoint()
  const narrow = !bp.md
  const libraries = useLibraryStore((s) => s.libraries)
  const dataVersion = useLibraryStore((s) => s.dataVersion)
  const focusItem = useLibraryStore((s) => s.focusItem)
  const account = useAuthStore((s) => s.account)
  const accountId = account?.id ?? ''
  const [data, setData] = useState<InsightData | null>(null)
  const [recent, setRecent] = useState<RecentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [tplOpen, setTplOpen] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    Promise.all([gatherInsights(libraries, { accountId, dataVersion }), loadRecentItems(libraries)])
      .then(([d, r]) => {
        if (!alive) return
        setData(d)
        setRecent(r)
      })
      // 失败必须说出来，并且能重试：之前 `.catch(() => {})` 会让首页显示「0 条数据」，
      // 用户以为数据丢了 —— 而数据其实好好地在本机。
      .catch((e: unknown) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
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
  ]
    .sort((a, b) => a.at - b.at)
    .slice(0, 12)

  const today = dayjs().startOf('day')
  /** 距今天数：负数 = 已逾期 */
  const daysLeft = (at: number): number => dayjs(at).startOf('day').diff(today, 'day')
  const overdueCount = alerts.filter((a) => daysLeft(a.at) < 0).length

  const totalItems = data?.totalItems ?? 0
  const totalLibs = data?.totalLibs ?? libraries.length
  const itemsThisWeek = data?.itemsThisWeek ?? 0
  const subLibs = libraries.filter((l) => l.parentId).length
  const perLib = totalLibs > 0 ? Math.round(totalItems / totalLibs) : 0

  const todoRow = (a: (typeof alerts)[number]) => {
    const diff = daysLeft(a.at)
    // 剩余天数用 status-pill：已逾期 danger、今天/≤3 天 warning、其余中性
    const pillCls = diff < 0 ? 'status-pill is-danger' : diff <= 3 ? 'status-pill is-warning' : 'status-pill'
    const pillText =
      diff < 0 ? t('dash.overdue', { n: -diff }) : diff === 0 ? t('dash.today') : t('dash.inDays', { n: diff })
    return (
      <CardRow
        key={a.key}
        onClick={() => {
          focusItem(a.itemId)
          navigate(`/library/${a.libId}`)
        }}
      >
        <span className="mono tabular faint" style={{ fontSize: 'var(--text-xs)', flexShrink: 0, width: 84 }}>
          {dayjs(a.at).format('YYYY-MM-DD')}
        </span>
        <span
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {a.title}
        </span>
        <span
          className="faint"
          style={{ fontSize: 'var(--text-2xs)', flexShrink: 0, maxWidth: '34%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {a.libName} · {a.sub}
        </span>
        <span className={pillCls} style={{ flexShrink: 0 }}>{pillText}</span>
      </CardRow>
    )
  }

  const recentRow = (r: RecentEntry) => (
    <CardRow
      key={r.key}
      onClick={() => {
        focusItem(r.itemId)
        navigate(`/library/${r.libId}`)
      }}
    >
      <span
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          color: 'var(--ink)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {r.title}
      </span>
      <span className="faint" style={{ fontSize: 'var(--text-2xs)', flexShrink: 0 }}>
        {r.libName}
      </span>
      <span className="mono tabular faint" style={{ fontSize: 'var(--text-2xs)', flexShrink: 0, width: 88, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {dayjs(r.updatedAt).format('MM-DD HH:mm')}
      </span>
    </CardRow>
  )

  const quickActions = [
    { key: 'tpl', icon: <AppstoreOutlined />, label: t('tpl.center.entry'), onClick: () => setTplOpen(true) },
    { key: 'trash', icon: <DeleteOutlined />, label: t('lib.trash.title'), onClick: () => navigate('/trash') },
    {
      key: 'ai',
      icon: <RobotOutlined />,
      label: t('app.aiAssistant'),
      onClick: () => window.dispatchEvent(new Event('open-ai-panel')),
    },
  ]

  return (
    <div>
      {/* 页头：24 标题 + 日期/说明 + 主操作（墨黑） */}
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('home.greeting', { name: account?.username ?? '' })}
          </h1>
          <p className="page-lede">
            {dayjs().format('YYYY-MM-DD')} · {libraries.length > 0 ? t('home.pick') : t('home.empty')}
          </p>
        </div>
        <div className="page-head-actions">
          <Button type="primary" onClick={onCreate}>{t('home.createFirst')}</Button>
        </div>
      </div>

      {/* KPI 白卡：24/600 tabular 数字 + 12 标签 + 变化值 */}
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <KpiCard
          label={t('dash.stat.items')}
          value={loading || error ? '—' : fmt(totalItems)}
          delta={t('dash.kpi.delta.week', { n: itemsThisWeek })}
          tone="up"
        />
        <KpiCard
          label={t('dash.stat.week')}
          value={loading || error ? '—' : fmt(itemsThisWeek)}
          delta={t('dash.kpi.delta.avg', { n: perLib })}
        />
        <KpiCard
          label={t('dash.stat.libs')}
          value={loading || error ? '—' : fmt(totalLibs)}
          delta={t('dash.kpi.delta.subLibs', { n: subLibs })}
        />
        <KpiCard
          label={t('dash.kpi.todo')}
          value={loading || error ? '—' : fmt(alerts.length)}
          delta={t('dash.kpi.delta.overdue', { n: overdueCount })}
          tone={overdueCount > 0 ? 'down' : 'muted'}
        />
      </div>

      {/* 两栏：左「待办与临期」60%，右「最近动态 / 快捷入口」40% */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'minmax(0, 3fr) minmax(0, 2fr)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <section className="card-list" aria-labelledby="home-todo">
          <div className="card-list-head">
            <h2 id="home-todo" className="card-list-title">{t('dash.todo.title')}</h2>
            <span className="faint" style={{ fontSize: 'var(--text-2xs)' }}>{t('dash.alerts.hint')}</span>
          </div>
          {error ? (
            <div style={{ padding: 20 }}>
              <div className="danger-text" style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{t('dash.loadFailed')}</div>
              <div className="faint" style={{ fontSize: 'var(--text-2xs)', marginTop: 4, wordBreak: 'break-all' }}>{error}</div>
              <Button style={{ marginTop: 12 }} onClick={() => setRetryKey((n) => n + 1)}>
                {t('dash.retry')}
              </Button>
            </div>
          ) : loading ? (
            <div style={{ padding: 12 }}>
              <InlineSkeleton rows={5} />
            </div>
          ) : alerts.length === 0 ? (
            <EmptyPanel
              surface={false}
              title={t('dash.alerts.empty')}
              body={libraries.length === 0 ? t('dash.alerts.emptyNoLib') : t('dash.alerts.emptyHint')}
              action={
                libraries.length === 0 ? (
                  <Button type="primary" onClick={onCreate}>{t('home.createFirst')}</Button>
                ) : (
                  <Button onClick={() => setTplOpen(true)}>{t('tpl.center.entry')}</Button>
                )
              }
            />
          ) : (
            <div>{alerts.map(todoRow)}</div>
          )}
        </section>

        <section className="card-list" aria-labelledby="home-recent">
          <div className="card-list-head">
            <h2 id="home-recent" className="card-list-title">{t('dash.recent.title')}</h2>
            <CheckCircleOutlined style={{ fontSize: 16, color: 'var(--ink-faint)' }} aria-hidden />
          </div>
          {loading ? (
            <div style={{ padding: 12 }}>
              <InlineSkeleton rows={3} />
            </div>
          ) : recent.length === 0 ? (
            <div className="faint" style={{ fontSize: 'var(--text-sm)', padding: '20px' }}>
              {t('dash.recent.empty')}
            </div>
          ) : (
            <div>{recent.map(recentRow)}</div>
          )}

          <div className="divider" style={{ margin: 0 }} />
          <div className="card-list-head" style={{ paddingBottom: 8 }}>
            <h2 className="card-list-title" style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-faint)', fontWeight: 500 }}>
              {t('dash.quick.title')}
            </h2>
          </div>
          <div>
            {quickActions.map((q) => (
              <CardRow key={q.key} onClick={q.onClick}>
                <span style={{ fontSize: 16, display: 'inline-flex', color: 'var(--ink-faint)' }} aria-hidden>{q.icon}</span>
                <span style={{ flex: '1 1 auto', fontSize: 'var(--text-sm)', color: 'var(--ink-muted)' }}>{q.label}</span>
                <ArrowRightOutlined style={{ fontSize: 12, color: 'var(--ink-faint)' }} aria-hidden />
              </CardRow>
            ))}
          </div>
        </section>
      </div>

      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        <ClockCircleOutlined style={{ fontSize: 12, color: 'var(--ink-faint)' }} aria-hidden />
        <span className="faint" style={{ fontSize: 'var(--text-2xs)' }}>{t('home.tip')}</span>
      </div>

      <TemplateCenter open={tplOpen} onClose={() => setTplOpen(false)} />
    </div>
  )
}
