/**
 * 帮助中心 · v9「WINDOWS 11 GET HELP」
 *
 * 视觉合同（`redesign-brief/11-v9-win11-desktop.md` §8 帮助）：
 *   桌面壁纸 + Win11 无边框窗口；内容 = 「获取帮助」页头（返回应用按钮在标题栏）+
 *   大搜索框 + 4 张主题卡 + FAQ Win11 Expander + 产品说明书（左侧目录 + 右侧正文）。
 *   正文 14/20、标题 20 semibold；不用卡片套卡片、不用旧 index 编号 / 英文 kicker。
 *
 * 行为保留（与视觉无关）：
 *   - 帮助内容来自 content/manualZh|manualEn（按语言切换，结构与数据不变）；
 *   - 支持 #ch-xxx 直达、目录随滚动高亮（IntersectionObserver）；
 *   - 目录点击跳转章节；本页新增的搜索框只在本地过滤既有文档，不发请求。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Grid } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeftRegular,
  BookRegular,
  ChevronDownRegular,
  ChevronRightRegular,
  CloudSyncRegular,
  DismissRegular,
  DocumentRegular,
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

/** 提示块：Win11 InfoBar（图标 + 中性底，不套卡片） */
function Note({ kind, title, text }: { kind: 'tip' | 'warn' | 'info'; title?: string; text: string }) {
  const Icon = kind === 'tip' ? LightbulbRegular : kind === 'warn' ? WarningRegular : InfoRegular
  return (
    <div className={`pub-doc-note pub-doc-note--${kind}`}>
      <Icon fontSize={16} aria-hidden />
      <div className="pub-doc-note-main">
        {title ? <div className="pub-doc-note-title">{title}</div> : null}
        <div className="pub-doc-note-text">{text}</div>
      </div>
    </div>
  )
}

/** 说明书内容块渲染（14/20 正文 + Win11 表格 / 代码块 / 步骤条） */
function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'p':
            return (
              <p key={i} className="pub-doc-p">
                {b.text}
              </p>
            )
          case 'ul':
            return (
              <ul key={i} className="pub-doc-list">
                {b.items.map((x, j) => (
                  <li key={j}>{x}</li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={i} className="pub-doc-list pub-doc-list--ol">
                {b.items.map((x, j) => (
                  <li key={j}>{x}</li>
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
                      <div className="pub-doc-step-title">{x.title}</div>
                      {x.text ? <div className="pub-doc-step-text">{x.text}</div> : null}
                    </div>
                  </li>
                ))}
              </ol>
            )
          case 'table':
            return (
              <div key={i} className="pub-doc-table-wrap">
                <table className="w-table pub-doc-table">
                  <thead>
                    <tr>
                      {b.head.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td key={c}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
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
  const screens = Grid.useBreakpoint()
  const twoCol = !!screens.lg
  const scrollRef = useRef<HTMLDivElement>(null)

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
        const haystack = [
          chapter.title,
          section.title,
          ...section.blocks.map(blockText),
        ]
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

  const toc = (
    <div className="pub-toc-list">
      {manual.chapters.map((c) => {
        const isActive = active === c.id
        return (
          <button
            key={c.id}
            type="button"
            className={`pub-toc-row${isActive ? ' is-active' : ''}`}
            onClick={() => jump(c.id)}
            aria-current={isActive ? 'true' : undefined}
          >
            <span className="pub-toc-row-label">{c.title}</span>
            <span className="pub-toc-count" aria-hidden>
              {c.sections.length}
            </span>
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="pub-stage">
      <div className="pub-frame">
        {/* Win11 标题栏：应用标识 + 主题 / 语言 / 返回应用 */}
        <header className="w-titlebar">
          <button type="button" className="w-titlebar-brand" onClick={() => navigate('/')} aria-label={t('app.home')}>
            <AppIcon size={16} />
            <span className="w-titlebar-title">{t('help.title')}</span>
          </button>
          <div className="w-titlebar-drag" />
          <div className="w-titlebar-tools">
            <button
              type="button"
              className="w-titlebar-tool"
              aria-label={isDark ? t('app.theme.light') : t('app.theme.dark')}
              title={isDark ? t('app.theme.light') : t('app.theme.dark')}
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
            >
              {isDark ? <WeatherSunnyRegular fontSize={15} /> : <WeatherMoonRegular fontSize={15} />}
            </button>
            <button
              type="button"
              className="w-titlebar-tool w-titlebar-tool--text"
              aria-label={t('app.language')}
              title={t('app.language')}
              onClick={() => setLanguage(lang === 'zh' ? 'en' : 'zh')}
            >
              {lang === 'zh' ? 'EN' : '中'}
            </button>
            <span className="w-sep--v" aria-hidden />
            <button type="button" className="w-btn w-btn--subtle w-btn--sm" onClick={() => navigate('/')}>
              <ArrowLeftRegular fontSize={14} aria-hidden />
              {t('help.backHome')}
            </button>
          </div>
        </header>

        <div className="pub-frame-body">
          <div className="pub-scroll" ref={scrollRef}>
            <div className="w-page pub-help">
              <header className="w-page-head">
                <div className="w-head-main">
                  <h1 className="w-title">{t('help.title')}</h1>
                  <p className="w-desc">{manual.subtitle}</p>
                </div>
              </header>

              {/* 大搜索框：本地过滤说明书标题 / 正文 / 提示块 */}
              <div className="pub-help-search" role="search">
                <div className="w-search">
                  <SearchRegular fontSize={16} aria-hidden />
                  <input
                    type="search"
                    className="w-search-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && results[0]) {
                        e.preventDefault()
                        jumpToSection(results[0].chapter, results[0].section)
                      }
                    }}
                    placeholder={L('搜索帮助与产品说明书', 'Search help and the manual')}
                    aria-label={L('搜索帮助与产品说明书', 'Search help and the manual')}
                  />
                  {query ? (
                    <button
                      type="button"
                      className="w-iconbtn w-iconbtn--sm pub-search-clear"
                      onClick={() => setQuery('')}
                      aria-label={L('清除搜索', 'Clear search')}
                    >
                      <DismissRegular fontSize={14} />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* 搜索结果 */}
              {q ? (
                <div className="w-card pub-help-results">
                  <div className="pub-help-doc-head">
                    <div className="pub-help-doc-title">
                      {L('搜索结果', 'Search results')}
                      <span className="w-count">{results.length}</span>
                    </div>
                    <button type="button" className="w-btn w-btn--subtle w-btn--sm" onClick={() => setQuery('')}>
                      {L('清除', 'Clear')}
                    </button>
                  </div>
                  {results.length ? (
                    <div className="w-rows">
                      {results.map(({ chapter, section }) => (
                        <button
                          key={`${chapter.id}-${section.id}`}
                          type="button"
                          className="w-row w-row--button"
                          onClick={() => jumpToSection(chapter, section)}
                        >
                          <span className="w-row-icon w-row-icon--neutral" aria-hidden>
                            <DocumentRegular fontSize={16} />
                          </span>
                          <span className="w-row-main">
                            <span className="w-row-title">{section.title}</span>
                            <span className="w-row-desc">{chapter.title}</span>
                          </span>
                          <ChevronRightRegular fontSize={14} className="w-row-chevron" aria-hidden />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="w-empty pub-help-empty">
                      <span className="w-empty-icon" aria-hidden>
                        <SearchRegular fontSize={26} />
                      </span>
                      <div className="w-empty-title">{L('没有找到相关内容', 'No matching help topics')}</div>
                      <div className="w-empty-desc">
                        {L(
                          '换个关键词试试，比如「同步」「密码」或「备份」。',
                          'Try another keyword, such as sync, password or backup.',
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* 主题卡片 */}
              <section className="pub-topic-grid" aria-label={L('帮助主题', 'Help topics')}>
                {topics.map((topic) => {
                  const Icon = topic.icon
                  return (
                    <button
                      key={topic.chapterId}
                      type="button"
                      className="w-card pub-topic"
                      onClick={() => jump(topic.chapterId)}
                    >
                      <span className="w-row-icon" aria-hidden>
                        <Icon fontSize={18} />
                      </span>
                      <span className="pub-topic-main">
                        <span className="pub-topic-title">{topic.title}</span>
                        <span className="pub-topic-desc">{topic.desc}</span>
                      </span>
                    </button>
                  )
                })}
              </section>

              {/* 常见问题：Win11 Expander */}
              <section className="pub-section" aria-labelledby="pub-help-faq-title">
                <header className="pub-section-head">
                  <h2 id="pub-help-faq-title" className="pub-section-title">
                    {t('landing.faq.title')}
                  </h2>
                </header>
                <div className="w-card pub-faq">
                  {faqs.map(([question, answer]) => (
                    <details key={question} className="pub-expander">
                      <summary className="pub-expander-head">
                        <span className="pub-expander-title">{question}</span>
                        <ChevronDownRegular fontSize={16} className="pub-expander-chev" aria-hidden />
                      </summary>
                      <div className="pub-expander-body">{answer}</div>
                    </details>
                  ))}
                </div>
              </section>

              {/* 产品说明书：目录 + 正文 */}
              <div className={`pub-help-layout${twoCol ? ' pub-help-layout--split' : ''}`}>
                {twoCol ? (
                  <aside className="pub-help-aside" aria-label={t('help.toc')}>
                    <div className="w-card pub-toc">
                      <div className="pub-toc-head">{t('help.toc')}</div>
                      {toc}
                    </div>
                  </aside>
                ) : (
                  <details className="w-card pub-toc">
                    <summary className="pub-expander-head">
                      <span className="pub-expander-title">{t('help.toc')}</span>
                      <ChevronDownRegular fontSize={16} className="pub-expander-chev" aria-hidden />
                    </summary>
                    {toc}
                  </details>
                )}

                <main className="w-card pub-help-doc" aria-labelledby="pub-help-doc-title">
                  <div className="pub-help-doc-head">
                    <div id="pub-help-doc-title" className="pub-help-doc-title">
                      <BookRegular fontSize={18} aria-hidden />
                      {manual.title}
                    </div>
                    <span className="w-count">{manual.chapters.length}</span>
                  </div>
                  <div className="pub-help-doc-body">
                    {manual.chapters.map((chapter) => (
                      <section key={chapter.id} id={`ch-${chapter.id}`} className="pub-doc-chapter">
                        <h2 className="pub-doc-h2">{chapter.title}</h2>
                        {chapter.sections.map((section) => (
                          <div
                            key={section.id}
                            id={`sec-${chapter.id}-${section.id}`}
                            className="pub-doc-section"
                          >
                            <h3 className="pub-doc-h3">{section.title}</h3>
                            <Blocks blocks={section.blocks} />
                          </div>
                        ))}
                      </section>
                    ))}

                    <div className="pub-help-end">
                      <div className="pub-help-end-title">{t('help.endTitle')}</div>
                      <p className="pub-help-end-body">{t('help.endBody')}</p>
                      <div className="pub-help-support">
                        <span>{t('help.supportHint')}</span>
                        <SupportLink className="pub-link" />
                      </div>
                    </div>
                  </div>
                </main>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
