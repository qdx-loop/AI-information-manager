/**
 * 帮助中心 ·『官纸账簿』说明书版式
 *
 * 目标：做成「说明书」而不是「FAQ 卡片墙」。
 *   · 左 200px sticky 目录（mono 编号 + 当前项 2px 朱砂左线）
 *   · 右正文 max-width 720、16/1.75（行宽 ≤ 40 汉字）
 *   · 章节标题衬线 20，小节标题无衬线加粗（两级层次靠字号/留白，不靠卡片）
 *   · 行内代码/字段名用 sunken 底 + 2px 圆角
 *   · 移动端目录折叠为 <details>
 *   · 文末一行 12px 灰字指向「设置 → 关于与支持」（纯文字）
 *
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

/** 说明书里的「接口地址 / 模型名」必须原样显示，不能被自动折行或富文本渲染改掉 */
const CODE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  background: 'var(--app-surface-sunken)',
  border: '1px solid var(--app-border-soft)',
  borderRadius: 2,
  padding: '10px 12px',
  overflowX: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  color: 'var(--app-ink)',
  lineHeight: 1.7,
  margin: '4px 0 16px',
}

/**
 * 提示框：一条 2px 竖线 + 一行说明，不用彩色底色块。
 * kind 只决定竖线颜色（tip=朱砂、warn=赭、info=墨阶），文字永远是正文色。
 */
function Note({ kind, title, text }: { kind: 'tip' | 'warn' | 'info'; title?: string; text: string }) {
  const color =
    kind === 'tip'
      ? 'var(--app-accent)'
      : kind === 'warn'
        ? 'var(--app-warning)'
        : 'var(--app-border-strong)'
  return (
    <div
      style={{
        borderLeft: `2px solid ${color}`,
        background: 'var(--app-surface-sunken)',
        borderRadius: 2,
        padding: '10px 14px',
        margin: '4px 0 16px',
      }}
    >
      {title && (
        <div style={{ fontWeight: 600, color: 'var(--app-ink)', marginBottom: 3, fontSize: 13 }}>
          {title}
        </div>
      )}
      <div style={{ color: 'var(--app-ink-soft)', fontSize: 14, lineHeight: 1.75 }}>{text}</div>
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
                  margin: '0 0 14px',
                  fontSize: 16,
                  lineHeight: 1.75,
                  color: 'var(--app-ink)',
                }}
              >
                {b.text}
              </p>
            )
          case 'ul':
            return (
              <ul
                key={i}
                style={{
                  margin: '0 0 14px',
                  paddingLeft: 20,
                  fontSize: 16,
                  lineHeight: 1.75,
                  color: 'var(--app-ink)',
                }}
              >
                {b.items.map((x, j) => (
                  <li key={j} style={{ marginBottom: 5 }}>
                    {x}
                  </li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol
                key={i}
                style={{
                  margin: '0 0 14px',
                  paddingLeft: 20,
                  fontSize: 16,
                  lineHeight: 1.75,
                  color: 'var(--app-ink)',
                }}
              >
                {b.items.map((x, j) => (
                  <li key={j} style={{ marginBottom: 5 }}>
                    {x}
                  </li>
                ))}
              </ol>
            )
          case 'steps':
            return (
              <ol style={{ margin: '0 0 16px', paddingLeft: 0, listStyle: 'none' }} key={i}>
                {b.items.map((x, j) => (
                  <li key={j} style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                    <span
                      className="mono"
                      style={{
                        flexShrink: 0,
                        width: 22,
                        fontSize: 11,
                        letterSpacing: '0.06em',
                        color: 'var(--app-ink-faint)',
                        marginTop: 4,
                      }}
                    >
                      {String(j + 1).padStart(2, '0')}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--app-ink)',
                          marginBottom: 2,
                          fontSize: 14,
                        }}
                      >
                        {x.title}
                      </div>
                      {x.text && (
                        <div style={{ color: 'var(--app-ink)', fontSize: 16, lineHeight: 1.75 }}>
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
              <div key={i} style={{ overflowX: 'auto', margin: '4px 0 16px' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 14,
                    minWidth: 520,
                  }}
                >
                  <thead>
                    <tr>
                      {b.head.map((h) => (
                        <th
                          key={h}
                          className="eyebrow"
                          style={{
                            textAlign: 'left',
                            padding: '8px 12px',
                            background: 'var(--app-surface-sunken)',
                            color: 'var(--app-ink-soft)',
                            fontWeight: 500,
                            borderBottom: '1px solid var(--app-border)',
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
                              borderBottom: '1px solid var(--app-rule)',
                              color: 'var(--app-ink)',
                              lineHeight: 1.7,
                              verticalAlign: 'top',
                              // 速查表里有 60 字符长的接口地址，不允许断行会把整张表撑到
                              // 需要横向滚动才能看完；这里允许在任意处断
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

  // 目录随章节滚动高亮：IntersectionObserver 比监听 scroll 更省事也更准
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
                background: 'none',
                border: 'none',
                borderLeft: isActive
                  ? '2px solid var(--app-accent)'
                  : '2px solid transparent',
                padding: '6px 0 6px 10px',
                marginBottom: 2,
                cursor: 'pointer',
                font: 'inherit',
                fontSize: 13,
                lineHeight: 1.5,
                color: isActive ? 'var(--app-ink)' : 'var(--app-ink-soft)',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 11, color: 'var(--app-ink-faint)', flexShrink: 0 }}
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

  const tocTitle = (
    <div className="eyebrow" style={{ marginBottom: 8 }}>
      {t('help.toc')}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-canvas)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: wide ? '40px 32px 72px' : '24px 16px 56px' }}>
        {/* 页头：眉题 + 唯一 26px 标题 + 一行说明 */}
        <header style={{ marginBottom: 32 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {t('help.docBadge')}
          </div>
          <h1 className="serif page-title" style={{ margin: 0 }}>
            {manual.title}
          </h1>
          <p className="page-lede" style={{ margin: '8px 0 0', maxWidth: 720 }}>
            {manual.subtitle}
          </p>
          <div style={{ marginTop: 12 }}>
            <button type="button" className="link-quiet" onClick={() => navigate('/')}>
              {t('help.backHome')}
            </button>
          </div>
          <div className="rule" style={{ marginTop: 20 }} />
        </header>

        <div
          style={{
            display: wide ? 'grid' : 'block',
            gridTemplateColumns: wide ? '200px minmax(0, 1fr)' : undefined,
            gap: wide ? 48 : 0,
            alignItems: 'start',
          }}
        >
          {/* 目录：桌面 sticky；移动折叠 */}
          {wide ? (
            <aside style={{ position: 'sticky', top: 24 }}>
              {tocTitle}
              {toc}
            </aside>
          ) : (
            <details style={{ marginBottom: 24 }}>
              <summary
                style={{
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--app-ink)',
                  padding: '8px 0',
                  borderTop: '1px solid var(--app-rule)',
                  borderBottom: '1px solid var(--app-rule)',
                }}
              >
                {t('help.toc')}
              </summary>
              <div style={{ paddingTop: 8 }}>{toc}</div>
            </details>
          )}

          <main style={{ maxWidth: 720, minWidth: 0 }}>
            {manual.chapters.map((c, ci) => (
              <section
                key={c.id}
                id={`ch-${c.id}`}
                style={{ scrollMarginTop: 20, marginBottom: 40 }}
              >
                <h2
                  className="serif"
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    lineHeight: 1.4,
                    margin: '0 0 16px',
                    color: 'var(--app-ink)',
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: 'var(--app-ink-faint)',
                      marginRight: 8,
                      letterSpacing: '0.06em',
                    }}
                  >
                    {String(ci + 1).padStart(2, '0')}
                  </span>
                  {c.title}
                </h2>
                {c.sections.map((s) => (
                  <div key={s.id} style={{ marginBottom: 28 }}>
                    <h3
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        margin: '0 0 10px',
                        color: 'var(--app-ink)',
                      }}
                    >
                      {s.title}
                    </h3>
                    <Blocks blocks={s.blocks} />
                  </div>
                ))}
              </section>
            ))}

            {/* 文末：一行 12px 灰字，指向设置里的「关于与支持」（纯文字，不放码） */}
            <div className="rule" style={{ margin: '8px 0 16px' }} />
            <p className="faint" style={{ fontSize: 12, lineHeight: 1.8, margin: 0 }}>
              {t('help.supportHint')} <SupportLink />
            </p>
          </main>
        </div>
      </div>
    </div>
  )
}
