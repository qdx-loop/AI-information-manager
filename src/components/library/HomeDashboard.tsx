/**
 * 首页 · Fluent UI 2（Windows 11 应用风格，不是操作系统）
 *
 * Fluent 组件：Text 字阶 / Card + CardHeader 内容卡 / Button / Badge / MessageBar /
 * Spinner / Divider；布局用 Fluent token（--w-* 全部别名到 Fluent 变量）。
 * 结构：页头（问候 + 主命令）→ 已固定库 → 最近修改 / 今天 / 数据概览 / 快速设置。
 * 数据读取与行为与 v9 完全一致。
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Divider,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Spinner,
  Text,
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

  const loadingRow = (
    <div className="w-home-loading">
      <Spinner size="tiny" />
      <Text size={300} className="w-faint">
        {t('lib.view.loading')}
      </Text>
    </div>
  )

  return (
    <div className="w-page w-home">
      {notice}

      <header className="w-page-head w-home-head">
        <div className="w-home-identity">
          <Avatar
            size={56}
            name={account?.username ?? '?'}
            initials={(account?.username ?? '?').slice(0, 1).toUpperCase()}
            color="colorful"
            aria-hidden
          />
          <div className="w-head-main">
            <Text as="h1" size={700} weight="semibold" className="w-home-title">
              {greeting || t('dash.titleFallback')}
            </Text>
            <Text size={300} className="w-muted">
              {dateLabel()} · {t('landing.marquee.local')} ·{' '}
              {t('home.start.summary', { libs: fmt(totalLibs), items: fmt(totalItems) })}
            </Text>
          </div>
        </div>
        <div className="w-actions">
          <Button appearance="secondary" icon={<SparkleRegular />} onClick={openAI}>
            {t('app.aiAssistant')}
          </Button>
          <Button appearance="primary" icon={<AddRegular />} onClick={onCreate}>
            {t('app.newLibrary')}
          </Button>
        </div>
      </header>

      {error ? (
        <MessageBar intent="error">
          <MessageBarBody>
            <Text weight="semibold">{t('dash.loadFailed')}</Text>
            <div>
              <Text size={200} className="w-faint">{error}</Text>
            </div>
          </MessageBarBody>
          <MessageBarActions>
            <Button
              appearance="secondary"
              size="small"
              icon={<ArrowClockwiseRegular />}
              onClick={() => setRetryKey((n) => n + 1)}
            >
              {t('dash.retry')}
            </Button>
          </MessageBarActions>
        </MessageBar>
      ) : null}

      <section className="w-home-section" aria-labelledby="home-pinned">
        <div className="w-home-section-head">
          <Text as="h2" id="home-pinned" size={500} weight="semibold">
            {t('home.start.pinned')}
          </Text>
          {pinned.length > 0 ? <Badge appearance="tint" color="brand">{fmt(pinned.length)}</Badge> : null}
        </div>
        {noLib ? (
          <Card appearance="filled" className="w-home-empty">
            <span className="w-home-empty-icon" aria-hidden>
              <AddRegular fontSize={24} />
            </span>
            <Text as="h3" size={500} weight="semibold">
              {t('home.start.emptyTitle')}
            </Text>
            <Text size={300} className="w-muted">{t('home.start.emptyBody')}</Text>
            <div className="w-actions">
              <Button appearance="primary" onClick={onCreate}>{t('home.createFirst')}</Button>
            </div>
          </Card>
        ) : (
          <div className="w-pin-grid">
            {pinned.map((lib) => {
              const Icon = iconForLibrary(lib)
              return (
                <button key={lib.id} type="button" className="w-pin-btn" onClick={() => openLibrary(lib)} title={lib.name}>
                  <Card appearance="filled" className="w-pin-card">
                    <CardHeader
                      image={
                        <span className="w-pin-icon" aria-hidden>
                          <Icon fontSize={20} />
                        </span>
                      }
                      header={<Text weight="semibold" size={300}>{lib.name}</Text>}
                      description={
                        <Text size={200} className="w-faint">
                          {loading ? '—' : `${fmt(extras.counts[lib.id] ?? 0)} · ${lib.category || t('app.group.libraries')}`}
                        </Text>
                      }
                      action={<ChevronRightRegular fontSize={14} className="w-pin-chev" aria-hidden />}
                    />
                  </Card>
                </button>
              )
            })}
            <button type="button" className="w-pin-btn" onClick={onCreate}>
              <Card appearance="outline" className="w-pin-card w-pin-card--add">
                <CardHeader
                  image={
                    <span className="w-pin-icon w-pin-icon--add" aria-hidden>
                      <AddRegular fontSize={20} />
                    </span>
                  }
                  header={<Text weight="semibold" size={300}>{t('home.start.pinAdd')}</Text>}
                  description={<Text size={200} className="w-faint">{t('home.start.blankLibHint')}</Text>}
                />
              </Card>
            </button>
          </div>
        )}
      </section>

      <div className="w-home-grid">
        <Card appearance="filled" className="w-home-recent">
          <CardHeader
            header={
              <span className="w-card-title-inline">
                <HistoryRegular fontSize={18} />
                <Text weight="semibold" size={400}>{t('home.start.recent')}</Text>
              </span>
            }
            action={
              recent.length > 0 ? (
                <Button appearance="subtle" size="small" onClick={() => openLibrary(libraries[0])}>
                  {t('home.start.viewAll')}
                </Button>
              ) : undefined
            }
          />
          <Divider />
          <div className="w-rows">
            {loading ? (
              loadingRow
            ) : recent.length === 0 ? (
              <div className="w-home-empty-row">
                <HistoryRegular fontSize={20} aria-hidden />
                <Text size={300} className="w-faint">{t('home.start.noRecent')}</Text>
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
                      <Text size={300} className="w-row-title">{r.title}</Text>
                      <Text size={200} className="w-row-desc">{r.libName} · {dayjs(r.updatedAt).format('MM-DD HH:mm')}</Text>
                    </span>
                    <ChevronRightRegular fontSize={14} className="w-row-chevron" aria-hidden />
                  </button>
                )
              })
            )}
          </div>
        </Card>

        <div className="w-home-side">
          <Card appearance="filled">
            <CardHeader
              header={
                <span className="w-card-title-inline">
                  <ClipboardTaskRegular fontSize={18} />
                  <Text weight="semibold" size={400}>{t('home.start.today')}</Text>
                </span>
              }
              action={
                overdueCount > 0 ? (
                  <Badge appearance="tint" color="danger">{t('home.start.overdue', { n: overdueCount })}</Badge>
                ) : undefined
              }
            />
            <Divider />
            <div className="w-rows">
              {loading ? (
                loadingRow
              ) : tasksPreview.length === 0 ? (
                <div className="w-home-empty-row">
                  <CheckmarkCircleRegular fontSize={20} aria-hidden />
                  <Text size={300} className="w-faint">{t('home.start.noTasks')}</Text>
                </div>
              ) : (
                tasksPreview.map((a) => {
                  const diff = daysLeft(a.at)
                  const color = diff < 0 ? 'danger' : diff <= 3 ? 'warning' : 'brand'
                  return (
                    <button key={a.key} type="button" className="w-row w-row--button" onClick={() => openAlert(a)}>
                      <span className="w-row-icon w-row-icon--neutral" aria-hidden><ClipboardTaskRegular fontSize={16} /></span>
                      <span className="w-row-main">
                        <Text size={300} className="w-row-title">{a.title}</Text>
                        <Text size={200} className="w-row-desc">{a.libName} · {dayjs(a.at).format('MM-DD')}</Text>
                      </span>
                      <Badge appearance="tint" color={color}>
                        {diff < 0 ? t('dash.overdue', { n: -diff }) : diff === 0 ? t('dash.today') : t('dash.inDays', { n: diff })}
                      </Badge>
                    </button>
                  )
                })
              )}
            </div>
          </Card>

          <Card appearance="filled">
            <CardHeader
              header={
                <span className="w-card-title-inline">
                  <DatabaseRegular fontSize={18} />
                  <Text weight="semibold" size={400}>{t('home.start.overview')}</Text>
                </span>
              }
            />
            <Divider />
            <div className="w-rows">
              <div className="w-row">
                <span className="w-row-main"><Text size={300}>{t('dash.stat.libs')}</Text></span>
                <Text size={400} weight="semibold">{fmt(totalLibs)}</Text>
              </div>
              <div className="w-row">
                <span className="w-row-main"><Text size={300}>{t('dash.stat.items')}</Text></span>
                <Text size={400} weight="semibold">{fmt(totalItems)}</Text>
              </div>
              <div className="w-row">
                <span className="w-row-main"><Text size={300}>{t('dash.stat.week')}</Text></span>
                <Text size={400} weight="semibold">+{fmt(itemsThisWeek)}</Text>
              </div>
            </div>
          </Card>

          <Card appearance="filled">
            <CardHeader
              header={
                <span className="w-card-title-inline">
                  <SettingsRegular fontSize={18} />
                  <Text weight="semibold" size={400}>{t('home.start.quickSettings')}</Text>
                </span>
              }
            />
            <Divider />
            <div className="w-rows">
              <button type="button" className="w-row w-row--button" onClick={openAI}>
                <span className="w-row-icon" aria-hidden><SparkleRegular fontSize={16} /></span>
                <span className="w-row-main">
                  <Text size={300} className="w-row-title">{t('home.start.aiTitle')}</Text>
                  <Text size={200} className="w-row-desc">{t('home.start.aiBody')}</Text>
                </span>
                <ChevronRightRegular fontSize={14} className="w-row-chevron" aria-hidden />
              </button>
              <button type="button" className="w-row w-row--button" onClick={() => navigate('/settings')}>
                <span className="w-row-icon w-row-icon--neutral" aria-hidden><ShieldCheckmarkRegular fontSize={16} /></span>
                <span className="w-row-main">
                  <Text size={300} className="w-row-title">{t('home.start.localTitle')}</Text>
                  <Text size={200} className="w-row-desc">
                    {`${t('home.start.syncLocal')} · ${fmt(totalLibs)} ${t('dash.stat.libs')} · ${fmt(totalItems)} ${t('dash.stat.items')}`}
                  </Text>
                </span>
                <ChevronRightRegular fontSize={14} className="w-row-chevron" aria-hidden />
              </button>
              <button type="button" className="w-row w-row--button" onClick={() => navigate('/trash')}>
                <span className="w-row-icon w-row-icon--neutral" aria-hidden><DeleteRegular fontSize={16} /></span>
                <span className="w-row-main"><Text size={300} className="w-row-title">{t('app.trash')}</Text></span>
                <ChevronRightRegular fontSize={14} className="w-row-chevron" aria-hidden />
              </button>
              <button type="button" className="w-row w-row--button" onClick={() => navigate('/help')}>
                <span className="w-row-icon w-row-icon--neutral" aria-hidden><QuestionCircleRegular fontSize={16} /></span>
                <span className="w-row-main"><Text size={300} className="w-row-title">{t('app.help')}</Text></span>
                <ChevronRightRegular fontSize={14} className="w-row-chevron" aria-hidden />
              </button>
            </div>
          </Card>
        </div>
      </div>

    </div>
  )
}
