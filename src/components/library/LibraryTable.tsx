import { Table, Button, Tooltip, Pagination } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, DeleteOutlined, StarOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FieldDef, FieldValue, Item } from '@/types'
import FieldRenderer, { renderCellValue } from '@/components/fields/FieldRenderer'
import type { FieldType } from '@/types'
import { useI18n } from '@/i18n'
import SmartValue from '@/components/fields/SmartValue'
import { useLibraryStore } from '@/store/libraryStore'

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

/** 数字 / 日期列：右对齐 + tabular（表格数字列必须右对齐） */
const isNumericField = (type: FieldType): boolean => type === 'number' || type === 'date'

/**
 * 哪些 select 字段是「状态列」。
 *
 * 城市、单位这类 select 只是普通文本列，不能全都渲染成色片；
 * 只有列名带状态语义（状态/阶段/结果/等级…）时才用 `.status-pill`。
 */
function isStatusField(f: FieldDef): boolean {
  return f.type === 'select' && /状态|阶段|结果|等级|级别|进度|类型/.test(f.label)
}

/**
 * 状态列语义 → `.status-pill` 变体。
 *
 * 只按文案做视觉归类，不改任何数据：认不出来的值退回 neutral，
 * 不会误报成成功/失败。
 */
function statusVariant(text: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (/成交|成功|完成|已付|正常|通过|已签|收入|有效/.test(text)) return 'success'
  if (/流失|失败|拒绝|取消|停用|逾期|支出|无效|关闭/.test(text)) return 'danger'
  if (/跟进|待|进行|中|暂停|意向|处理|新/.test(text)) return 'warning'
  return 'neutral'
}

/**
 * 库表（v4 SIGNAL PRESS）：
 * 桌面 = `.data-table` 硬边表格（表头 ink 由全局 CSS 负责、行 40、行线 1px line-soft）；
 * 移动 = `.sheet` 白面卡片（2px ink 边 + 硬投影），字段两列网格。
 * 内联编辑 / 键盘导航 / 分页边界 / 收藏 / 操作列 hover 逻辑与之前完全一致。
 */
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
  // 内联编辑失败时在单元格里留一行错误文字（只弹 toast 的话行内没有痕迹）
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

  /** 收藏（置顶）：StarOutlined；active = ink 图标 + lime 底（只用线性图标，不用实心星字符） */
  const starButton = (it: Item) => (
    <Tooltip title={it.pinned ? t('common.unpinned') : t('common.pinned')}>
      <Button
        type="text"
        className="icon-btn is-sm"
        aria-label={it.pinned ? t('common.unpinned') : t('common.pinned')}
        onClick={(e) => {
          e.stopPropagation()
          onPin(it, !it.pinned)
        }}
        icon={<StarOutlined style={{ fontSize: 16, color: it.pinned ? 'var(--ink)' : 'var(--ink-faint)' }} />}
        style={it.pinned ? { background: 'var(--lime)', borderColor: 'var(--line)' } : undefined}
      />
    </Tooltip>
  )

  // ———— 移动端：sheet 卡片（2px 边 + 硬投影 + 字段两列网格） ————
  if (isMobile) {
    const start = (clampedPage - 1) * PAGE_SIZE
    const paged = items.slice(start, start + PAGE_SIZE)
    return (
      <div ref={tableRef} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>
        {paged.map((it) => (
          <div
            key={it.id}
            data-item-id={it.id}
            className="sheet"
            style={{
              padding: 'var(--s4)',
              borderColor: it.id === focusItemId ? 'var(--ink)' : 'var(--line)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {starButton(it)}
              <span
                style={{
                  flex: '1 1 auto',
                  minWidth: 0,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 'var(--t-md)',
                  letterSpacing: '-0.01em',
                  color: 'var(--ink)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {primaryOf(it)}
              </span>
              <Button
                type="text"
                className="icon-btn is-sm"
                aria-label={t('common.edit')}
                icon={<EditOutlined />}
                onClick={() => onEdit(it)}
              />
              <Button
                type="text"
                className="icon-btn is-sm is-danger"
                aria-label={t('common.delete')}
                icon={<DeleteOutlined />}
                onClick={() => onDelete(it)}
              />
            </div>

            {/* 字段两列网格：标签 mono 10 / 值 15 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginTop: 12 }}>
              {restFields(it).map((f) => (
                <div
                  key={f.key}
                  className="card-field"
                  style={{ minWidth: 0, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
                >
                  <span className="card-field-label" title={f.label} style={{ width: 'auto' }}>{f.label}</span>
                  <span className="card-field-value" style={{ width: '100%' }}>
                    {isStatusField(f) && it.fields[f.key] != null && String(it.fields[f.key]).trim() !== '' ? (
                      <span className={`status-pill is-${statusVariant(String(it.fields[f.key]))}`}>
                        {String(it.fields[f.key])}
                      </span>
                    ) : (
                      <SmartValue field={f} value={it.fields[f.key]} />
                    )}
                  </span>
                </div>
              ))}
            </div>
            {restFields(it).length === 0 && (
              <div className="field-hint" style={{ marginTop: 10 }}>{t('lib.card.onlyTitle')}</div>
            )}
          </div>
        ))}
        {items.length > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
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
  // 键盘约定采用全行业一致的一套（ArcGIS Pro / JMP / GraphPad / Budibase / Esko 相同）：
  //   Enter 或 F2  进入编辑      Enter  保存并下移      Tab  保存并右移
  //   Esc          取消并还原    方向键  在单元格间移动（编辑中不劫持）

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

  // ———— 桌面端：硬边表格（领标 ink 表头由全局 CSS 负责；行 40） ————
  const cellStyle = (f: FieldDef): React.CSSProperties =>
    isNumericField(f.type) ? { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } : {}

  const columns: ColumnsType<Item> = [
    {
      title: '',
      dataIndex: 'pinned',
      width: 56,
      // 32px 图标按钮用负 margin 压进 40px 行高
      render: (_, record) => (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '-7px 0' }}>{starButton(record)}</div>
      ),
    },
    // 第一个可见字段当作「标识列」：给足宽度 + 700 字重，让每行第一眼就能认出是哪条。
    ...visibleFields.map((f, i) => ({
      title: f.label,
      dataIndex: ['fields', f.key],
      key: f.key,
      onHeaderCell: () => ({ style: { textAlign: isNumericField(f.type) ? 'right' : 'left' } }),
      // 对齐必须走 onCell 的内联 style：antd 的 align 生成的是运行时 cssinjs 样式，
      // 而 index.css 是构建期打包的，两者同为作者级、后者插入，会被 antd 覆盖。
      onCell: (record: Item) => {
        const editing = editCell?.id === record.id && editCell.key === f.key
        return {
          style: {
            ...cellStyle(f),
            ...(i === 0 ? { fontWeight: 700 } : {}),
            ...(editing ? { boxShadow: 'inset 0 0 0 2px var(--ink)' } : {}),
          },
        }
      },
      width: i === 0 ? 200 : undefined,
      render: (_: unknown, record: Item, rowIndex: number) => {
        const value = record.fields[f.key]
        const isEditing = editCell?.id === record.id && editCell.key === f.key
        if (isEditing) {
          return (
            <div
              // 32px 编辑器用负 margin 吃掉差值，行高保持 40；保存中整格降透明
              style={{
                margin: '-6px 0',
                position: 'relative',
                opacity: savingCell ? 0.55 : 1,
                pointerEvents: savingCell ? 'none' : undefined,
              }}
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
                <div className="danger-text" style={{ fontSize: 'var(--t-2xs)', marginTop: 2, lineHeight: 1.3 }}>
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
            aria-label={`${record.fields[visibleFields[0]?.key ?? ''] ?? ''} · ${f.label} · ${t('lib.cell.editHint')}`}
            title={value == null || value === '' ? undefined : String(value)}
            onClick={() => beginEdit(record, rowIndex, f)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'F2') {
                e.preventDefault(); beginEdit(record, rowIndex, f)
              } else {
                onGridKeyDown(e, rowIndex, i)
              }
            }}
            style={{ cursor: 'text' }}
          >
            {/* 状态列用 .status-pill；其余走字段渲染器 */}
            {isStatusField(f) && value != null && String(value).trim() !== '' ? (
              <span className={`status-pill is-${statusVariant(String(value))}`} style={{ margin: '-1px 0' }}>{String(value)}</span>
            ) : (
              <SmartValue field={f} value={value} />
            )}
          </div>
        )
      },
    })) as ColumnsType<Item>,
    {
      title: '',
      key: 'action',
      width: 96,
      fixed: 'right',
      render: (_, record) => {
        // 末列操作 hover 才出现；键盘聚焦时也要出现，否则 Tab 到按钮却看不见。
        const shown = hoverId === record.id || actionFocusId === record.id
        return (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              margin: '-7px 0',
              opacity: shown ? 1 : 0,
              transition: 'opacity 140ms cubic-bezier(0.2, 0.9, 0.25, 1.2)',
            }}
          >
            <Button
              type="text"
              className="icon-btn is-sm"
              aria-label={t('common.edit')}
              icon={<EditOutlined />}
              onClick={() => onEdit(record)}
              onFocus={() => setActionFocusId(record.id)}
              onBlur={() => setActionFocusId(null)}
            />
            <Button
              type="text"
              className="icon-btn is-sm is-danger"
              aria-label={t('common.delete')}
              icon={<DeleteOutlined />}
              onClick={() => onDelete(record)}
              onFocus={() => setActionFocusId(record.id)}
              onBlur={() => setActionFocusId(null)}
            />
          </div>
        )
      },
    },
  ]

  return (
    <div ref={tableRef} className="data-table">
      <Table<Item>
        rowKey="id"
        columns={columns}
        dataSource={items}
        // 长值横向滚动（.data-table .ant-table-content overflow-x:auto），短值不截断
        scroll={{ x: 'max-content' }}
        onRow={(record) => ({
          style: { height: 40 },
          onMouseEnter: () => setHoverId(record.id),
          onMouseLeave: () => setHoverId((cur) => (cur === record.id ? null : cur)),
          onClick: () => {
            if (focusItemId) focusItem(null)
          },
        })}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (n) => <span className="table-count">{t('lib.total', { n })}</span>,
        }}
        locale={{ emptyText: <div /> }}
        rowClassName={(record) => (record.id === focusItemId ? 'row-selected' : '')}
      />
    </div>
  )
}
