/**
 * 帮助中心 · v3『石墨信号』
 *
 * 左 200 白卡 sticky 目录（当前项 accent-wash + 3px accent 左条）+ 右 720 白卡正文；
 * 正文 16/1.7，章标题 20/600，小节标题 16/600；行内代码/字段名用 sunken 底。
 * 移动端目录折叠（<details>），文末保留 SupportLink（纯文字）。
 * 内容仍来自 content/manualZh|manualEn（结构化文档），本文件只负责版式。
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

/** 代码 / 接口地址：不能被折行或富文本改掉 */
const CODE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-xs)',
  background: 'var(--bg-sunken)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-2)',
  padding: '10px 14px',
  overflowX: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  color: 'var(--ink)',
  lineHeight: 1.7,
  margin: '4px 0 16px',
}

/** 提示块：左 3px 色条 + sunken 底，不用整块彩色 Alert */
function Note({ kind, title, text }: { kind: 'tip' | 'warn' | 'info'; title?: string; text: string }) {
  const color =
    kind === 'tip' ? 'var(--accent)' : kind === 'warn' ? 'var(--warning)' : 'var(--border-strong)'
  return (
    <div
      style={{
        borderLeft: `3px solid ${color}`,
        background: 'var(--bg-sunken)',
        borderRadius: 'var(--r-2)',
        padding: '12px 16px',
        margin: '4px 0 16px',
      }}
    >
      {title && (
        <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4, fontSize: 'var(--text-sm)' }}>
          {title}
        </div>
      )}
      <div style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-base)', lineHeight: 1.7 }}>
        {text}
      </div>
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
                  fontSize: 'var(--text-base)',
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
                  fontSize: 'var(--text-base)',
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
                      className="mono"
                      style={{
                        flexShrink: 0,
                        width: 22,
                        fontSize: 'var(--text-2xs)',
                        color: 'var(--ink-faint)',
                        marginTop: 4,
                      }}
                    >
                      {String(j + 1).padStart(2, '0')}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--ink)',
                          marginBottom: 2,
                          fontSize: 'var(--text-base)',
                        }}
                      >
                        {x.title}
                      </div>
                      {x.text && (
                        <div style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-base)', lineHeight: 1.7 }}>
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
                className="surface-sunken"
                style={{ overflowX: 'auto', margin: '4px 0 18px' }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 'var(--text-sm)',
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
                            padding: '8px 12px',
                            color: 'var(--ink-muted)',
                            fontWeight: 500,
                            fontSize: 'var(--text-2xs)',
                            borderBottom: '1px solid var(--border-strong)',
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
                              padding: '8px 12px',
                              borderBottom: '1px solid var(--border-rule)',
                              color: 'var(--ink)',
                              lineHeight: 1.65,
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
  const wide = !!screens.lg

  // 支持 #ch-xxx 直达：目录链接可以被收藏/分享给别人
  useEffect(() => {
    const id = location.hash.replace('#', '')
    if (!id.startsWith('ch-')) return
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' })
    }, 60)
    return () => window.clearTimeout(timer)
  }, [location.hash])

  // 目录随章节滚动高亮
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
      <nav aria-label={t('help.toc')}>
        {manual.chapters.map((c, i) => {
          const isActive = active === c.id
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => jump(c.id)}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                width: '100%',
                textAlign: 'left',
                background: isActive ? 'var(--accent-wash)' : 'none',
                border: 'none',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                borderRadius: 'var(--r-1)',
                padding: '8px 10px',
                marginBottom: 2,
                cursor: 'pointer',
                font: 'inherit',
                fontSize: 'var(--text-xs)',
                lineHeight: 1.45,
                color: isActive ? 'var(--ink)' : 'var(--ink-muted)',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-faint)', flexShrink: 0 }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{c.title}</span>
            </button>
          )
        })}
      </nav>
    ),
    [manual, active, t],
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)' }}>
      <div
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: wide ? '24px 32px 64px' : '16px 16px 48px',
        }}
      >
        <header className="page-head">
          <div className="page-head-main">
            <div className="eyebrow">{t('help.title')}</div>
            <h1 className="page-title">{manual.title}</h1>
            <p className="page-lede" style={{ maxWidth: 720 }}>
              {manual.subtitle}
            </p>
          </div>
          <div className="page-head-actions">
            <button type="button" className="link-quiet" onClick={() => navigate('/')}>
              {t('help.backHome')}
            </button>
          </div>
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: wide ? '200px minmax(0, 1fr)' : '1fr',
            gap: 24,
            alignItems: 'start',
          }}
        >
          {/* 目录：桌面 sticky 白卡；移动折叠 */}
          {wide ? (
            <aside style={{ position: 'sticky', top: 24 }}>
              <div className="surface-card" style={{ padding: 8 }}>
                <div
                  className="eyebrow"
                  style={{ padding: '4px 10px 8px' }}
                >
                  {t('help.toc')}
                </div>
                {toc}
              </div>
            </aside>
          ) : (
            <details className="surface-card" style={{ padding: 12 }}>
              <summary
                style={{
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  color: 'var(--ink)',
                }}
              >
                {t('help.toc')}
              </summary>
              <div style={{ paddingTop: 8 }}>{toc}</div>
            </details>
          )}

          <main style={{ minWidth: 0 }}>
            <div className="surface-card" style={{ padding: wide ? '32px 40px' : '20px 16px', maxWidth: 720 }}>
              {manual.chapters.map((c) => (
                <section key={c.id} id={`ch-${c.id}`} style={{ scrollMarginTop: 24, marginBottom: 36 }}>
                  <h2
                    style={{
                      fontSize: 'var(--text-lg)',
                      fontWeight: 600,
                      lineHeight: 1.35,
                      margin: '0 0 16px',
                      color: 'var(--ink)',
                    }}
                  >
                    {c.title}
                  </h2>
                  {c.sections.map((s) => (
                    <div key={s.id} style={{ marginBottom: 28 }}>
                      <h3
                        style={{
                          fontSize: 'var(--text-base)',
                          fontWeight: 600,
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

              {/* 文末：一行 12px 灰字，指向设置里的「关于与支持」（纯文字） */}
              <div className="divider" style={{ margin: '8px 0 16px' }} />
              <p className="faint" style={{ fontSize: 'var(--text-2xs)', lineHeight: 1.7, margin: 0 }}>
                {t('help.supportHint')} <SupportLink />
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
