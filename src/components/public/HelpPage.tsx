import { useEffect, useMemo, useState } from 'react'
import { Alert, Card, Tag, Typography, Button, Space } from 'antd'
import {
  CheckCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import type { Block, Manual } from '@/content/manualTypes'
import { manualZh } from '@/content/manualZh'
import { manualEn } from '@/content/manualEn'
import { useI18n } from '@/i18n'
import { useAppStore } from '@/store/appStore'

const { Title, Paragraph } = Typography

/** 说明书里的「接口地址 / 模型名」必须原样显示，不能被自动折行或富文本渲染改掉 */
const MONO: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 13,
  background: 'var(--app-surface-sunken)',
  border: '1px solid var(--app-border-soft)',
  borderRadius: 6,
  padding: '10px 12px',
  overflowX: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  color: 'var(--app-ink)',
  lineHeight: 1.7,
}

function Note({ kind, title, text }: { kind: 'tip' | 'warn' | 'info'; title?: string; text: string }) {
  // 三类提示各有主题语义色：提示=品牌绿，注意=窑火琥珀，重要=中性蓝灰
  const map = {
    tip: { icon: <ThunderboltOutlined />, color: 'var(--app-glaze)' },
    warn: { icon: <WarningOutlined />, color: 'var(--app-kiln-text)' },
    info: { icon: <InfoCircleOutlined />, color: 'var(--app-ink-soft)' },
  } as const
  const m = map[kind]
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 10,
        background: 'var(--app-surface-sunken)',
        borderLeft: `3px solid ${m.color}`,
        margin: '4px 0 4px',
      }}
    >
      <span style={{ color: m.color, marginTop: 3, flexShrink: 0 }}>{m.icon}</span>
      <div style={{ minWidth: 0 }}>
        {title && (
          <div style={{ fontWeight: 600, color: 'var(--app-ink)', marginBottom: 3 }}>{title}</div>
        )}
        <div style={{ color: 'var(--app-ink-soft)', lineHeight: 1.75 }}>{text}</div>
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
              <Paragraph key={i} style={{ marginBottom: 12, lineHeight: 1.85, color: 'var(--app-ink-soft)' }}>
                {b.text}
              </Paragraph>
            )
          case 'ul':
            return (
              <ul key={i} style={{ margin: '0 0 14px', paddingLeft: 20, color: 'var(--app-ink-soft)', lineHeight: 1.85 }}>
                {b.items.map((x, j) => (
                  <li key={j} style={{ marginBottom: 5 }}>
                    {x}
                  </li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={i} style={{ margin: '0 0 14px', paddingLeft: 20, color: 'var(--app-ink-soft)', lineHeight: 1.85 }}>
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
                      style={{
                        flexShrink: 0,
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        background: 'var(--app-glaze-soft)',
                        color: 'var(--app-glaze-text)',
                        fontSize: 12,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 2,
                      }}
                    >
                      {j + 1}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--app-ink)', marginBottom: 2 }}>{x.title}</div>
                      {x.text && (
                        <div style={{ color: 'var(--app-ink-soft)', lineHeight: 1.8 }}>{x.text}</div>
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
                    fontSize: 13.5,
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
                            padding: '9px 12px',
                            background: 'var(--app-surface-sunken)',
                            color: 'var(--app-ink-soft)',
                            fontWeight: 600,
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
                              padding: '9px 12px',
                              borderBottom: '1px solid var(--app-border-soft)',
                              color: 'var(--app-ink-soft)',
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
              <pre key={i} style={MONO}>
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
  const [active, setActive] = useState(manual.chapters[0].id)

  // 支持 #ch-xxx 直达：目录链接可以被收藏/分享给别人
  useEffect(() => {
    const id = location.hash.replace('#', '')
    if (!id.startsWith('ch-')) return
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' })
    }, 60)
    return () => window.clearTimeout(t)
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
    () =>
      manual.chapters.map((c) => (
        <a
          key={c.id}
          onClick={() => jump(c.id)}
          style={{
            display: 'block',
            padding: '7px 12px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13.5,
            lineHeight: 1.5,
            marginBottom: 2,
            background: active === c.id ? 'var(--app-glaze-soft)' : 'transparent',
            color: active === c.id ? 'var(--app-glaze-text)' : 'var(--app-ink-soft)',
            fontWeight: active === c.id ? 600 : 400,
          }}
        >
          {c.title}
        </a>
      )),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manual, active],
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-canvas)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 16px 64px' }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Tag color="var(--app-glaze)">{t('help.docBadge')}</Tag>
          <Button onClick={() => navigate('/')} size="small">
            {t('help.backHome')}
          </Button>
        </Space>

        <Title level={2} style={{ marginTop: 0, marginBottom: 6, fontSize: 26 }}>
          {manual.title}
        </Title>
        <Paragraph style={{ color: 'var(--app-ink-soft)', fontSize: 15, maxWidth: 720, marginBottom: 24 }}>
          {manual.subtitle}
        </Paragraph>

        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          {/* 目录：桌面固定在左侧 */}
          <nav
            style={{
              width: 240,
              flexShrink: 0,
              position: 'sticky',
              top: 24,
              display: 'block',
            }}
            className="manual-toc"
          >
            <div style={{ fontSize: 12, color: 'var(--app-ink-faint)', marginBottom: 8, letterSpacing: 0.4 }}>
              {t('help.toc')}
            </div>
            {toc}
          </nav>

          <main style={{ flex: 1, minWidth: 0 }}>
            {manual.chapters.map((c) => (
              <section
                key={c.id}
                id={`ch-${c.id}`}
                style={{ scrollMarginTop: 20, marginBottom: 12 }}
              >
                <Card
                  title={
                    <span style={{ fontSize: 17, fontWeight: 600 }}>{c.title}</span>
                  }
                  style={{ marginBottom: 20, borderColor: 'var(--app-border-soft)' }}
                  styles={{ body: { paddingTop: 8 } }}
                >
                  {c.sections.map((s) => (
                    <div key={s.id} style={{ marginBottom: 26 }}>
                      <Title level={5} style={{ fontSize: 15, marginBottom: 10, marginTop: 4 }}>
                        {s.title}
                      </Title>
                      <Blocks blocks={s.blocks} />
                    </div>
                  ))}
                </Card>
              </section>
            ))}

            <Alert
              type="info"
              showIcon
              icon={<CheckCircleOutlined />}
              style={{ borderRadius: 10 }}
              message={t('help.endTitle')}
              description={t('help.endBody')}
            />
          </main>
        </div>
      </div>
    </div>
  )
}
