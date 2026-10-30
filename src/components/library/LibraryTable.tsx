import { Table, Button, Tooltip, Pagination } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FieldDef, FieldValue, Item } from '@/types'
import FieldRenderer, { renderCellValue } from '@/components/fields/FieldRenderer'
import type { FieldType } from '@/types'
import { useI18n } from '@/i18n'
import SmartValue from '@/components/fields/SmartValue'
import { useLibraryStore } from '@/store/libraryStore'
import dayjs from 'dayjs'

interface Props {
  fields: FieldDef[]
  items: Item[]
  focusItemId: string | null
  onEdit: (item: Item) => void
  onDelete: (item: Item) => void
  onPin: (item: Item, pinned: boolean) => void
  /** 内联编辑：只传变化后的整份 fields（已合并），由父组件落库 */
  onPatch: (item: Item, fields: Item['fields']) => Promise<void> | void
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

/** 账页单元格内边距：横向 12 / 纵向 6，让 13px 文字落在 32px 行高里 */
const CELL_PAD = '6px 12px'

/** 行内操作按钮：18px 高，避免把 32px 的账页行撑高 */
const actionBtnStyle: React.CSSProperties = { height: 18, width: 22, minWidth: 0, padding: 0 }

/** 数字 / 日期列：右对齐 + 等宽 tabular（账本里金额与日期要能上下对齐比较） */
const isNumericField = (type: FieldType): boolean => type === 'number' || type === 'date'

export default function LibraryTable({ fields, items, focusItemId, onEdit, onDelete, onPin, onPatch }: Props) {
  const t = useI18n()
  const tableRef = useRef<HTMLDivElement>(null)
  const focusItem = useLibraryStore((s) => s.focusItem)
  const isMobile = useIsMobile()
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  // row 是**当前页内**的下标（只用于 DOM 定位），id 才是数据身份。
  // 原来只用 row，而 antd 的 render(_, record, index) 传的是分页后的页内下标，
  // beginEdit/commitEdit 却拿它去索引完整的 items —— 于是在第 2 页点任意单元格，
  // 编辑器里显示第 1 条的内容，回车就把改动写进了整个库的第 1 条。
  // 这类静默写错行比报错更难挽回，所以身份一律以 id 为准。
  const [editCell, setEditCell] = useState<{ id: string; row: number; key: string } | null>(null)
  const [draft, setDraft] = useState<FieldValue>(null)
  const [savingCell, setSavingCell] = useState(false)
  const gridRef = useRef<HTMLTableElement | null>(null)
  // 内联编辑失败时在单元格里留一行错误文字（原来只弹 toast，行内没有痕迹）
  const [cellError, setCellError] = useState<string | null>(null)
  // 末列操作「hover 才出现」：用行 hover 状态而不是 CSS（内联样式拿不到 :hover）
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [actionFocusId, setActionFocusId] = useState<string | null>(null)

  // 这几个 Hook 原来写在 `if (isMobile) return ...` 之后：窗口宽度跨过 768px
  // （拖窄窗口、旋转平板）时 Hook 数量会变，React 抛「Rendered fewer hooks」
  // 打到全局 ErrorBoundary —— 一次改窗口大小就能白屏。必须无条件调用。

  // 当前页实际渲染的行数：showSizeChanger 可改每页条数，从 DOM 数最可靠
  const renderedRowCount = (): number => gridRef.current?.querySelectorAll('tbody tr').length ?? items.length

  // items 变少（搜索命中几条、刚删过几条）后 page 可能越界：移动端 slice 出空数组
  // 且分页器只在 items.length > PAGE_SIZE 时渲染 → 列表空白且无处可点回第一页。
  // 用 effect 夹住（不在渲染期 setState）。
  const maxMobilePage = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  useEffect(() => {
    if (page > maxMobilePage) setPage(maxMobilePage)
  }, [page, maxMobilePage])
  const clampedPage = Math.min(page, maxMobilePage)

  const visibleFields = fields.filter((f) => f.visible)

  // 焦点条目滚动定位 + 自动清除高亮
  useEffect(() => {
    if (!focusItemId) return
    const el =
      tableRef.current?.querySelector(`tr[data-row-key="${focusItemId}"]`) ??
      tableRef.current?.querySelector(`[data-item-id="${focusItemId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // 5 秒后自动清除高亮
    const timer = setTimeout(() => focusItem(null), 5000)
    return () => clearTimeout(timer)
  }, [focusItemId, items, focusItem])

  // 卡片/首列的主标识：取第一个有值的字段的「值」本身。
  // 之前拼成「客户名称: 北京华盛科技」，导致字段名在标题和正文里各出现一次，
  // 卡片上白白多占一行，扫读时反而找不到重点。
  const primaryOf = useMemo(
    () => (it: Item) => {
      for (const f of visibleFields) {
        const v = it.fields[f.key]
        if (v != null && String(v).trim() !== '') return renderCellValue(f, v)
      }
      return t('common.emptyValue')
    },
    [visibleFields, t],
  )
  // 卡片正文要跳过主标识字段，否则和标题重复
  const restFields = useMemo(
    () => (it: Item) => {
      const idx = visibleFields.findIndex((f) => {
        const v = it.fields[f.key]
        return v != null && String(v).trim() !== ''
      })
      return idx === -1 ? visibleFields : visibleFields.slice(idx + 1)
    },
    [visibleFields],
  )

  // ———— 移动端：账页卡（0 圆角、上下 hairline、字段名 11px mono） ————
  if (isMobile) {
    // items 变少（搜索命中 3 条、刚删过几条）后，page 可能停在越界的位置上：
    // slice 出来是空数组，而分页器只在 items.length > PAGE_SIZE 时渲染
    // → 列表空白且分页器也没了，命中结果再也回不来。夹一下就好。
    const start = (clampedPage - 1) * PAGE_SIZE
    const paged = items.slice(start, start + PAGE_SIZE)
    return (
      <div ref={tableRef}>
        {/* 手机上一屏能看到的记录数就是效率：字段行压到 ~24px/行。
            这里刻意不用 antd Card：账页卡是 0 圆角 + 上下 1px 线，没有阴影、没有底色。
            单列纵向排列（不用 .lib-grid 的多列网格，否则会出现竖线分隔）。 */}
        <div style={{ borderBottom: '1px solid var(--app-rule)' }}>
          {paged.map((it) => (
            <div
              key={it.id}
              data-item-id={it.id}
              style={{
                borderTop: '1px solid var(--app-rule)',
                padding: '8px 0 6px',
                background: it.id === focusItemId ? 'var(--app-accent-wash)' : 'transparent',
                boxShadow: it.id === focusItemId ? 'inset 2px 0 0 var(--app-accent)' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Tooltip title={it.pinned ? t('common.unpinned') : t('common.pinned')}>
                  <button
                    type="button"
                    aria-label={it.pinned ? t('common.unpinned') : t('common.pinned')}
                    onClick={() => onPin(it, !it.pinned)}
                    className="tap-action"
                    style={{
                      flexShrink: 0,
                      width: 24,
                      height: 24,
                      padding: 0,
                      border: 0,
                      background: 'none',
                      cursor: 'pointer',
                      color: it.pinned ? 'var(--app-accent)' : 'var(--app-ink-faint)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    {it.pinned ? '★' : '☆'}
                  </button>
                </Tooltip>
                <span
                  style={{
                    flex: '1 1 auto',
                    minWidth: 0,
                    fontWeight: 600,
                    fontSize: 'var(--text-base)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {primaryOf(it)}
                </span>
                <Button type="text" size="small" className="tap-action" onClick={() => onEdit(it)}>
                  {t('common.edit')}
                </Button>
                <Button type="text" size="small" danger className="tap-action" onClick={() => onDelete(it)}>
                  {t('common.delete')}
                </Button>
              </div>
              {restFields(it).map((f) => (
                <div key={f.key} className="card-field">
                  {/* 字段名：11px 等宽 + 字距，像账页上的栏名（样式在 .card-field-label） */}
                  <span className="card-field-label" title={f.label}>
                    {f.label}
                  </span>
                  <span className="card-field-value">
                    <SmartValue field={f} value={it.fields[f.key]} />
                  </span>
                </div>
              ))}
              {restFields(it).length === 0 && (
                <div className="faint" style={{ fontSize: 'var(--text-xs)', padding: '3px 0 0 34px' }}>
                  {t('lib.card.onlyTitle')}
                </div>
              )}
            </div>
          ))}
        </div>
        {items.length > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
            <Pagination
              simple
              current={clampedPage}
              pageSize={PAGE_SIZE}
              total={items.length}
              onChange={(p) => {
                setPage(p)
                focusItem(null)
              }}
            />
          </div>
        )}
      </div>
    )
  }

  // ── 单元格内联编辑 ────────────────────────────────────────────
  // 改造前：改一个字段 = 点铅笔 → 弹窗 → 找那个字段 → 改 → 点确定 = 4 次点击 + 一次开合。
  // 键盘约定采用全行业一致的一套（ArcGIS Pro / JMP / GraphPad / Budibase / Esko 相同）：
  //   Enter 或 F2  进入编辑      Enter  保存并下移      Tab  保存并右移
  //   Esc          取消并还原    方向键  在单元格间移动（编辑中不劫持）
  // （editCell/draft/savingCell/gridRef/renderedRowCount 已提到移动端分支之前，
  //   否则窗口宽度跨过 768px 时 Hook 数量会变，React 会抛错白屏。）

  const beginEdit = (record: Item, rowIndex: number, f: FieldDef) => {
    setCellError(null)
    setEditCell({ id: record.id, row: rowIndex, key: f.key })
    setDraft(record.fields[f.key] ?? null)
  }

  const cancelEdit = () => {
    setEditCell(null)
    setDraft(null)
    setCellError(null)
  }

  const commitEdit = async (move: 'down' | 'right' | 'none' = 'none') => {
    if (!editCell) return
    const target = items.find((i) => i.id === editCell.id)
    const f = visibleFields.find((x) => x.key === editCell.key)
    if (!target || !f) return cancelEdit()
    const original = target.fields[f.key] ?? null
    const same = String(original ?? '') === String(draft ?? '')
    if (same) {
      cancelEdit()
      if (move !== 'none') focusNeighbour(move)
      return
    }
    setSavingCell(true)
    try {
      // 只改这一个字段，绝不整体替换 fields —— 否则隐藏字段会被清空
      await onPatch(target, { ...target.fields, [f.key]: draft })
      cancelEdit()
      if (move !== 'none') focusNeighbour(move)
    } catch (e) {
      // 留在编辑态，让用户看到失败并重试，不要静默吞掉改动；
      // 同时把原因留在这一格里（父组件也会 toast，但行内要有痕迹）。
      setCellError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingCell(false)
    }
  }

  /** 提交/取消后把下一个单元格聚焦，进入连续录入 */
  const focusNeighbour = (move: 'down' | 'right') => {
    const lastRow = Math.max(0, renderedRowCount() - 1)
    const next =
      move === 'down'
        ? { row: Math.min((editCell?.row ?? 0) + 1, lastRow), col: editCell ? visibleFields.findIndex((x) => x.key === editCell.key) : 0 }
        : { row: editCell?.row ?? 0, col: Math.min((editCell ? visibleFields.findIndex((x) => x.key === editCell.key) : 0) + 1, visibleFields.length - 1) }
    window.setTimeout(() => {
      const el = gridRef.current?.querySelector<HTMLElement>(
        `[data-cell="${next.row}-${next.col}"]`,
      )
      el?.focus()
    }, 20)
  }

  /** 导航态的方向键移动：不进入编辑，只移动焦点（与 Excel 一致） */
  const onGridKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
    if (editCell) return
    let r = row
    let c = col
    // 边界按当前页渲染行数算，不能拿 items.length（那是全库条数）
    const lastRow = Math.max(0, renderedRowCount() - 1)
    if (e.key === 'ArrowDown') r = Math.min(row + 1, lastRow)
    else if (e.key === 'ArrowUp') r = Math.max(row - 1, 0)
    else if (e.key === 'ArrowRight') c = Math.min(col + 1, visibleFields.length - 1)
    else if (e.key === 'ArrowLeft') c = Math.max(col - 1, 0)
    else return
    e.preventDefault()
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`)
    el?.focus()
  }

  // ———— 桌面端：一张账表 ————
  // 表头 36px（11px mono +0.04em、surface-sunken 底、下边 1px border-strong）；
  // 行高 32px、只有横线、无竖线、无斑马；数字/日期右对齐 + tabular；表头吸顶。
  const headCell = (right = false): React.CSSProperties => ({
    height: 36,
    padding: '0 12px',
    ...(right ? { textAlign: 'right' as const } : null),
  })
  const bodyCell = (f?: FieldDef): React.CSSProperties => ({
    padding: CELL_PAD,
    verticalAlign: 'middle',
    // 行高按 32px 账页反推：13px × 1.3 ≈ 17，加上下 padding 12 与 1px 行线正好 30–32
    lineHeight: 1.3,
    ...(f && isNumericField(f.type)
      ? { textAlign: 'right' as const, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }
      : null),
  })

  const columns: ColumnsType<Item> = [
    {
      title: '',
      dataIndex: 'pinned',
      width: 36,
      onHeaderCell: () => ({ style: { ...headCell(), padding: '0 4px' } }),
      onCell: () => ({ style: { padding: '0 4px', verticalAlign: 'middle' as const, lineHeight: 1 } }),
      render: (_, record) => (
        <Tooltip title={record.pinned ? t('common.unpinned') : t('common.pinned')}>
          {/* 置顶是「★ 朱砂小图标」，不是按钮块：18px 高的行内热区才能让账页行恒为 32px */}
          <span
            role="button"
            tabIndex={0}
            aria-label={record.pinned ? t('common.unpinned') : t('common.pinned')}
            onClick={(e) => {
              e.stopPropagation()
              onPin(record, !record.pinned)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onPin(record, !record.pinned)
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 18,
              lineHeight: 1,
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
              color: record.pinned ? 'var(--app-accent)' : 'var(--app-ink-faint)',
            }}
          >
            {record.pinned ? '★' : '☆'}
          </span>
        </Tooltip>
      ),
    },
    // 第一个可见字段当作「标识列」：给足宽度 + 加粗，让每行第一眼就能认出是哪条。
    // 研究里反复出现的一条：表格的第一职责是可扫读性，标识列必须排在最前并占最大权重。
    ...visibleFields.map((f, i) => ({
      title: <span className="eyebrow">{f.label}</span>,
      dataIndex: ['fields', f.key],
      key: f.key,
      ellipsis: true,
      onHeaderCell: () => ({ style: headCell(isNumericField(f.type)) }),
      // 对齐必须走 onCell 的内联 style：antd 的 align 生成的是运行时 cssinjs 样式，
      // 而 index.css 是构建期打包的，两者同为作者级、后者插入，会被 antd 覆盖。
      // 编辑中的单元格：用 inset 2px 朱砂描边（不改布局），由 td 承担，避免行内元素被裁
      onCell: (record: Item) => {
        const editing = editCell?.id === record.id && editCell.key === f.key
        return {
          style: {
            ...bodyCell(f),
            ...(editing ? { boxShadow: 'inset 0 0 0 2px var(--app-accent)' } : {}),
          },
          className: isNumericField(f.type) ? (f.type === 'date' ? 'align-date' : 'align-num') : undefined,
        }
      },
      className: i === 0 ? 'cell-primary' : undefined,
      width: i === 0 ? 220 : undefined,
      render: (_: unknown, record: Item, rowIndex: number) => {
        const isEditing = editCell?.id === record.id && editCell.key === f.key
        if (isEditing) {
          return (
            <div
              className={`cell-editing${savingCell ? ' is-saving' : ''}`}
              // 编辑器控件 28px 高，用 -5px 上下外边距吃掉差值，账页行高不跳动
              style={{ margin: '-5px 0' }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  cancelEdit()
                } else if (e.key === 'Enter' && !e.shiftKey && f.type !== 'textarea') {
                  e.preventDefault()
                  e.stopPropagation()
                  void commitEdit('down')
                } else if (e.key === 'Tab') {
                  e.preventDefault()
                  void commitEdit('right')
                }
              }}
            >
              <FieldRenderer field={f} value={draft} onChange={setDraft} autoFocus compact />
              {cellError ? (
                <div className="danger-text" style={{ fontSize: 'var(--text-2xs)', marginTop: 2, lineHeight: 1.4 }}>
                  {cellError}
                </div>
              ) : null}
            </div>
          )
        }
        return (
          <div
            tabIndex={0}
            role="button"
            data-cell={`${rowIndex}-${i}`}
            className={`cell-edit${record.pinned && i === 0 ? ' is-pinned' : ''}`}
            aria-label={`${record.fields[visibleFields[0]?.key ?? ''] ?? ''} · ${f.label}`}
            title={t('lib.cell.editHint')}
            onClick={() => beginEdit(record, rowIndex, f)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'F2') {
                e.preventDefault(); beginEdit(record, rowIndex, f)
              } else {
                onGridKeyDown(e, rowIndex, i)
              }
            }}
            style={{
              width: '100%',
              outlineOffset: 0,
              // 抵消 .cell-edit 的 24px min-height/上下 padding：账页行恒为 32px
              minHeight: 17,
              padding: '0 6px',
              lineHeight: 1.3,
            }}
          >
            <SmartValue field={f} value={record.fields[f.key]} />
          </div>
        )
      },
    })) as ColumnsType<Item>,
    {
      title: <span className="eyebrow">{t('lib.col.createdAt')}</span>,
      dataIndex: 'createdAt',
      width: 120,
      onHeaderCell: () => ({ style: headCell(true) }),
      onCell: () => ({ style: bodyCell() }),
      render: (v: number) => (
        <span className="mono num" title={dayjs(v).format('YYYY-MM-DD HH:mm')}>
          {dayjs(v).format('YYYY-MM-DD')}
        </span>
      ),
    },
    {
      title: <span className="eyebrow">{t('lib.col.actions')}</span>,
      key: 'action',
      width: 88,
      onHeaderCell: () => ({ style: headCell(true) }),
      onCell: () => ({ style: { padding: '0 8px', textAlign: 'right' as const, verticalAlign: 'middle' as const, lineHeight: 1 } }),
      render: (_, record) => {
        // 末列操作 hover 才出现；键盘聚焦时也要出现，否则 Tab 到按钮却看不见。
        const shown = hoverId === record.id || actionFocusId === record.id
        return (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0,
              opacity: shown ? 1 : 0,
              transition: 'opacity 120ms cubic-bezier(.2,.7,.2,1)',
            }}
          >
            <Button
              type="text"
              size="small"
              aria-label={t('common.edit')}
              icon={<EditOutlined />}
              onClick={() => onEdit(record)}
              onFocus={() => setActionFocusId(record.id)}
              onBlur={() => setActionFocusId(null)}
              style={actionBtnStyle}
            />
            <Button
              type="text"
              size="small"
              danger
              aria-label={t('common.delete')}
              icon={<DeleteOutlined />}
              onClick={() => onDelete(record)}
              onFocus={() => setActionFocusId(record.id)}
              onBlur={() => setActionFocusId(null)}
              style={actionBtnStyle}
            />
          </div>
        )
      },
    },
  ]

  return (
    <div ref={tableRef}>
      <Table<Item>
        rowKey="id"
        columns={columns}
        dataSource={items}
        size="small"
        // 表头 36 / 行 32：账页的密度就是信息量，不需要「舒适」的 40px 行
        onHeaderRow={() => ({ style: { height: 36 } })}
        onRow={(record) => ({
          style: { height: 32, fontSize: 'var(--text-sm)' },
          onMouseEnter: () => setHoverId(record.id),
          onMouseLeave: () => setHoverId((cur) => (cur === record.id ? null : cur)),
          onClick: () => {
            if (focusItemId) focusItem(null)
          },
        })}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (n) => t('lib.total', { n }),
        }}
        // 超过一屏时表头吸顶，否则滚动几行就不知道在看哪一列
        sticky
        locale={{ emptyText: <div /> }}
        rowClassName={(record) =>
          record.id === focusItemId ? 'focus-row' : record.pinned ? 'pinned-row' : ''
        }
      />
    </div>
  )
}
