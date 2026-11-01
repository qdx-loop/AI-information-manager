/**
 * 帮助中心 · v4「硬边印刷 SIGNAL PRESS」
 *
 * `.workbench` + 页头（mono kicker `HELP / 使用帮助` + Outfit 800 标题 + page-sub）+ 2px 页线；
 * 两列：左 220 `.panel` sticky 目录（`.index-row`，选中 lime 底 + 左侧 4px ink），
 * 右 720 `.panel` 正文（2px ink 边；章标题 Outfit 700 20、小节 16、正文 15/1.7；
 * 代码块/表格用 panel 边框）。移动端目录折叠为 details，文末保留 SupportLink。
 * 内容来自 content/manualZh|manualEn，本文件只负责版式。
 */
import { useEffect, useMemo, useState } from 'react'
import { Grid } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import type { Block, Manual } from '@/content/manualTypes'
import { manualZh } from '@/content/manualZh'
import { manualEn } from '@/content/manualEn'
import { useI18n } from '@/i18n'
import { useAppStore } from '@/store/appStore'
import SupportLink from '@/components/reward/SupportLink'

/** 接口地址 / 模型名：原样等宽显示，不能被折行毁掉 */
const CODE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--t-2xs)',
  background: 'var(--panel)',
  border: '2px solid var(--line)',
  padding: '12px 14px',
  overflowX: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  color: 'var(--ink)',
  lineHeight: 1.6,
  margin: '0 0 18px',
}

/** 提示块：左 6px 色条 + panel 底 + 2px ink 边（不用柔和阴影/圆角） */
function Note({ kind, title, text }: { kind: 'tip' | 'warn' | 'info'; title?: string; text: string }) {
  const bar = kind === 'tip' ? 'var(--lime)' : kind === 'warn' ? 'var(--warning)' : 'var(--ink)'
  return (
    <div
      style={{
        border: '2px solid var(--line)',
        borderLeft: `6px solid ${bar}`,
        background: 'var(--panel)',
        padding: '12px 14px',
        margin: '0 0 18px',
      }}
    >
      {title && (
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'var(--t-base)',
            color: 'var(--ink)',
            marginBottom: 4,
          }}
        >
          {title}
        </div>
      )}
      <div style={{ color: 'var(--ink-soft)', fontSize: 'var(--t-base)', lineHeight: 1.7 }}>{text}</div>
    </div>
  )
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'p':
            return (
              <p
                key={i}
                style={{
                  margin: '0 0 16px',
                  fontSize: 'var(--t-base)',
                  lineHeight: 1.7,
                  color: 'var(--ink)',
                }}
              >
                {b.text}
              </p>
            )
          case 'ul':
          case 'ol': {
            const Tag = b.t === 'ul' ? 'ul' : 'ol'
            return (
              <Tag
                key={i}
                style={{
                  margin: '0 0 16px',
                  paddingLeft: 22,
                  fontSize: 'var(--t-base)',
                  lineHeight: 1.7,
                  color: 'var(--ink)',
                }}
              >
                {b.items.map((x, j) => (
                  <li key={j} style={{ marginBottom: 6 }}>
                    {x}
                  </li>
                ))}
              </Tag>
            )
          }
          case 'steps':
            return (
              <ol style={{ margin: '0 0 18px', paddingLeft: 0, listStyle: 'none' }} key={i}>
                {b.items.map((x, j) => (
                  <li key={j} style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                    <span
                      style={{
                        flexShrink: 0,
                        width: 26,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--t-2xs)',
                        fontWeight: 700,
                        color: 'var(--ink-faint)',
                        marginTop: 3,
                      }}
                    >
                      {String(j + 1).padStart(2, '0')}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 700,
                          color: 'var(--ink)',
                          marginBottom: 2,
                          fontSize: 'var(--t-base)',
                        }}
                      >
                        {x.title}
                      </div>
                      {x.text && (
                        <div style={{ color: 'var(--ink-soft)', fontSize: 'var(--t-base)', lineHeight: 1.7 }}>
                          {x.text}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )
          case 'table':
            return (
              <div
                key={i}
                style={{
                  border: '2px solid var(--line)',
                  overflowX: 'auto',
                  margin: '0 0 18px',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 'var(--t-sm)',
                    minWidth: 520,
                  }}
                >
                  <thead>
                    <tr>
                      {b.head.map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: 'left',
                            padding: '10px 12px',
                            background: 'var(--ink)',
                            color: 'var(--on-ink)',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            fontSize: 'var(--t-2xs)',
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td
                            key={c}
                            style={{
                              padding: '9px 12px',
                              borderBottom: '1px solid var(--line-soft)',
                              color: 'var(--ink)',
                              lineHeight: 1.6,
                              verticalAlign: 'top',
                              // 60 字符长的接口地址不允许断行会把表撑到横向滚动
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {cell}
                          </td>
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
              <pre key={i} style={CODE}>
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

export default function HelpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const t = useI18n()
  const lang = useAppStore((s) => s.settings.language ?? 'zh')
  const manual: Manual = lang === 'en' ? manualEn : manualZh
  const [active, setActive] = useState(manual.chapters[0]?.id ?? '')
  const screens = Grid.useBreakpoint()
  const twoCol = !!screens.lg
  const threeCol = !!screens.xl

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

  const jump = (id: string) => {
    setActive(id)
    window.history.replaceState(null, '', `#ch-${id}`)
    document.getElementById(`ch-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const toc = useMemo(
    () => (
      <div className="index-list">
        {manual.chapters.map((c, i) => {
          const isActive = active === c.id
          return (
            <button
              key={c.id}
              type="button"
              className="index-row"
              onClick={() => jump(c.id)}
              style={{
                background: isActive ? 'var(--lime)' : undefined,
                color: isActive ? 'var(--on-lime)' : undefined,
                borderLeft: isActive ? '4px solid var(--ink)' : '4px solid transparent',
              }}
            >
              <span
                className="index-num"
                style={{ color: isActive ? 'var(--on-lime)' : undefined }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="index-main">
                <span
                  className="index-title"
                  style={{
                    whiteSpace: 'normal',
                    color: isActive ? 'var(--on-lime)' : undefined,
                  }}
                >
                  {c.title}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    ),
    [manual, active],
  )


  /** 右栏「常用入口」（仅 ≥1200 三列时出现；四行都用既有 key） */
  const quickLinks = (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-kicker">LINKS</span>
        <span className="panel-title" style={{ fontSize: 'var(--t-base)' }}>
          {t('dash.quick.title')}
        </span>
      </div>
      <div className="index-list">
        {[
          { key: 'settings', label: t('settings.pageTitle'), go: () => navigate('/settings') },
          { key: 'trash', label: t('app.trash'), go: () => navigate('/trash') },
          { key: 'support', label: t('support.link'), go: () => navigate('/settings?tab=support') },
          { key: 'home', label: t('help.backHome'), go: () => navigate('/') },
        ].map((row, i) => (
          <button key={row.key} type="button" className="index-row" onClick={row.go}>
            <span className="index-num">{String(i + 1).padStart(2, '0')}</span>
            <span className="index-main">
              <span className="index-title">{row.label}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="workbench">
      <header className="page-head">
        <div className="page-head-main">
          <div className="page-kicker">{t('help.kicker')}</div>
          <h1 className="page-title">{manual.title}</h1>
          <p className="page-sub">{manual.subtitle}</p>
        </div>
        <div className="page-head-actions">
          <button type="button" className="link-quiet" onClick={() => navigate('/')}>
            {t('help.backHome')}
          </button>
        </div>
      </header>
      <div className="page-bar" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: threeCol
            ? '220px minmax(0, 1fr) 260px'
            : twoCol
              ? '220px minmax(0, 1fr)'
              : '1fr',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* 目录：桌面 sticky panel；移动 details 折叠 */}
        {twoCol ? (
          <aside style={{ position: 'sticky', top: 16 }}>
            <div className="panel">
              <div className="panel-head">
                <span className="panel-kicker">{t('help.toc')}</span>
              </div>
              {toc}
            </div>
          </aside>
        ) : (
          <details className="panel">
            <summary
              style={{
                cursor: 'pointer',
                padding: '12px 16px',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--t-2xs)',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--ink)',
              }}
            >
              {t('help.toc')}
            </summary>
            {toc}
          </details>
        )}

        <main style={{ minWidth: 0, maxWidth: threeCol ? undefined : 860 }}>
          <div className="panel">
            <div className="panel-head">
              <span className="panel-kicker">{t('help.docKicker')}</span>
              <span className="count-chip">{manual.chapters.length}</span>
            </div>
            <div className="panel-body">
              {manual.chapters.map((c) => (
                <section key={c.id} id={`ch-${c.id}`} style={{ scrollMarginTop: 24, marginBottom: 36 }}>
                  <h2
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--t-lg)',
                      fontWeight: 700,
                      lineHeight: 1.25,
                      margin: '0 0 14px',
                      color: 'var(--ink)',
                    }}
                  >
                    {c.title}
                  </h2>
                  {c.sections.map((s) => (
                    <div key={s.id} style={{ marginBottom: 28 }}>
                      <h3
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 'var(--t-base)',
                          fontWeight: 700,
                          margin: '0 0 10px',
                          color: 'var(--ink)',
                        }}
                      >
                        {s.title}
                      </h3>
                      <Blocks blocks={s.blocks} />
                    </div>
                  ))}
                </section>
              ))}

              <div className="rule" style={{ margin: '0 0 16px' }} />
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--t-2xs)',
                  lineHeight: 1.6,
                  margin: 0,
                  color: 'var(--ink-faint)',
                }}
              >
                {t('help.supportHint')} <SupportLink />
              </p>
            </div>
          </div>
        </main>

        {threeCol ? <aside style={{ position: 'sticky', top: 16 }}>{quickLinks}</aside> : null}
      </div>
    </div>
  )
}
