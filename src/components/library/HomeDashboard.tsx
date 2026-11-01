/**
 * 首页 · Windows 11 原生（Fluent 2 / Win11 Start + Settings 混合）
 *
 * 用户要求：首页与任何旧版本「一丝一毫关系都没有」，完全按 microsoft/fluentui
 * React v9 与 Windows 11 原生应用规范重做：
 *   - 无网页 Dashboard 卡片/KPI 大色块/渐变；
 *   - 原生页头 + 「已固定」大图标磁贴 + 「推荐 / 今天」列表 + 设置式快速行；
 *   - Mica 内容 + Acrylic 面板 + Fluent 低饱和组件。
 * 数据读取与行为（打开库/条目、AI、模板、设置）保持不变。
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  Avatar,
  Badge,
  Body1,
  Body1Strong,
  Button,
  Caption1,
  MessageBar,
  MessageBarBody,
  Skeleton,
  SkeletonItem,
  Subtitle1,
  Title1,
  Title2,
  Tooltip,
} from '@fluentui/react-components'
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
    <div className="n-home">
      {notice}

      <header className="n-head">
        <div className="n-identity">
          <Avatar name={account?.username ?? '?'} size={48} color="colorful" />
          <div className="n-greeting">
            <Caption1 className="n-muted">{dateLabel()} · {t('landing.marquee.local')}</Caption1>
            <Title1 className="n-title">{greeting || t('dash.titleFallback')}</Title1>
            <Body1 className="n-muted">
              {t('home.start.summary', { libs: fmt(totalLibs), items: fmt(totalItems) })}
            </Body1>
          </div>
        </div>
        <div className="n-tools">
          <Tooltip content={t('home.start.aiTitle')} relationship="label">
            <Button appearance="subtle" icon={<SparkleRegular />} onClick={openAI} aria-label={t('home.start.aiTitle')} />
          </Tooltip>
          <Button appearance="primary" icon={<AddRegular />} onClick={onCreate}>
            {t('app.newLibrary')}
          </Button>
        </div>
      </header>

      {error ? (
        <MessageBar intent="error">
          <MessageBarBody>
            <Body1Strong>{t('dash.loadFailed')}</Body1Strong>
            <Caption1>{error}</Caption1>
          </MessageBarBody>
          <Button appearance="secondary" icon={<ArrowClockwiseRegular />} onClick={() => setRetryKey((n) => n + 1)}>
            {t('dash.retry')}
          </Button>
        </MessageBar>
      ) : null}

      <section className="n-section" aria-labelledby="n-pinned">
        <header className="n-section-head">
          <Subtitle1 id="n-pinned">{t('home.start.pinned')}</Subtitle1>
          <Caption1 className="n-muted">{fmt(pinned.length)}</Caption1>
        </header>
        {noLib ? (
          <div className="n-surface n-empty">
            <span className="n-empty-icon" aria-hidden><AddRegular fontSize={26} /></span>
            <div className="n-empty-copy">
              <Title2>{t('home.start.emptyTitle')}</Title2>
              <Body1 className="n-muted">{t('home.start.emptyBody')}</Body1>
            </div>
            <div className="n-empty-actions">
              <Button appearance="primary" onClick={onCreate}>{t('home.createFirst')}</Button>
              <Button appearance="secondary" onClick={() => setTplOpen(true)}>{t('tpl.center.entry')}</Button>
            </div>
          </div>
        ) : (
          <div className="n-pinned">
            {pinned.map((lib, i) => {
              const Icon = iconForLibrary(lib)
              return (
                <button key={lib.id} type="button" className="n-pin" onClick={() => openLibrary(lib)} title={lib.name}>
                  <span className={`n-pin-icon n-tone-${i % 6}`} aria-hidden><Icon fontSize={24} /></span>
                  <span className="n-pin-name">{lib.name}</span>
                  <Caption1 className="n-muted n-pin-meta">
                    {loading ? '—' : `${fmt(extras.counts[lib.id] ?? 0)} · ${lib.category || t('app.group.libraries')}`}
                  </Caption1>
                </button>
              )
            })}
            <button type="button" className="n-pin n-pin--add" onClick={onCreate}>
              <span className="n-pin-icon n-pin-add" aria-hidden><AddRegular fontSize={22} /></span>
              <span className="n-pin-name">{t('home.start.pinAdd')}</span>
              <Caption1 className="n-muted n-pin-meta">{t('tpl.center.entry')}</Caption1>
            </button>
          </div>
        )}
      </section>

      <div className="n-grid">
        <section className="n-section" aria-labelledby="n-recent">
          <header className="n-section-head">
            <Subtitle1 id="n-recent">{t('home.start.recommended')}</Subtitle1>
            {recent.length > 0 ? (
              <Button appearance="subtle" size="small" onClick={() => openLibrary(libraries[0])}>{t('home.start.viewAll')}</Button>
            ) : null}
          </header>
          <div className="n-surface">
            {loading ? (
              <div className="n-skeleton">{[0, 1, 2].map((n) => <Skeleton key={n}><SkeletonItem size={36} /></Skeleton>)}</div>
            ) : recent.length === 0 ? (
              <div className="n-row n-row--empty"><HistoryRegular fontSize={18} aria-hidden /><Caption1 className="n-muted">{t('home.start.noRecent')}</Caption1></div>
            ) : (
              recent.map((r) => {
                const lib = libraries.find((l) => l.id === r.libId)
                const Icon = lib ? iconForLibrary(lib) : DocumentRegular
                return (
                  <button key={r.key} type="button" className="n-row" onClick={() => { focusItem(r.itemId); navigate(`/library/${r.libId}`) }}>
                    <span className="n-row-icon" aria-hidden><Icon fontSize={18} /></span>
                    <span className="n-row-copy">
                      <Body1Strong className="n-row-title">{r.title}</Body1Strong>
                      <Caption1 className="n-muted">{r.libName} · {dayjs(r.updatedAt).format('MM-DD HH:mm')}</Caption1>
                    </span>
                    <ChevronRightRegular fontSize={14} className="n-chev" aria-hidden />
                  </button>
                )
              })
            )}
          </div>
        </section>

        <section className="n-section" aria-labelledby="n-today">
          <header className="n-section-head">
            <Subtitle1 id="n-today">{t('home.start.today')}</Subtitle1>
            {overdueCount > 0 ? <Badge appearance="tint" color="danger">{t('home.start.overdue', { n: overdueCount })}</Badge> : null}
          </header>
          <div className="n-surface">
            {loading ? (
              <div className="n-skeleton">{[0, 1].map((n) => <Skeleton key={n}><SkeletonItem size={36} /></Skeleton>)}</div>
            ) : tasksPreview.length === 0 ? (
              <div className="n-row n-row--empty"><CheckmarkCircleRegular fontSize={18} aria-hidden /><Caption1 className="n-muted">{t('home.start.noTasks')}</Caption1></div>
            ) : (
              tasksPreview.map((a) => {
                const diff = daysLeft(a.at)
                const color = diff < 0 ? 'danger' : diff <= 3 ? 'warning' : 'informative'
                return (
                  <button key={a.key} type="button" className="n-row" onClick={() => openAlert(a)}>
                    <span className="n-row-icon" aria-hidden><ClipboardTaskRegular fontSize={18} /></span>
                    <span className="n-row-copy">
                      <Body1Strong className="n-row-title">{a.title}</Body1Strong>
                      <Caption1 className="n-muted">{a.libName} · {dayjs(a.at).format('MM-DD')}</Caption1>
                    </span>
                    <Badge appearance="tint" color={color}>
                      {diff < 0 ? t('dash.overdue', { n: -diff }) : diff === 0 ? t('dash.today') : t('dash.inDays', { n: diff })}
                    </Badge>
                  </button>
                )
              })
            )}
          </div>
        </section>
      </div>

      <section className="n-section" aria-labelledby="n-more">
        <header className="n-section-head"><Subtitle1 id="n-more">{t('home.start.quick')}</Subtitle1></header>
        <div className="n-surface">
          <button type="button" className="n-row n-row--56" onClick={openAI}>
            <span className="n-row-icon n-row-icon--accent" aria-hidden><SparkleRegular fontSize={18} /></span>
            <span className="n-row-copy">
              <Body1Strong className="n-row-title">{t('home.start.aiTitle')}</Body1Strong>
              <Caption1 className="n-muted">{t('home.start.aiBody')}</Caption1>
            </span>
            <ChevronRightRegular fontSize={14} className="n-chev" aria-hidden />
          </button>
          <button type="button" className="n-row n-row--56" onClick={() => navigate('/settings')}>
            <span className="n-row-icon" aria-hidden><ShieldCheckmarkRegular fontSize={18} /></span>
            <span className="n-row-copy">
              <Body1Strong className="n-row-title">{t('home.start.localTitle')}</Body1Strong>
              <Caption1 className="n-muted">
                {`${t('home.start.syncLocal')} · ${fmt(totalLibs)} ${t('dash.stat.libs')} · ${fmt(totalItems)} ${t('dash.stat.items')} · +${fmt(itemsThisWeek)} ${t('dash.stat.week')}`}
              </Caption1>
            </span>
            <ChevronRightRegular fontSize={14} className="n-chev" aria-hidden />
          </button>
          <button type="button" className="n-row" onClick={() => setTplOpen(true)}>
            <span className="n-row-icon" aria-hidden><LibraryRegular fontSize={18} /></span>
            <span className="n-row-copy"><Body1Strong className="n-row-title">{t('tpl.center.entry')}</Body1Strong></span>
            <ChevronRightRegular fontSize={14} className="n-chev" aria-hidden />
          </button>
          <button type="button" className="n-row" onClick={() => navigate('/trash')}>
            <span className="n-row-icon" aria-hidden><DeleteRegular fontSize={18} /></span>
            <span className="n-row-copy"><Body1Strong className="n-row-title">{t('app.trash')}</Body1Strong></span>
            <ChevronRightRegular fontSize={14} className="n-chev" aria-hidden />
          </button>
          <button type="button" className="n-row" onClick={() => navigate('/settings')}>
            <span className="n-row-icon" aria-hidden><SettingsRegular fontSize={18} /></span>
            <span className="n-row-copy"><Body1Strong className="n-row-title">{t('app.settings')}</Body1Strong></span>
            <ChevronRightRegular fontSize={14} className="n-chev" aria-hidden />
          </button>
          <button type="button" className="n-row" onClick={() => navigate('/help')}>
            <span className="n-row-icon" aria-hidden><QuestionCircleRegular fontSize={18} /></span>
            <span className="n-row-copy"><Body1Strong className="n-row-title">{t('app.help')}</Body1Strong></span>
            <ChevronRightRegular fontSize={14} className="n-chev" aria-hidden />
          </button>
        </div>
      </section>

      <TemplateCenter open={tplOpen} onClose={() => setTplOpen(false)} />
    </div>
  )
}
