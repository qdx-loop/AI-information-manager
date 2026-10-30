import { useEffect, useState } from 'react'
import { Button } from 'antd'
import { InlineSkeleton } from '@/components/common/PageSkeleton'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { useLibraryStore } from '@/store/libraryStore'
import { useAuthStore } from '@/store/authStore'
import { gatherInsights, itemDisplayName, type InsightData } from '@/utils/insights'
import { getProvider } from '@/db/providerFactory'
import type { Library } from '@/types'
import { useI18n } from '@/i18n'
import TemplateCenter from './TemplateCenter'

/** 首页「最近修改」的一行：只保留渲染需要的字段，避免把整份 Item 拖进 state */
interface RecentEntry {
  key: string
  itemId: string
  libId: string
  libName: string
  title: string
  updatedAt: number
}

/**
 * 最近修改的 10 条。
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
    .slice(0, 10)
}

// 相对日期提示：已逾期 / 今天 / N 天后。
// 不再用彩色 Tag 药丸——临期用「朱砂文字 + 6px 方点」，非临期用弱化等宽数字，
// 时间和紧急度本就是提醒内容的一部分，不需要第三种颜色。
function useDateTag() {
  const t = useI18n()
  return (at: number) => {
    const now = dayjs().startOf('day')
    const target = dayjs(at).startOf('day')
    const diff = target.diff(now, 'day')
    if (diff < 0)
      return (
        <span className="tag-dot" style={{ color: 'var(--app-danger)', justifyContent: 'flex-end' }}>
          {t('dash.overdue', { n: -diff })}
        </span>
      )
    if (diff === 0)
      return (
        <span className="tag-dot" style={{ color: 'var(--app-accent-text)', justifyContent: 'flex-end' }}>
          {t('dash.today')}
        </span>
      )
    return (
      <span className="mono num faint" style={{ justifyContent: 'flex-end' }}>
        {t('dash.inDays', { n: diff })}
      </span>
    )
  }
}

/** 账页行：40px 高、只有一条横线、无卡片、无背景（账本的行） */
const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  height: 40,
  padding: '0 4px',
  margin: 0,
  background: 'transparent',
  border: 0,
  borderBottom: '1px solid var(--app-rule)',
  font: 'inherit',
  textAlign: 'left',
  color: 'inherit',
  cursor: 'pointer',
}

/** 段标题行：40px，标题与右侧注脚同一基线（Lead 约定） */
const sectionHeadStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 12,
  minHeight: 40,
  flexWrap: 'wrap',
}

export default function HomeDashboard() {
  const navigate = useNavigate()
  const t = useI18n()
  const libraries = useLibraryStore((s) => s.libraries)
  const dataVersion = useLibraryStore((s) => s.dataVersion)
  const focusItem = useLibraryStore((s) => s.focusItem)
  const accountId = useAuthStore((s) => s.account?.id ?? '')
  const [data, setData] = useState<InsightData | null>(null)
  const [recent, setRecent] = useState<RecentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [tplOpen, setTplOpen] = useState(false)
  const dateTag = useDateTag()

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    Promise.all([
      gatherInsights(libraries, { accountId, dataVersion }),
      loadRecentItems(libraries),
    ])
      .then(([d, r]) => {
        if (!alive) return
        setData(d)
        setRecent(r)
      })
      // 原来这里是 `.catch(() => {})`：失败后 data 保持 null，
      // 于是 Statistic 落到 `?? 0`，首页显示「0 条数据」，
      // 提醒区显示「没有提醒」。用户完全看不出是加载失败，
      // 只会以为自己的数据没了 —— 而数据其实好好地在本机。
      // 失败必须说出来，并且能重试。
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

  return (
    <div>
      {/*
        指标条的上一版是 4 个 <Card>，再上一版是带图标前缀的 Statistic，
        再上一版是三张卡片并排。这一版是**账目摘要行**：
        标签 + 衬线大数字，1px 竖线分隔，没有外框、没有圆角、没有阴影、没有图标。
        数字是账本上最先被扫读的东西，所以它用 34px 衬线 + tabular-nums。
      */}
      <div className="eyebrow" style={{ marginBottom: 8 }}>{t('dash.eyebrow')}</div>
      <div className="stat-strip" style={{ marginBottom: 32 }}>
        <div className="stat-cell">
          <div className="stat-num">{loading ? '—' : data?.totalLibs ?? libraries.length}</div>
          <div className="stat-label">{t('dash.stat.libs')}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">{loading || error ? '—' : data?.totalItems ?? 0}</div>
          <div className="stat-label">{t('dash.stat.items')}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-num">{loading || error ? '—' : data?.itemsThisWeek ?? 0}</div>
          <div className="stat-label">{t('dash.stat.week')}</div>
        </div>
      </div>

      {/* ———— 待办账目：一屏回答「今天要处理什么」 ———— */}
      <section aria-labelledby="dash-todo" style={{ marginBottom: 32 }}>
        <div style={sectionHeadStyle}>
          <h2 id="dash-todo" className="page-title-sm">{t('dash.section.todo')}</h2>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <span className="faint" style={{ fontSize: 'var(--text-xs)' }}>{t('dash.alerts.hint')}</span>
            <button
              type="button"
              className="link-quiet"
              style={{ fontSize: 'var(--text-xs)' }}
              onClick={() => setTplOpen(true)}
            >
              {t('tpl.center.entry')}
            </button>
          </div>
        </div>
        <div className="rule" />

        {error ? (
          // 错误态：文字 + 2px 朱砂立线，而不是 Alert 色块；再给一个「重试」出口
          <div
            style={{
              borderLeft: '2px solid var(--app-danger)',
              padding: '12px 0 12px 12px',
              marginTop: 16,
            }}
          >
            <div className="danger-text" style={{ fontSize: 'var(--text-base)' }}>{t('dash.loadFailed')}</div>
            <div className="faint" style={{ fontSize: 'var(--text-xs)', marginTop: 4, wordBreak: 'break-all' }}>{error}</div>
            <div style={{ marginTop: 12 }}>
              <Button onClick={() => setRetryKey((n) => n + 1)}>{t('dash.retry')}</Button>
            </div>
          </div>
        ) : loading ? (
          <InlineSkeleton rows={4} />
        ) : alerts.length === 0 ? (
          // 空态：一句话（衬线 20）+ 一个动作
          <div className="empty-state" style={{ padding: '28px 0 8px', textAlign: 'left' }}>
            <div className="empty-state-title">{t('dash.alerts.empty')}</div>
            <div className="empty-state-body">
              {libraries.length === 0 ? t('dash.alerts.emptyNoLib') : t('dash.alerts.emptyHint')}
            </div>
            <div className="empty-state-actions">
              <Button onClick={() => setTplOpen(true)}>{t('tpl.center.entry')}</Button>
            </div>
          </div>
        ) : (
          <div>
            {alerts.map((a) => (
              <button
                key={a.key}
                type="button"
                style={rowStyle}
                onClick={() => {
                  focusItem(a.itemId)
                  navigate(`/library/${a.libId}`)
                }}
              >
                <span
                  className="mono num faint"
                  style={{ fontSize: 'var(--text-xs)', flexShrink: 0, width: 88 }}
                >
                  {dayjs(a.at).format('YYYY-MM-DD')}
                </span>
                <span
                  style={{
                    fontSize: 'var(--text-base)',
                    color: 'var(--app-ink)',
                    flex: '1 1 auto',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.title}
                </span>
                <span
                  className="faint"
                  style={{ fontSize: 'var(--text-xs)', flexShrink: 0, maxWidth: '30%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {a.libName} · {a.sub}
                </span>
                <span
                  className="mono num"
                  style={{ fontSize: 'var(--text-xs)', flexShrink: 0, width: 112, display: 'inline-flex', justifyContent: 'flex-end' }}
                >
                  {dateTag(a.at)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ———— 最近修改：行式列表，不带「查看全部」这类空入口 ———— */}
      <section aria-labelledby="dash-recent">
        <div style={sectionHeadStyle}>
          <h2 id="dash-recent" className="page-title-sm">{t('dash.section.recent')}</h2>
        </div>
        <div className="rule" />
        {loading || error ? (
          loading ? <InlineSkeleton rows={3} /> : null
        ) : recent.length === 0 ? (
          <div className="faint" style={{ fontSize: 'var(--text-sm)', padding: '16px 0' }}>
            {t('dash.recent.empty')}
          </div>
        ) : (
          <div>
            {recent.map((r) => (
              <button
                key={r.key}
                type="button"
                style={rowStyle}
                onClick={() => {
                  focusItem(r.itemId)
                  navigate(`/library/${r.libId}`)
                }}
              >
                <span className="mono num faint" style={{ fontSize: 'var(--text-xs)', flexShrink: 0, width: 88 }}>
                  {dayjs(r.updatedAt).format('YYYY-MM-DD')}
                </span>
                <span
                  style={{
                    fontSize: 'var(--text-base)',
                    color: 'var(--app-ink)',
                    flex: '1 1 auto',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.title}
                </span>
                <span
                  className="faint"
                  style={{ fontSize: 'var(--text-xs)', flexShrink: 0, maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {r.libName}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <TemplateCenter open={tplOpen} onClose={() => setTplOpen(false)} />
    </div>
  )
}
