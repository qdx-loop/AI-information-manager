import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App } from 'antd'
import {
  Dialog,
  DialogBody,
  DialogSurface,
  Input,
  Spinner,
  Text,
} from '@fluentui/react-components'
import {
  AddRegular,
  BotRegular,
  CloudSyncRegular,
  DeleteRegular,
  GlobeRegular,
  GridRegular,
  HomeRegular,
  QuestionCircleRegular,
  SaveRegular,
  SearchRegular,
  SettingsRegular,
  WeatherMoonRegular,
  WeatherSunnyRegular,
} from '@fluentui/react-icons'
import { useNavigate } from 'react-router-dom'
import { useLibraryStore } from '@/store/libraryStore'
import { useAppStore } from '@/store/appStore'
import { useAiUiStore } from '@/store/aiUiStore'
import { getProvider } from '@/db/providerFactory'
import { useI18n, tNow } from '@/i18n'
import type { Item } from '@/types'

import { useBackButtonLayer } from '@/utils/backButton'

interface Hit {
  kind: 'item'
  item: Item
  libraryId: string
  libraryName: string
  fieldLabel: string
  matched: string
}

interface Cmd {
  kind: 'cmd'
  id: string
  /** 分组标题：命令面板的第一层结构就是分组（VS Code 官方 UX 指南要求） */
  group: string
  label: string
  hint?: string
  icon: React.ReactNode
  run: () => void
}

type Row = Cmd | Hit

/**
 * 全局命令面板（Ctrl/Cmd + K）· v10 Fluent UI Dialog。
 *
 * 交互按命令面板的通行约定做全：
 * - ↑↓ 移动选中，Enter 执行，Esc 关闭（Fluent Dialog 原生支持 Esc）
 * - combobox 语义 + aria-activedescendant，读屏软件能播报当前选中项
 * - 结果分组显示，超过上限时明确告知被截断了多少
 *
 * 检索/命令逻辑与旧版完全一致；视觉改为 Fluent Dialog（Input + 分组结果 + 键盘提示）。
 */
const MAX_ITEM_HITS = 20

export default function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp()
  const t = useI18n()
  const navigate = useNavigate()
  const libraries = useLibraryStore((s) => s.libraries)
  const focusItem = useLibraryStore((s) => s.focusItem)
  const selectLibrary = useLibraryStore((s) => s.selectLibrary)
  const createLibrary = useLibraryStore((s) => s.createLibrary)
  const settings = useAppStore((s) => s.settings)
  const setTheme = useAppStore((s) => s.setTheme)
  const setLanguage = useAppStore((s) => s.setLanguage)
  const setAiOpen = useAiUiStore((s) => s.setOpen)

  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const [truncated, setTruncated] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setQ('')
    setHits([])
    setActive(0)
    setTruncated(false)
    const timer = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(timer)
  }, [open])

  // 只认最后一次查询：doSearch 是逐库串行 await 的，慢的那次可能后到。
  // 没有这道闸，⌘K 里先打「北京」再打「上海」，北京的结果会盖掉上海的结果，
  // 而输入框里显示的是上海。
  const seqRef = useRef(0)

  const doSearch = useCallback(
    async (keyword: string) => {
      const seq = ++seqRef.current
      const stale = () => seq !== seqRef.current
      const kw = keyword.trim().toLowerCase()
      if (!kw) {
        setHits([])
        setTruncated(false)
        return
      }
      setLoading(true)
      try {
        const out: Hit[] = []
        let pool = 0
        for (const lib of libraries) {
          // 每轮库之间也检查一次：库多时中途输入已经变了就别再白扫
          if (stale()) return
          let items: Item[] = []
          let labels: Record<string, string> = {}
          try {
            // 同时取模板：命中的字段要显示人话（「成交金额」），
            // 不能把内部 key（field_amount）暴露给用户
            const [its, tpl] = await Promise.all([
              getProvider().listItems(lib.id),
              getProvider().getTemplate(lib.id),
            ])
            items = its
            labels = Object.fromEntries((tpl ?? []).map((f) => [f.key, f.label]))
          } catch {
            continue // 单个库读失败不影响其它库
          }
          for (const it of items) {
            for (const [key, raw] of Object.entries(it.fields)) {
              const sval = String(raw ?? '')
              if (!sval.toLowerCase().includes(kw)) continue
              pool++
              out.push({
                kind: 'item',
                item: it,
                libraryId: lib.id,
                libraryName: lib.name,
                fieldLabel: labels[key] ?? key,
                matched: sval,
              })
              break // 一条记录只出现一次
            }
          }
        }
        if (stale()) return
        setTruncated(pool > MAX_ITEM_HITS)
        setHits(out.slice(0, MAX_ITEM_HITS))
      } catch {
        if (stale()) return
        setHits([])
      } finally {
        // 旧查询的 finally 不能关掉新查询的 loading
        if (!stale()) setLoading(false)
      }
    },
    [libraries],
  )

  useEffect(() => {
    void doSearch(q)
  }, [q, doSearch])

  const go = useCallback(
    (to: string) => {
      onClose()
      navigate(to)
    },
    [navigate, onClose],
  )

  /** 条目标题取第一个非空字段的值（和首页概览同口径；原来取第一个 key，
   *  碰上第一个字段为空就会显示「—」） */
  const titleOf = (it: Item): string => {
    for (const key of Object.keys(it.fields)) {
      const v = String(it.fields[key] ?? '').trim()
      if (v) return v
    }
    return tNow('common.emptyValue')
  }

  const commands = useMemo<Cmd[]>(() => {
    const isDark = settings.theme === 'dark'
    return [
      { kind: 'cmd', id: 'go-home', group: t('palette.group.nav'), label: t('app.home'), icon: <HomeRegular />, run: () => go('/') },
      { kind: 'cmd', id: 'go-trash', group: t('palette.group.nav'), label: t('app.trash'), icon: <DeleteRegular />, run: () => go('/trash') },
      { kind: 'cmd', id: 'go-settings', group: t('palette.group.nav'), label: t('app.settings'), icon: <SettingsRegular />, run: () => go('/settings') },
      { kind: 'cmd', id: 'go-help', group: t('palette.group.nav'), label: t('app.help'), icon: <QuestionCircleRegular />, run: () => go('/help') },
      {
        kind: 'cmd',
        id: 'new-lib',
        group: t('palette.group.act'),
        label: t('app.newLibrary'),
        icon: <AddRegular />,
        run: () => {
          onClose()
          void createLibrary(t('app.lib.namePlaceholder'), t('app.group.libraries')).catch((e) =>
            message.error(t('app.loadLibsFailed', { msg: (e as Error).message })),
          )
        },
      },
      { kind: 'cmd', id: 'open-ai', group: t('palette.group.act'), label: t('app.aiAssistant'), icon: <BotRegular />, run: () => { onClose(); setAiOpen(true) } },
      { kind: 'cmd', id: 'theme', group: t('palette.group.act'), label: isDark ? t('app.theme.light') : t('app.theme.dark'), icon: isDark ? <WeatherSunnyRegular /> : <WeatherMoonRegular />, run: () => setTheme(isDark ? 'light' : 'dark') },
      {
        kind: 'cmd',
        id: 'lang',
        group: t('palette.group.act'),
        label: `${t('app.language')}：${settings.language === 'zh' ? 'English' : '中文'}`,
        icon: <GlobeRegular />,
        run: () => setLanguage(settings.language === 'zh' ? 'en' : 'zh'),
      },
      { kind: 'cmd', id: 'backup', group: t('palette.group.act'), label: t('palette.backup'), icon: <SaveRegular />, run: () => go('/settings') },
      { kind: 'cmd', id: 'sync', group: t('palette.group.act'), label: t('palette.sync'), icon: <CloudSyncRegular />, run: () => go('/settings') },
    ]
  }, [t, go, createLibrary, onClose, setAiOpen, settings.theme, settings.language, setTheme, setLanguage, message])

  const libRows = useMemo<Cmd[]>(() => {
    const kw = q.trim().toLowerCase()
    return libraries
      .filter((l) => !kw || l.name.toLowerCase().includes(kw))
      .map<Cmd>((l) => ({
        kind: 'cmd',
        id: `lib-${l.id}`,
        group: t('palette.group.lib'),
        label: l.name,
        hint: l.category || undefined,
        icon: <GridRegular />,
        run: () => {
          onClose()
          void selectLibrary(l.id)
            .then(() => navigate(`/library/${l.id}`))
            .catch((e) => message.error(t('app.loadLibFailed', { msg: (e as Error).message })))
        },
      }))
  }, [libraries, q, t, onClose, selectLibrary, navigate, message])

  const rows = useMemo<Row[]>(() => [...commands, ...libRows, ...hits], [commands, libRows, hits])
  const clamped = Math.min(active, Math.max(0, rows.length - 1))

  const runRow = useCallback(
    (row: Row | undefined) => {
      if (!row) return
      if (row.kind === 'cmd') {
        row.run()
        return
      }
      onClose()
      void selectLibrary(row.libraryId)
        .then(() => {
          focusItem(row.item.id)
          navigate(`/library/${row.libraryId}`)
        })
        .catch((e) => message.error(t('app.loadLibFailed', { msg: (e as Error).message })))
    },
    [onClose, selectLibrary, focusItem, navigate, message, t],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (rows.length ? (i + 1) % rows.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      runRow(rows[clamped])
    }
  }

  // 选中项滚动进视野
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [clamped])

  const groupOf = (r: Row) => (r.kind === 'cmd' ? r.group : t('palette.group.items'))
  const subtitle = (r: Row) => {
    if (r.kind === 'item') return `${r.libraryName} · ${r.fieldLabel}：${r.matched}`
    return (r as Cmd).hint ?? ''
  }
  const keyOf = (r: Row) => (r.kind === 'cmd' ? r.id : `hit-${r.item.id}`)

  const empty = rows.length === 0 && !loading

  useBackButtonLayer(open, onClose)

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface className="ai-gs-surface">
        <DialogBody>
          <div className="ai-gs">
            <div className="ai-gs-inputrow">
              <Input
                ref={inputRef}
                className="ai-gs-input"
                value={q}
                onChange={(_, data) => {
                  setQ(data.value)
                  setActive(0)
                }}
                onKeyDown={onKeyDown}
                placeholder={t('palette.placeholder')}
                role="combobox"
                aria-expanded
                aria-controls="palette-list"
                aria-activedescendant={rows[clamped] ? `palette-opt-${clamped}` : undefined}
                aria-autocomplete="list"
                contentBefore={<SearchRegular />}
              />
              <kbd className="ai-p-kbd">Esc</kbd>
            </div>

            <div className="ai-gs-list" id="palette-list" role="listbox" ref={listRef}>
              {loading && (
                <div className="ai-gs-hint">
                  <Spinner size="tiny" />
                  <Text size={200}>{t('common.loading')}</Text>
                </div>
              )}
              {empty && (
                <div className="ai-gs-empty">
                  <SearchRegular className="ai-gs-empty-icon" />
                  <Text size={300} weight="semibold">
                    {t('palette.empty')}
                  </Text>
                  <Text size={200} className="ai-gs-empty-desc">
                    {t('palette.placeholder')}
                  </Text>
                </div>
              )}
              {rows.map((r, i) => {
                const prevGroup = i > 0 ? groupOf(rows[i - 1]) : null
                const g = groupOf(r)
                return (
                  <div key={keyOf(r)}>
                    {g !== prevGroup && (
                      <div className="ai-gs-group">
                        <Text size={100} weight="semibold">
                          {g}
                        </Text>
                      </div>
                    )}
                    <div
                      id={`palette-opt-${i}`}
                      role="option"
                      aria-selected={i === clamped}
                      data-active={i === clamped}
                      className={`ai-gs-row${i === clamped ? ' is-active' : ''}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => runRow(r)}
                    >
                      <span className="ai-gs-row-icon" aria-hidden>
                        {r.kind === 'cmd' ? r.icon : <GridRegular />}
                      </span>
                      <span className="ai-gs-row-main">
                        <Text size={300} className="ai-gs-row-label">
                          {r.kind === 'cmd' ? r.label : titleOf(r.item)}
                        </Text>
                        {subtitle(r) && (
                          <Text size={200} className="ai-gs-row-sub">
                            {subtitle(r)}
                          </Text>
                        )}
                      </span>
                      <span className="ai-gs-row-enter" aria-hidden>
                        <kbd className="ai-p-kbd">Enter</kbd>
                      </span>
                    </div>
                  </div>
                )
              })}
              {truncated && (
                <div className="ai-gs-hint">
                  <Text size={200}>{t('palette.more', { n: MAX_ITEM_HITS })}</Text>
                </div>
              )}
            </div>

            <div className="ai-gs-foot">
              <span>
                <kbd className="ai-p-kbd">↑</kbd>
                <kbd className="ai-p-kbd">↓</kbd>
                <Text size={100}>{t('palette.foot.move')}</Text>
              </span>
              <span>
                <kbd className="ai-p-kbd">Enter</kbd>
                <Text size={100}>{t('palette.foot.run')}</Text>
              </span>
              <span>
                <kbd className="ai-p-kbd">Esc</kbd>
                <Text size={100}>{t('palette.foot.close')}</Text>
              </span>
              <span className="ai-gs-foot-brand">
                <Text size={100} font="monospace">
                  Ctrl K
                </Text>
              </span>
            </div>
          </div>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
