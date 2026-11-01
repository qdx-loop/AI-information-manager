import { useEffect, useState } from 'react'
import { Button } from 'antd'
import { InlineSkeleton } from '@/components/common/PageSkeleton'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
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

/** 千分位：指标数字要能一眼读出量级 */
function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

/** 可点击的行：mono 编号 + 主副文 + 右侧动作 */
function IndexRow({
  num,
  title,
  meta,
  right,
  onClick,
}: {
  num: string
  title: string
  meta: string
  right?: React.ReactNode
  onClick: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="index-row"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <span className="index-num">{num}</span>
      <span className="index-main">
        <span className="index-title">{title}</span>
        <span className="index-meta">{meta}</span>
      </span>
      {right ?? <ArrowRightOutlined style={{ fontSize: 12, color: 'var(--text-muted)' }} aria-hidden />}
    </div>
  )
}

export default function HomeDashboard({ onCreate, notice }: { onCreate: () => void; notice?: React.ReactNode }) {
  const navigate = useNavigate()
  const t = useI18n()
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
  const noLib = !loading && !error && libraries.length === 0

  /** 待办行：mono 日期 + 标题/来源 + 右侧状态 pill；行高 44 */
  const todoRow = (a: (typeof alerts)[number]) => {
    const diff = daysLeft(a.at)
    const pillCls = diff < 0 ? 'status-pill is-danger' : diff <= 3 ? 'status-pill is-warning' : 'status-pill is-neutral'
    const pillText =
      diff < 0 ? t('dash.overdue', { n: -diff }) : diff === 0 ? t('dash.today') : t('dash.inDays', { n: diff })
    return (
      <div
        key={a.key}
        role="button"
        tabIndex={0}
        className="dash-row"
        style={{ cursor: 'pointer' }}
        onClick={() => {
          focusItem(a.itemId)
          navigate(`/library/${a.libId}`)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            focusItem(a.itemId)
            navigate(`/library/${a.libId}`)
          }
        }}
      >
        <span className="dash-date">{dayjs(a.at).format('YYYY-MM-DD')}</span>
        <span className="dash-main">
          <span className="dash-title">{a.title}</span>
          <span className="dash-meta">{a.libName} · {a.sub}</span>
        </span>
        <span className={pillCls}>{pillText}</span>
      </div>
    )
  }

  /** 墨黑简报 tile 的一行：on-ink 标签 + lime 数字 */
  const briefRow = (label: string, value: string, signal = false) => (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--t-2xs)',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--on-dark)',
          opacity: 0.72,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--t-2xl)',
          lineHeight: 1,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
          color: signal ? 'var(--accent-2)' : 'var(--accent)',
        }}
      >
        {value}
      </span>
    </div>
  )

  const quickActions = [
    { key: 'tpl', icon: <AppstoreOutlined style={{ fontSize: 16 }} />, label: t('tpl.center.entry'), onClick: () => setTplOpen(true) },
    { key: 'trash', icon: <DeleteOutlined style={{ fontSize: 16 }} />, label: t('lib.trash.title'), onClick: () => navigate('/trash') },
    { key: 'help', icon: <QuestionCircleOutlined style={{ fontSize: 16 }} />, label: t('app.help'), onClick: () => navigate('/help') },
  ]

  return (
    <div className="workbench">
      {notice}
      {/* 页头：kicker + Outfit 800 标题 + 说明 + lime 主按钮 */}
      <div className="page-head">
        <div className="page-head-main">
          <div className="page-kicker">{t('dash.kicker')}</div>
          <h1 className="page-title">
            {account?.username ? t('home.greeting', { name: account.username }) : t('dash.titleFallback')}
          </h1>
          <p className="page-sub">
            {dayjs().format('YYYY-MM-DD')} · {libraries.length > 0 ? t('home.pick') : t('home.empty')}
          </p>
        </div>
        <div className="page-head-actions">
          <Button type="primary" onClick={onCreate}>{t('app.newLibrary')}</Button>
        </div>
      </div>
      <div className="page-bar" />

      <div className="bento">
        {/* —— 第一行：左 7 lime 大指标 / 右 5 墨黑今日简报 —— */}
        <div className="tile tile--accent tile--span-7">
          <div className="tile-head">
            <span>DASHBOARD</span>
            <span>RECORDS</span>
          </div>
          {noLib ? (
            // 无库：主 tile 用空态（lime 方块 + 标题 + 主按钮），绝不出新手清单
            <div className="empty-state" style={{ padding: '16px 0 8px' }}>
              <div className="empty-mark" aria-hidden>+</div>
              <h3 className="empty-title">{t('dash.startFirst')}</h3>
              <p className="empty-body">{t('dash.alerts.emptyNoLib')}</p>
              <div className="empty-actions">
                <Button type="primary" onClick={onCreate}>{t('app.newLibrary')}</Button>
                <Button onClick={() => setTplOpen(true)}>{t('tpl.center.entry')}</Button>
              </div>
            </div>
          ) : (
            <div className="metric" style={{ flex: '1 1 auto', justifyContent: 'center' }}>
              <div className="metric-label">{t('dash.stat.items')}</div>
              <div className="metric-value metric-value--lg">{loading || error ? '—' : fmt(totalItems)}</div>
              <div className="metric-note">
                {loading || error ? ' ' : t('dash.kpi.delta.week', { n: itemsThisWeek })}
              </div>
            </div>
          )}
        </div>

        <div className="tile tile--dark tile--span-5">
          <div className="tile-head">
            <span>{t('dash.brief.title')}</span>
            <span>BRIEF</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: '1 1 auto', justifyContent: 'center' }}>
            {briefRow(t('dash.brief.todo', { n: '' }).trim(), loading || error ? '—' : fmt(alerts.length))}
            {briefRow(t('dash.brief.overdue', { n: '' }).trim(), loading || error ? '—' : fmt(overdueCount), overdueCount > 0)}
            {briefRow(t('dash.brief.sync'), t('dash.brief.local'))}
          </div>
          <Button
            type="primary"
            icon={<RobotOutlined />}
            onClick={() => window.dispatchEvent(new Event('open-ai-panel'))}
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            {t('ob.act.ai')}
          </Button>
        </div>

        {/* —— 第二行：3 个 panel 小指标（各 4 列） —— */}
        <div className="tile tile--soft tile--span-4">
          <div className="metric">
            <div className="metric-label">{t('dash.stat.week')}</div>
            <div className="metric-value" style={{ fontSize: 'var(--t-3xl)' }}>{loading || error ? '—' : fmt(itemsThisWeek)}</div>
            <div className="metric-note">{t('dash.kpi.delta.avg', { n: perLib })}</div>
          </div>
        </div>
        <div className="tile tile--soft tile--span-4">
          <div className="metric">
            <div className="metric-label">{t('dash.stat.libs')}</div>
            <div className="metric-value" style={{ fontSize: 'var(--t-3xl)' }}>{loading || error ? '—' : fmt(totalLibs)}</div>
            <div className="metric-note">{t('dash.kpi.delta.subLibs', { n: subLibs })}</div>
          </div>
        </div>
        <div className="tile tile--soft tile--span-4">
          <div className="metric">
            <div className="metric-label">{t('dash.kpi.todo')}</div>
            <div className="metric-value" style={{ fontSize: 'var(--t-3xl)' }}>{loading || error ? '—' : fmt(alerts.length)}</div>
            <div className="metric-note" style={{ color: overdueCount > 0 ? 'var(--accent-2)' : undefined }}>
              {t('dash.kpi.delta.overdue', { n: overdueCount })}
            </div>
          </div>
        </div>

        {/* —— 第三行：左 7 待办 / 右 5 最近动态 + 快捷入口 —— */}
        <div className="panel tile--span-7">
          <div className="panel-head">
            <div>
              <div className="panel-kicker">TASKS / 7D</div>
              <h2 className="panel-title">{t('dash.todo.title')}</h2>
            </div>
            <span className="tag-mono">{t('dash.alerts.hint')}</span>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            {error ? (
              <EmptyPanel
                surface={false}
                title={t('dash.loadFailed')}
                body={error}
                action={<Button type="primary" onClick={() => setRetryKey((n) => n + 1)}>{t('dash.retry')}</Button>}
              />
            ) : loading ? (
              <div style={{ padding: 12 }}><InlineSkeleton rows={5} /></div>
            ) : alerts.length === 0 ? (
              <EmptyPanel
                surface={false}
                title={t('dash.alerts.empty')}
                body={libraries.length === 0 ? t('dash.alerts.emptyNoLib') : t('dash.alerts.emptyHint')}
                action={
                  libraries.length === 0
                    ? <Button type="primary" onClick={onCreate}>{t('app.newLibrary')}</Button>
                    : <Button onClick={() => setTplOpen(true)}>{t('tpl.center.entry')}</Button>
                }
              />
            ) : (
              alerts.map(todoRow)
            )}
          </div>
        </div>

        <div className="panel tile--span-5">
          <div className="panel-head">
            <div>
              <div className="panel-kicker">LOG / RECENT</div>
              <h2 className="panel-title">{t('dash.recent.title')}</h2>
            </div>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: 12 }}><InlineSkeleton rows={3} /></div>
            ) : recent.length === 0 ? (
              <div className="empty-body" style={{ padding: '16px' }}>{t('dash.recent.empty')}</div>
            ) : (
              <div className="index-list">
                {recent.map((r, i) => (
                  <IndexRow
                    key={r.key}
                    num={String(i + 1).padStart(2, '0')}
                    title={r.title}
                    meta={`${r.libName} · ${dayjs(r.updatedAt).format('MM-DD HH:mm')}`}
                    onClick={() => {
                      focusItem(r.itemId)
                      navigate(`/library/${r.libId}`)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          {/* 右 5 列底部：快捷入口（index-row，编号用线性图标） */}
          <div className="panel-head" style={{ borderTop: 'var(--border-width) solid var(--border-strong)', borderBottom: 0 }}>
            <span className="panel-kicker">{t('dash.quick.title')}</span>
          </div>
          <div className="index-list">
            {quickActions.map((q, i) => (
              <IndexRow
                key={q.key}
                num={String(i + 1).padStart(2, '0')}
                title={q.label}
                meta=""
                right={<span aria-hidden style={{ display: 'inline-flex', color: 'var(--text-muted)' }}>{q.icon}</span>}
                onClick={q.onClick}
              />
            ))}
          </div>
        </div>
      </div>

      <TemplateCenter open={tplOpen} onClose={() => setTplOpen(false)} />
    </div>
  )
}
