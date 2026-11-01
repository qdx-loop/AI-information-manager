/**
 * 首页 · Windows 11 原生 v9
 *
 * 结构参考 Windows 11「设置 · 主页」+「开始 · 已固定」：
 *   - 页头：账户头像 + 问候标题 + 日期/本地优先说明 + 主命令按钮
 *   - 已固定：库磁贴网格（Win11 Start 式）
 *   - 最近修改：Win11 设置行列表
 *   - 今天：临期/逾期提醒（设置行 + 中性状态标签）
 *   - 数据概览：三行事实条（不使用 KPI 大色块 / 彩色渐变）
 *   - 快速操作：AI / 模板中心 / 回收站 / 帮助
 *
 * 数据读取与行为（打开库/条目、AI、模板、设置）与旧版完全一致。
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  AddRegular,
  ArrowClockwiseRegular,
  BoxRegular,
  CheckmarkCircleRegular,
  ChevronRightRegular,
  ClipboardTaskRegular,
  DatabaseRegular,
  DeleteRegular,
  DocumentRegular,
  FolderRegular,
  HistoryRegular,
  HomeRegular,
  LibraryRegular,
  MoneyRegular,
  PeopleRegular,
  QuestionCircleRegular,
  SettingsRegular,
  ShieldCheckmarkRegular,
  SparkleRegular,
  type FluentIcon,
} from '@fluentui/react-icons'
import { useLibraryStore } from '@/store/libraryStore'
import { useAuthStore } from '@/store/authStore'
import { gatherInsights, itemDisplayName, type InsightData } from '@/utils/insights'
import { getProvider } from '@/db/providerFactory'
import type { Library } from '@/types'
import { useI18n } from '@/i18n'
import TemplateCenter from './TemplateCenter'

interface RecentEntry {
  key: string
  itemId: string
  libId: string
  libName: string
  title: string
  updatedAt: number
}

interface HomeExtras {
  recent: RecentEntry[]
  counts: Record<string, number>
}

async function loadHomeExtras(libraries: Library[]): Promise<HomeExtras> {
  const provider = getProvider()
  const rows = await Promise.all(
    libraries.map(async (lib) => {
      try {
        return { lib, items: await provider.listItems(lib.id) }
      } catch {
        return { lib, items: [] as Awaited<ReturnType<typeof provider.listItems>> }
      }
    }),
  )
  const counts: Record<string, number> = {}
  const recent: RecentEntry[] = []
  for (const { lib, items } of rows) {
    counts[lib.id] = items.length
    for (const it of items) {
      recent.push({
        key: `${lib.id}:${it.id}`,
        itemId: it.id,
        libId: lib.id,
        libName: lib.name,
        title: itemDisplayName(it),
        updatedAt: it.updatedAt,
      })
    }
  }
  recent.sort((a, b) => b.updatedAt - a.updatedAt)
  return { recent: recent.slice(0, 6), counts }
}

const fmt = (n: number) => n.toLocaleString('en-US')

function iconForLibrary(lib: Library): FluentIcon {
  const text = `${lib.category ?? ''} ${lib.name}`.toLowerCase()
  if (/客户|联系|people|customer|contact/.test(text)) return PeopleRegular
  if (/财务|账本|收支|钱|money|finance|expense/.test(text)) return MoneyRegular
  if (/房产|房源|房|home|property|house/.test(text)) return HomeRegular
  if (/库存|商品|货|stock|inventory|product/.test(text)) return BoxRegular
  if (/项目|任务|project|task/.test(text)) return ClipboardTaskRegular
  if (/文档|笔记|doc|note/.test(text)) return DocumentRegular
  if (/文件|folder/.test(text)) return FolderRegular
  if (/数据|database/.test(text)) return DatabaseRegular
  return LibraryRegular
}

function greetingKey(hour: number) {
  if (hour < 12) return 'home.start.greeting.morning' as const
  if (hour < 18) return 'home.start.greeting.afternoon' as const
  return 'home.start.greeting.evening' as const
}

function dateLabel(): string {
  const lang = (typeof document !== 'undefined' ? document.documentElement.lang : 'zh-CN') || 'zh-CN'
  return dayjs().format(lang.startsWith('en') ? 'dddd, MMM D' : 'M月D日 dddd')
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
  const [extras, setExtras] = useState<HomeExtras>({ recent: [], counts: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [tplOpen, setTplOpen] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    Promise.all([gatherInsights(libraries, { accountId, dataVersion }), loadHomeExtras(libraries)])
      .then(([insight, home]) => {
        if (!alive) return
        setData(insight)
        setExtras(home)
      })
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

  const alerts = useMemo(
    () =>
      [
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
        .slice(0, 8),
    [data, t],
  )

  const today = dayjs().startOf('day')
  const daysLeft = (at: number) => dayjs(at).startOf('day').diff(today, 'day')
  const overdueCount = alerts.filter((a) => daysLeft(a.at) < 0).length
  const totalItems = data?.totalItems ?? 0
  const totalLibs = data?.totalLibs ?? libraries.length
  const itemsThisWeek = data?.itemsThisWeek ?? 0
  const noLib = !loading && !error && libraries.length === 0
  const pinned = useMemo(
    () => libraries.filter((l) => !l.parentId).slice().sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 8),
    [libraries],
  )
  const tasksPreview = alerts.slice(0, 3)
  const recent = extras.recent

  const openAI = () => window.dispatchEvent(new Event('open-ai-panel'))
  const openLibrary = (lib?: Library) => { if (lib) navigate(`/library/${lib.id}`) }
  const openAlert = (a: (typeof alerts)[number]) => {
    focusItem(a.itemId)
    navigate(`/library/${a.libId}`)
  }
  const greeting = t(greetingKey(dayjs().hour()), { name: account?.username ?? '' }).trim()

  return (
    <div className="w-page w-home">
      {notice}

      <header className="w-page-head w-home-head">
        <div className="w-home-identity">
          <span className="w-avatar w-avatar--lg" aria-hidden>
            {(account?.username ?? '?').slice(0, 1)}
          </span>
          <div className="w-head-main">
            <div className="w-home-date">{dateLabel()} · {t('landing.marquee.local')}</div>
            <h1 className="w-title">{greeting || t('dash.titleFallback')}</h1>
            <div className="w-desc">
              {t('home.start.summary', { libs: fmt(totalLibs), items: fmt(totalItems) })}
            </div>
          </div>
        </div>
        <div className="w-actions">
          <button type="button" className="w-btn" onClick={openAI}>
            <SparkleRegular fontSize={16} />
            {t('app.aiAssistant')}
          </button>
          <button type="button" className="w-btn w-btn--accent" onClick={onCreate}>
            <AddRegular fontSize={16} />
            {t('app.newLibrary')}
          </button>
        </div>
      </header>

      {error ? (
        <div className="w-card w-home-error" role="alert">
          <div className="w-home-error-main">
            <strong>{t('dash.loadFailed')}</strong>
            <span className="w-faint">{error}</span>
          </div>
          <button type="button" className="w-btn w-btn--sm" onClick={() => setRetryKey((n) => n + 1)}>
            <ArrowClockwiseRegular fontSize={16} />
            {t('dash.retry')}
          </button>
        </div>
      ) : null}

      <section className="w-home-section" aria-labelledby="home-pinned">
        <header className="w-home-section-head">
          <h2 id="home-pinned" className="w-home-section-title">{t('home.start.pinned')}</h2>
          {pinned.length > 0 ? <span className="w-count">{fmt(pinned.length)}</span> : null}
        </header>
        {noLib ? (
          <div className="w-card w-home-empty">
            <span className="w-home-empty-icon" aria-hidden>
              <AddRegular fontSize={24} />
            </span>
            <div className="w-head-main">
              <h3 className="w-home-empty-title">{t('home.start.emptyTitle')}</h3>
              <p className="w-desc">{t('home.start.emptyBody')}</p>
            </div>
            <div className="w-actions">
              <button type="button" className="w-btn w-btn--accent" onClick={onCreate}>
                {t('home.createFirst')}
              </button>
              <button type="button" className="w-btn" onClick={() => setTplOpen(true)}>
                {t('tpl.center.entry')}
              </button>
            </div>
          </div>
        ) : (
          <div className="w-pin-grid">
            {pinned.map((lib) => {
              const Icon = iconForLibrary(lib)
              return (
                <button key={lib.id} type="button" className="w-pin" onClick={() => openLibrary(lib)} title={lib.name}>
                  <span className="w-pin-top">
                    <span className="w-pin-icon" aria-hidden>
                      <Icon fontSize={20} />
                    </span>
                    <ChevronRightRegular fontSize={14} className="w-pin-chev" aria-hidden />
                  </span>
                  <span className="w-pin-name">{lib.name}</span>
                  <span className="w-pin-meta">
                    {loading
                      ? '—'
                      : `${fmt(extras.counts[lib.id] ?? 0)} · ${lib.category || t('app.group.libraries')}`}
                  </span>
                </button>
              )
            })}
            <button type="button" className="w-pin w-pin--add" onClick={onCreate}>
              <span className="w-pin-top">
                <span className="w-pin-icon w-pin-icon--add" aria-hidden>
                  <AddRegular fontSize={20} />
                </span>
              </span>
              <span className="w-pin-name">{t('home.start.pinAdd')}</span>
              <span className="w-pin-meta">{t('tpl.center.entry')}</span>
            </button>
          </div>
        )}
      </section>

      <div className="w-home-grid">
        <section className="w-card w-home-recent" aria-labelledby="home-recent">
          <header className="w-card-head">
            <h2 id="home-recent" className="w-card-title">
              <HistoryRegular fontSize={18} />
              {t('home.start.recent')}
            </h2>
            {recent.length > 0 ? (
              <button type="button" className="w-btn w-btn--subtle w-btn--sm" onClick={() => openLibrary(libraries[0])}>
                {t('home.start.viewAll')}
              </button>
            ) : null}
          </header>
          <div className="w-rows">
            {loading ? (
              [0, 1, 2, 3].map((n) => (
                <div key={n} className="w-row">
                  <span className="w-skeleton w-skeleton--text" style={{ width: 32, height: 32 }} />
                  <span className="w-row-main">
                    <span className="w-skeleton w-skeleton--text" style={{ width: '40%' }} />
                    <span className="w-skeleton w-skeleton--text" style={{ width: '24%', marginTop: 6 }} />
                  </span>
                </div>
              ))
            ) : recent.length === 0 ? (
              <div className="w-empty" style={{ minHeight: 180, padding: '32px 16px' }}>
                <span className="w-empty-icon" aria-hidden><HistoryRegular fontSize={24} /></span>
                <span className="w-empty-desc">{t('home.start.noRecent')}</span>
              </div>
            ) : (
              recent.map((r) => {
                const lib = libraries.find((l) => l.id === r.libId)
                const Icon = lib ? iconForLibrary(lib) : DocumentRegular
                return (
                  <button
                    key={r.key}
                    type="button"
                    className="w-row w-row--button"
                    onClick={() => { focusItem(r.itemId); navigate(`/library/${r.libId}`) }}
                  >
                    <span className="w-row-icon w-row-icon--neutral" aria-hidden><Icon fontSize={16} /></span>
                    <span className="w-row-main">
                      <span className="w-row-title">{r.title}</span>
                      <span className="w-row-desc">{r.libName} · {dayjs(r.updatedAt).format('MM-DD HH:mm')}</span>
                    </span>
                    <ChevronRightRegular fontSize={14} className="w-row-chevron" aria-hidden />
                  </button>
                )
              })
            )}
          </div>
        </section>

        <div className="w-home-side">
          <section className="w-card" aria-labelledby="home-today">
            <header className="w-card-head">
              <h2 id="home-today" className="w-card-title">
                <ClipboardTaskRegular fontSize={18} />
                {t('home.start.today')}
              </h2>
              {overdueCount > 0 ? (
                <span className="w-tag w-tag--danger">{t('home.start.overdue', { n: overdueCount })}</span>
              ) : null}
            </header>
            <div className="w-rows">
              {loading ? (
                [0, 1].map((n) => (
                  <div key={n} className="w-row">
                    <span className="w-skeleton w-skeleton--text" style={{ width: 32, height: 32 }} />
                    <span className="w-row-main">
                      <span className="w-skeleton w-skeleton--text" style={{ width: '52%' }} />
                    </span>
                  </div>
                ))
              ) : tasksPreview.length === 0 ? (
                <div className="w-empty" style={{ minHeight: 140, padding: '28px 16px' }}>
                  <span className="w-empty-icon" aria-hidden><CheckmarkCircleRegular fontSize={24} /></span>
                  <span className="w-empty-desc">{t('home.start.noTasks')}</span>
                </div>
              ) : (
                tasksPreview.map((a) => {
                  const diff = daysLeft(a.at)
                  const tone = diff < 0 ? 'danger' : diff <= 3 ? 'warning' : 'neutral'
                  return (
                    <button key={a.key} type="button" className="w-row w-row--button" onClick={() => openAlert(a)}>
                      <span className="w-row-icon w-row-icon--neutral" aria-hidden><ClipboardTaskRegular fontSize={16} /></span>
                      <span className="w-row-main">
                        <span className="w-row-title">{a.title}</span>
                        <span className="w-row-desc">{a.libName} · {dayjs(a.at).format('MM-DD')}</span>
                      </span>
                      <span className={`w-tag w-tag--${tone}`}>
                        {diff < 0
                          ? t('dash.overdue', { n: -diff })
                          : diff === 0
                            ? t('dash.today')
                            : t('dash.inDays', { n: diff })}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </section>

          <section className="w-card" aria-labelledby="home-overview">
            <header className="w-card-head">
              <h2 id="home-overview" className="w-card-title">
                <DatabaseRegular fontSize={18} />
                {t('home.start.overview')}
              </h2>
            </header>
            <div className="w-rows">
              <div className="w-row">
                <span className="w-row-main"><span className="w-row-title">{t('dash.stat.libs')}</span></span>
                <span className="w-fact-value w-fact-value--sm">{fmt(totalLibs)}</span>
              </div>
              <div className="w-row">
                <span className="w-row-main"><span className="w-row-title">{t('dash.stat.items')}</span></span>
                <span className="w-fact-value w-fact-value--sm">{fmt(totalItems)}</span>
              </div>
              <div className="w-row">
                <span className="w-row-main"><span className="w-row-title">{t('dash.stat.week')}</span></span>
                <span className="w-fact-value w-fact-value--sm">+{fmt(itemsThisWeek)}</span>
              </div>
            </div>
          </section>

          <section className="w-card" aria-labelledby="home-settings">
            <header className="w-card-head">
              <h2 id="home-settings" className="w-card-title">
                <SettingsRegular fontSize={18} />
                {t('home.start.quickSettings')}
              </h2>
            </header>
            <div className="w-rows">
              <button type="button" className="w-row w-row--button" onClick={openAI}>
                <span className="w-row-icon" aria-hidden><SparkleRegular fontSize={16} /></span>
                <span className="w-row-main">
                  <span className="w-row-title">{t('home.start.aiTitle')}</span>
                  <span className="w-row-desc">{t('home.start.aiBody')}</span>
                </span>
                <ChevronRightRegular fontSize={14} className="w-row-chevron" aria-hidden />
              </button>
              <button type="button" className="w-row w-row--button" onClick={() => navigate('/settings')}>
                <span className="w-row-icon w-row-icon--neutral" aria-hidden><ShieldCheckmarkRegular fontSize={16} /></span>
                <span className="w-row-main">
                  <span className="w-row-title">{t('home.start.localTitle')}</span>
                  <span className="w-row-desc">
                    {`${t('home.start.syncLocal')} · ${fmt(totalLibs)} ${t('dash.stat.libs')} · ${fmt(totalItems)} ${t('dash.stat.items')}`}
                  </span>
                </span>
                <ChevronRightRegular fontSize={14} className="w-row-chevron" aria-hidden />
              </button>
              <button type="button" className="w-row w-row--button" onClick={() => setTplOpen(true)}>
                <span className="w-row-icon w-row-icon--neutral" aria-hidden><LibraryRegular fontSize={16} /></span>
                <span className="w-row-main"><span className="w-row-title">{t('tpl.center.entry')}</span></span>
                <ChevronRightRegular fontSize={14} className="w-row-chevron" aria-hidden />
              </button>
              <button type="button" className="w-row w-row--button" onClick={() => navigate('/trash')}>
                <span className="w-row-icon w-row-icon--neutral" aria-hidden><DeleteRegular fontSize={16} /></span>
                <span className="w-row-main"><span className="w-row-title">{t('app.trash')}</span></span>
                <ChevronRightRegular fontSize={14} className="w-row-chevron" aria-hidden />
              </button>
              <button type="button" className="w-row w-row--button" onClick={() => navigate('/help')}>
                <span className="w-row-icon w-row-icon--neutral" aria-hidden><QuestionCircleRegular fontSize={16} /></span>
                <span className="w-row-main"><span className="w-row-title">{t('app.help')}</span></span>
                <ChevronRightRegular fontSize={14} className="w-row-chevron" aria-hidden />
              </button>
            </div>
          </section>
        </div>
      </div>

      <TemplateCenter open={tplOpen} onClose={() => setTplOpen(false)} />
    </div>
  )
}
