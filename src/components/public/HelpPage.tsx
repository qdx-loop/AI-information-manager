/**
 * 帮助中心 · v10「FLUENT UI 2 · Windows 11 应用（获取帮助）」
 *
 * 用户反馈（2026-11-02）：v9 的「Windows 窗口 + 壁纸」是错的——
 * 这是 Windows 11 风格的 Web 应用页面，不是操作系统模拟。
 *
 * v10 形态（`redesign-brief/12-v10-fluent-app.md` §4 帮助）：
 *   满屏 Fluent 应用页：48px app bar（AppIcon + 帮助 + 主题/语言/返回应用）→
 *   页头（帮助中心 + 说明）→ Fluent SearchBox（本地过滤）→ 4 张主题 Card →
 *   FAQ Fluent Accordion → 左侧目录 Card + 右侧正文 Card（14/20）。
 *
 * 行为保留（与视觉无关）：
 *   - 帮助内容来自 content/manualZh|manualEn（按语言切换，结构与数据不变）；
 *   - 支持 #ch-xxx 直达、目录随滚动高亮（IntersectionObserver）；
 *   - 目录点击跳转章节；搜索框只在本地过滤既有文档，不发请求。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Badge,
  Button,
  Card,
  CardHeader,
  Divider,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  SearchBox,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Tooltip,
} from '@fluentui/react-components'
import {
  ArrowLeftRegular,
  BookRegular,
  ChevronRightRegular,
  CloudSyncRegular,
  DocumentRegular,
  GlobeRegular,
  InfoRegular,
  KeyRegular,
  LightbulbRegular,
  RocketRegular,
  SearchRegular,
  SparkleRegular,
  WarningRegular,
  WeatherMoonRegular,
  WeatherSunnyRegular,
  type FluentIcon,
} from '@fluentui/react-icons'
import type { Block, Chapter, Manual, Section } from '@/content/manualTypes'
import { manualZh } from '@/content/manualZh'
import { manualEn } from '@/content/manualEn'
import { useI18n } from '@/i18n'
import { useAppStore } from '@/store/appStore'
import AppIcon from '@/components/common/AppIcon'
import SupportLink from '@/components/reward/SupportLink'

/** 内容块的纯文本（搜索用；不改变渲染） */
function blockText(b: Block): string {
  switch (b.t) {
    case 'p':
      return b.text
    case 'ul':
    case 'ol':
      return b.items.join(' ')
    case 'steps':
      return b.items.map((x) => `${x.title} ${x.text}`).join(' ')
    case 'table':
      return [...b.head, ...b.rows.flat()].join(' ')
    case 'note':
      return `${b.title ?? ''} ${b.text}`
    case 'code':
      return b.text
    default:
      return ''
  }
}

/** 说明块 → Fluent MessageBar（info / warning） */
function Note({ kind, title, text }: { kind: 'tip' | 'warn' | 'info'; title?: string; text: string }) {
  const Icon = kind === 'tip' ? LightbulbRegular : kind === 'warn' ? WarningRegular : InfoRegular
  return (
    <MessageBar intent={kind === 'warn' ? 'warning' : 'info'} className="pub-doc-note">
      <MessageBarBody>
        {title ? <MessageBarTitle>{title}</MessageBarTitle> : null}
        <div className="pub-doc-note-text">
          <Icon aria-hidden /> {text}
        </div>
      </MessageBarBody>
    </MessageBar>
  )
}

/** 说明书内容块渲染（正文 14/20；表格用 Fluent Table、提示用 MessageBar） */
function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'p':
            return (
              <Text as="p" key={i} size={300} className="pub-doc-p">
                {b.text}
              </Text>
            )
          case 'ul':
            return (
              <ul key={i} className="pub-doc-list">
                {b.items.map((x, j) => (
                  <li key={j}>
                    <Text size={300}>{x}</Text>
                  </li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={i} className="pub-doc-list pub-doc-list--ol">
                {b.items.map((x, j) => (
                  <li key={j}>
                    <Text size={300}>{x}</Text>
                  </li>
                ))}
              </ol>
            )
          case 'steps':
            return (
              <ol key={i} className="pub-doc-steps">
                {b.items.map((x, j) => (
                  <li key={j} className="pub-doc-step">
                    <span className="pub-doc-step-num" aria-hidden>
                      {String(j + 1).padStart(2, '0')}
                    </span>
                    <div className="pub-doc-step-main">
                      <Text size={300} weight="semibold">
                        {x.title}
                      </Text>
                      {x.text ? (
                        <Text as="p" size={300} className="w-muted">
                          {x.text}
                        </Text>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )
          case 'table':
            return (
              <div key={i} className="pub-doc-table-wrap">
                <Table size="small">
                  <TableHeader>
                    <TableRow>
                      {b.head.map((h) => (
                        <TableHeaderCell key={h}>{h}</TableHeaderCell>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {b.rows.map((row, r) => (
                      <TableRow key={r}>
                        {row.map((cell, c) => (
                          <TableCell key={c}>{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          case 'note':
            return <Note key={i} kind={b.kind} title={b.title} text={b.text} />
          case 'code':
            return (
              <pre key={i} className="pub-doc-code">
                {b.text}
              </pre>
            )
          default:
            return null
        }
      })}
    </>
  )
}

interface SearchHit {
  chapter: Chapter
  section: Section
}

export default function HelpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const t = useI18n()
  const lang = useAppStore((s) => s.settings.language ?? 'zh')
  const setLanguage = useAppStore((s) => s.setLanguage)
  const theme = useAppStore((s) => s.settings.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const manual: Manual = lang === 'en' ? manualEn : manualZh
  const [active, setActive] = useState(manual.chapters[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)

  /** 组件内新增文案按当前语言取（不改 i18n 文件） */
  const L = (zh: string, en: string) => (lang === 'en' ? en : zh)
  const isDark = theme === 'dark'

  // 支持 #ch-xxx 直达：目录链接可收藏/分享
  useEffect(() => {
    const id = location.hash.replace('#', '')
    if (!id.startsWith('ch-')) return
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' })
    }, 60)
    return () => window.clearTimeout(timer)
  }, [location.hash])

  // 目录随章滚动高亮
  useEffect(() => {
    const ids = manual.chapters.map((c) => `ch-${c.id}`)
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    if (!els.length || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting)
        if (hit) setActive(hit.target.id.replace('ch-', ''))
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [manual])

  const jump = (chapterId: string) => {
    setActive(chapterId)
    window.history.replaceState(null, '', `#ch-${chapterId}`)
    document.getElementById(`ch-${chapterId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /** 搜索结果点击：清空搜索 → 跳到对应小节 */
  const jumpToSection = (chapter: Chapter, section: Section) => {
    setActive(chapter.id)
    window.history.replaceState(null, '', `#ch-${chapter.id}`)
    setQuery('')
    window.setTimeout(() => {
      document
        .getElementById(`sec-${chapter.id}-${section.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 40)
  }

  const q = query.trim().toLowerCase()
  const results: SearchHit[] = useMemo(() => {
    if (!q) return []
    const hits: SearchHit[] = []
    for (const chapter of manual.chapters) {
      for (const section of chapter.sections) {
        const haystack = [chapter.title, section.title, ...section.blocks.map(blockText)]
          .join(' ')
          .toLowerCase()
        if (haystack.includes(q)) hits.push({ chapter, section })
      }
    }
    return hits.slice(0, 12)
  }, [manual, q])

  // 主题卡：四类常见问题（点击跳到对应章节）
  const topics: { icon: FluentIcon; title: string; desc: string; chapterId: string }[] = [
    {
      icon: RocketRegular,
      title: L('开始使用', 'Get started'),
      desc: L('从注册到第一条记录', 'From sign-up to your first record'),
      chapterId: 'start',
    },
    {
      icon: SparkleRegular,
      title: L('AI 助手', 'AI assistant'),
      desc: L('录入、查询、一句话出图', 'Add, search and chart by talking'),
      chapterId: 'ai',
    },
    {
      icon: CloudSyncRegular,
      title: L('同步与备份', 'Sync & backup'),
      desc: L('局域网直传与云端存储', 'LAN transfer and your own cloud'),
      chapterId: 'sync',
    },
    {
      icon: KeyRegular,
      title: L('账户与隐私', 'Account & privacy'),
      desc: L('密码、数据归属与安全', 'Passwords, ownership and safety'),
      chapterId: 'privacy',
    },
  ]

  const faqs: [string, string][] = [
    [t('help.q.data'), t('help.a.data')],
    [t('help.q.password'), t('help.a.password')],
    [t('help.q.sync'), t('help.a.sync')],
    [t('help.q.cloud'), t('help.a.cloud')],
    [t('help.q.tips'), t('help.a.tips')],
  ]

  const showResults = q.length > 0

  return (
    <div className="w-app">
      <header className="w-appbar pub-appbar">
        <div className="w-appbar-brand">
          <button
            type="button"
            className="w-appbar-brand-btn"
            onClick={() => navigate('/')}
            aria-label={t('help.backHome')}
          >
            <AppIcon size={20} />
            <span className="w-appbar-title">{t('help.title')}</span>
          </button>
        </div>
        <div className="w-appbar-spacer" />
        <div className="w-appbar-tools">
          <Tooltip content={isDark ? t('app.theme.light') : t('app.theme.dark')} relationship="label">
            <Button
              appearance="subtle"
              icon={isDark ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
              aria-label={isDark ? t('app.theme.light') : t('app.theme.dark')}
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
            />
          </Tooltip>
          <Tooltip content={t('app.language')} relationship="label">
            <Button
              appearance="subtle"
              icon={<GlobeRegular />}
              aria-label={t('app.language')}
              onClick={() => setLanguage(lang === 'zh' ? 'en' : 'zh')}
            >
              <span className="pub-lang-label">{lang === 'zh' ? '中' : 'EN'}</span>
            </Button>
          </Tooltip>
          <Button
            appearance="subtle"
            icon={<ArrowLeftRegular />}
            onClick={() => navigate('/')}
            aria-label={t('help.backHome')}
          >
            <span className="pub-appbar-back">{t('help.backHome')}</span>
          </Button>
        </div>
      </header>

      <div className="w-content" ref={contentRef}>
        <div className="pub-container pub-help">
          <header className="pub-help-head">
            <Text as="h1" size={800} weight="semibold">
              {t('help.title')}
            </Text>
            <Text size={300} className="w-muted">
              {manual.subtitle}
            </Text>
          </header>

          {/* 大搜索框：本地过滤说明书标题 / 正文 / 提示块 */}
          <SearchBox
            className="pub-help-search"
            size="large"
            value={query}
            placeholder={L('搜索帮助与产品说明书', 'Search help and the manual')}
            input={{ 'aria-label': L('搜索帮助与产品说明书', 'Search help and the manual') }}
            onChange={(_, data) => setQuery(data.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) {
                e.preventDefault()
                jumpToSection(results[0].chapter, results[0].section)
              }
            }}
          />

          {/* 搜索结果 */}
          {showResults ? (
            <Card appearance="filled" className="pub-results-card">
              <CardHeader
                header={
                  <Text size={400} weight="semibold">
                    {L('搜索结果', 'Search results')}{' '}
                    <Badge appearance="tint" color="brand">
                      {results.length}
                    </Badge>
                  </Text>
                }
                action={
                  <Button appearance="subtle" size="small" onClick={() => setQuery('')}>
                    {L('清除', 'Clear')}
                  </Button>
                }
              />
              <Divider />
              {results.length ? (
                <div className="pub-results-list">
                  {results.map(({ chapter, section }) => (
                    <button
                      key={`${chapter.id}-${section.id}`}
                      type="button"
                      className="pub-result-row"
                      onClick={() => jumpToSection(chapter, section)}
                    >
                      <DocumentRegular className="pub-result-icon" aria-hidden />
                      <span className="pub-result-main">
                        <Text size={300}>{section.title}</Text>
                        <Text size={200} className="w-faint">
                          {chapter.title}
                        </Text>
                      </span>
                      <ChevronRightRegular className="w-faint" aria-hidden />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="pub-help-empty">
                  <SearchRegular fontSize={28} aria-hidden />
                  <Text size={400} weight="semibold">
                    {L('没有找到相关内容', 'No matching help topics')}
                  </Text>
                  <Text size={300} className="w-muted">
                    {L(
                      '换个关键词试试，比如「同步」「密码」或「备份」。',
                      'Try another keyword, such as sync, password or backup.',
                    )}
                  </Text>
                </div>
              )}
            </Card>
          ) : null}

          {/* 主题卡片 */}
          <div className="pub-topic-grid" role="navigation" aria-label={L('帮助主题', 'Help topics')}>
            {topics.map((topic) => {
              const Icon = topic.icon
              return (
                <button
                  key={topic.chapterId}
                  type="button"
                  className="pub-card-btn"
                  onClick={() => jump(topic.chapterId)}
                >
                  <Card appearance="filled" className="pub-topic-card">
                    <CardHeader
                      image={
                        <span className="pub-icon-badge" aria-hidden>
                          <Icon fontSize={20} />
                        </span>
                      }
                      header={
                        <Text size={400} weight="semibold">
                          {topic.title}
                        </Text>
                      }
                      description={
                        <Text size={200} className="w-faint">
                          {topic.desc}
                        </Text>
                      }
                    />
                  </Card>
                </button>
              )
            })}
          </div>

          {/* 常见问题：Fluent Accordion */}
          <section className="pub-section" aria-labelledby="pub-help-faq-title">
            <Text as="h2" id="pub-help-faq-title" size={600} weight="semibold">
              {t('landing.faq.title')}
            </Text>
            <Card appearance="filled" className="pub-faq-card">
              <Accordion multiple collapsible>
                {faqs.map(([question, answer], index) => (
                  <AccordionItem key={question} value={index}>
                    <AccordionHeader>{question}</AccordionHeader>
                    <AccordionPanel>
                      <Text as="p" size={300} className="w-muted">
                        {answer}
                      </Text>
                    </AccordionPanel>
                  </AccordionItem>
                ))}
              </Accordion>
            </Card>
          </section>

          {/* 产品说明书：目录 + 正文 */}
          <div className="pub-help-layout">
            <aside className="pub-help-aside" aria-label={t('help.toc')}>
              <Card appearance="filled" className="pub-toc-card">
                <CardHeader
                  header={
                    <Text size={300} weight="semibold">
                      {t('help.toc')}
                    </Text>
                  }
                />
                <nav className="pub-toc-list">
                  {manual.chapters.map((chapter) => {
                    const isActive = active === chapter.id
                    return (
                      <button
                        key={chapter.id}
                        type="button"
                        className={`pub-toc-row${isActive ? ' is-active' : ''}`}
                        onClick={() => jump(chapter.id)}
                        aria-current={isActive ? 'true' : undefined}
                      >
                        <span className="pub-toc-row-label">{chapter.title}</span>
                        <span className="pub-toc-count" aria-hidden>
                          {chapter.sections.length}
                        </span>
                      </button>
                    )
                  })}
                </nav>
              </Card>
            </aside>

            <main className="pub-help-doc-wrap" aria-labelledby="pub-help-doc-title">
              <Card appearance="filled" className="pub-help-doc">
                <CardHeader
                  image={
                    <span className="pub-icon-badge" aria-hidden>
                      <BookRegular fontSize={20} />
                    </span>
                  }
                  header={
                    <Text as="h2" id="pub-help-doc-title" size={600} weight="semibold">
                      {manual.title}
                    </Text>
                  }
                  action={
                    <Badge appearance="tint" color="brand">
                      {manual.chapters.length}
                    </Badge>
                  }
                />
                <Divider />
                <div className="pub-doc-body">
                  {manual.chapters.map((chapter) => (
                    <section key={chapter.id} id={`ch-${chapter.id}`} className="pub-doc-chapter">
                      <Text as="h3" size={500} weight="semibold" className="pub-doc-h2">
                        {chapter.title}
                      </Text>
                      {chapter.sections.map((section) => (
                        <div key={section.id} id={`sec-${chapter.id}-${section.id}`} className="pub-doc-section">
                          <Text as="h4" size={400} weight="semibold" className="pub-doc-h3">
                            {section.title}
                          </Text>
                          <Blocks blocks={section.blocks} />
                        </div>
                      ))}
                    </section>
                  ))}

                  <div className="pub-help-end">
                    <Text as="p" size={400} weight="semibold">
                      {t('help.endTitle')}
                    </Text>
                    <Text as="p" size={300} className="w-muted">
                      {t('help.endBody')}
                    </Text>
                    <div className="pub-help-support">
                      <Text size={200} className="w-faint">
                        {t('help.supportHint')}
                      </Text>
                      <SupportLink />
                    </div>
                  </div>
                </div>
              </Card>
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
