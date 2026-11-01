import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Input, App, Empty, Spin } from 'antd'
import type { InputRef } from 'antd'
import {
  SearchOutlined,
  AppstoreOutlined,
  HomeOutlined,
  DeleteOutlined,
  SettingOutlined,
  QuestionCircleOutlined,
  PlusOutlined,
  RobotOutlined,
  MoonOutlined,
  SunOutlined,
  GlobalOutlined,
  CloudSyncOutlined,
  SaveOutlined,
} from '@/components/common/icons'
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
 * 全局命令面板（Ctrl/Cmd + K）。
 *
 * 原来是「只能搜条目的搜索框」。但调研里反复出现的一个结论是：
 * 当功能变多，用户找不到功能时不会去翻菜单，而是猜关键词搜索
 * （NN/g 的可发现性研究）。所以把「所有能做的事」都收进同一个入口：
 * 导航、去任意库、跨库搜条目、以及常用操作。
 *
 * 交互按命令面板的通行约定做全：
 * - ↑↓ 移动选中，Enter 执行，Esc 关闭（antd Modal 负责 Esc）
 * - combobox 语义 + aria-activedescendant，读屏软件能播报当前选中项
 *   （原来的实现没有任何键盘导航，纯鼠标操作）
 * - 结果分组显示，超过上限时明确告知被截断了多少
 *   （原来静默截断到 30 条，用户以为只有这些结果）
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
  const inputRef = useRef<InputRef>(null)
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
      { kind: 'cmd', id: 'go-home', group: t('palette.group.nav'), label: t('app.home'), icon: <HomeOutlined />, run: () => go('/') },
      { kind: 'cmd', id: 'go-trash', group: t('palette.group.nav'), label: t('app.trash'), icon: <DeleteOutlined />, run: () => go('/trash') },
      { kind: 'cmd', id: 'go-settings', group: t('palette.group.nav'), label: t('app.settings'), icon: <SettingOutlined />, run: () => go('/settings') },
      { kind: 'cmd', id: 'go-help', group: t('palette.group.nav'), label: t('app.help'), icon: <QuestionCircleOutlined />, run: () => go('/help') },
      {
        kind: 'cmd',
        id: 'new-lib',
        group: t('palette.group.act'),
        label: t('app.newLibrary'),
        icon: <PlusOutlined />,
        run: () => {
          onClose()
          void createLibrary(t('app.lib.namePlaceholder'), t('app.group.libraries')).catch((e) =>
            message.error(t('app.loadLibsFailed', { msg: (e as Error).message })),
          )
        },
      },
      { kind: 'cmd', id: 'open-ai', group: t('palette.group.act'), label: t('app.aiAssistant'), icon: <RobotOutlined />, run: () => { onClose(); setAiOpen(true) } },
      { kind: 'cmd', id: 'theme', group: t('palette.group.act'), label: isDark ? t('app.theme.light') : t('app.theme.dark'), icon: isDark ? <SunOutlined /> : <MoonOutlined />, run: () => setTheme(isDark ? 'light' : 'dark') },
      {
        kind: 'cmd',
        id: 'lang',
        group: t('palette.group.act'),
        label: `${t('app.language')}：${settings.language === 'zh' ? 'English' : '中文'}`,
        icon: <GlobalOutlined />,
        run: () => setLanguage(settings.language === 'zh' ? 'en' : 'zh'),
      },
      { kind: 'cmd', id: 'backup', group: t('palette.group.act'), label: t('palette.backup'), icon: <SaveOutlined />, run: () => go('/settings') },
      { kind: 'cmd', id: 'sync', group: t('palette.group.act'), label: t('palette.sync'), icon: <CloudSyncOutlined />, run: () => go('/settings') },
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
        icon: <AppstoreOutlined />,
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
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnHidden
      styles={{ body: { padding: 0 } }}
      title={null}
    >
      <div className="palette">
        <div className="palette-input">
          <SearchOutlined style={{ color: 'var(--text-muted)' }} />
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            placeholder={t('palette.placeholder')}
            variant="borderless"
            // combobox 语义：读屏软件能播报输入框角色与当前选中项
            role="combobox"
            aria-expanded
            aria-controls="palette-list"
            aria-activedescendant={rows[clamped] ? `palette-opt-${clamped}` : undefined}
            aria-autocomplete="list"
          />
          <kbd className="palette-kbd">Esc</kbd>
        </div>

        <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {loading && (
            <div className="palette-hint">
              <Spin size="small" /> {t('common.loading')}
            </div>
          )}
          {empty && (
            <div className="palette-hint">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('palette.empty')} />
            </div>
          )}
          {rows.map((r, i) => {
            const prevGroup = i > 0 ? groupOf(rows[i - 1]) : null
            const g = groupOf(r)
            return (
              <div key={keyOf(r)}>
                {g !== prevGroup && <div className="palette-group">{g}</div>}
                <div
                  id={`palette-opt-${i}`}
                  role="option"
                  aria-selected={i === clamped}
                  data-active={i === clamped}
                  className={`palette-row${i === clamped ? ' is-active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => runRow(r)}
                >
                  <span className="palette-icon">{r.kind === 'cmd' ? r.icon : <AppstoreOutlined />}</span>
                  <span className="palette-main">
                    <span className="palette-label">{r.kind === 'cmd' ? r.label : titleOf(r.item)}</span>
                    {subtitle(r) && <span className="palette-sub">{subtitle(r)}</span>}
                  </span>
                </div>
              </div>
            )
          })}
          {truncated && (
            <div className="palette-hint">
              {t('palette.more', { n: MAX_ITEM_HITS })}
            </div>
          )}
        </div>

        <div className="palette-foot">
          <span>↑↓ {t('palette.foot.move')}</span>
          <span>Enter {t('palette.foot.run')}</span>
          <span>Esc {t('palette.foot.close')}</span>
        </div>
      </div>
    </Modal>
  )
}
