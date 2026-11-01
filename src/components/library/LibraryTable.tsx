import { Table, Tooltip, Checkbox, Dropdown } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import {
  StarFilled,
  StarRegular,
  EditRegular,
  DeleteRegular,
  PinRegular,
  PinOffRegular,
  ChevronLeftRegular,
  ChevronRightRegular,
  ChevronDownRegular,
  ArrowSortUpRegular,
  ArrowSortDownRegular,
  CheckmarkRegular,
} from '@fluentui/react-icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FieldDef, FieldValue, Item } from '@/types'
import FieldRenderer, { renderCellValue } from '@/components/fields/FieldRenderer'
import type { FieldType } from '@/types'
import { useI18n } from '@/i18n'
import SmartValue from '@/components/fields/SmartValue'
import { useLibraryStore } from '@/store/libraryStore'
import { useLibText } from './labels'

interface Props {
  fields: FieldDef[]
  items: Item[]
  focusItemId: string | null
  onEdit: (item: Item) => void
  onDelete: (item: Item) => void
  onPin: (item: Item, pinned: boolean) => void
  /** 内联编辑：只传变化后的整份 fields（已合并），由父组件落库 */
  onPatch: (item: Item, fields: Item['fields']) => Promise<void> | void
  /* —— v9 新增（库页内部组件，父组件 LibraryView 同一轮重写）—— */
  /** 当前排序列（空 = 默认顺序：置顶优先 + sortOrder） */
  sortField: string
  sortDesc: boolean
  /** 点击列头切换排序：同一列再次点击翻转方向 */
  onToggleSort: (key: string) => void
  /** 批量删除（内部走父组件的二次确认 + 既有 deleteItem） */
  onBatchDelete: (items: Item[]) => void
  /** 批量置顶 / 取消置顶（既有 pinItem） */
  onBatchPin: (items: Item[], pinned: boolean) => void
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

/** 数字列：右对齐 + tabular（文件资源管理器的日期列保持左对齐） */
const isNumericField = (type: FieldType): boolean => type === 'number'

/**
 * 哪些 select 字段是「状态列」。
 *
 * 城市、单位这类 select 只是普通文本列，不能全都当状态；
 * 只有列名带状态语义（状态/阶段/结果/等级…）时才给语义圆点。
 */
function isStatusField(f: FieldDef): boolean {
  return f.type === 'select' && /状态|阶段|结果|等级|级别|进度|类型/.test(f.label)
}

/**
 * 状态列语义 → 中性标签里那颗小圆点的颜色。
 *
 * 只按文案做视觉归类，不改任何数据：认不出来的值退回中性灰点，
 * 不会误报成成功/失败。
 */
function statusVariant(text: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (/成交|成功|完成|已付|正常|通过|已签|收入|有效/.test(text)) return 'success'
  if (/流失|失败|拒绝|取消|停用|逾期|支出|无效|关闭/.test(text)) return 'danger'
  if (/跟进|待|进行|中|暂停|意向|处理|新/.test(text)) return 'warning'
  return 'neutral'
}

/**
 * 库表（v9 Win11 文件资源管理器 · 详细信息视图）。
 *
 * 桌面 = 原生表格形态（吸附表头 32 / 行 40 / 仅横分割线 / hover 中性提亮 /
 *        选中 accent-soft + 左 3px / 数字 tabular-nums），底部状态栏承载
 *        项数、已选项、每页条数与分页；
 * 移动 = 单列卡片（保留同一套字段渲染与内联编辑入口）。
 *
 * 业务逻辑（内联编辑 / 键盘导航 / 分页边界 / 收藏 / 批量置顶与删除）与旧版一致，
 * 数据身份始终以 item.id 为准（不以页内下标为准）。
 */
export default function LibraryTable({
  fields,
  items,
  focusItemId,
  onEdit,
  onDelete,
  onPin,
  onPatch,
  sortField,
  sortDesc,
  onToggleSort,
  onBatchDelete,
  onBatchPin,
}: Props) {
  const t = useI18n()
  const lt = useLibText()
  const tableRef = useRef<HTMLDivElement>(null)
  const focusItem = useLibraryStore((s) => s.focusItem)
  const isMobile = useIsMobile()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(() => (typeof window !== 'undefined' && window.innerWidth <= 768 ? 10 : 20))

  // row 是**当前页内**的下标（只用于 DOM 定位），id 才是数据身份。
  // 原来只用 row，而 antd 的 render(_, record, index) 传的是分页后的页内下标，
  // beginEdit/commitEdit 却拿它去索引完整的 items —— 于是在第 2 页点任意单元格，
  // 编辑器里显示第 1 条的内容，回车就把改动写进了整个库的第 1 条。
  // 这类静默写错行比报错更难挽回，所以身份一律以 id 为准。
  const [editCell, setEditCell] = useState<{ id: string; row: number; key: string } | null>(null)
  const [draft, setDraft] = useState<FieldValue>(null)
  const [savingCell, setSavingCell] = useState(false)
  // 内联编辑失败时在单元格里留一行错误文字（只弹 toast 的话行内没有痕迹）
  const [cellError, setCellError] = useState<string | null>(null)
  // 多选（Win11 选择模式）：state 只存在表格内部，不改变任何落库逻辑
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // 这几个 Hook 必须无条件调用（窗口宽度跨过 768px 时 Hook 数量不能变）
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const clampedPage = Math.min(page, pageCount)

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  // items 变少后（删除 / 筛选）清掉已经不存在的选中项
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const alive = new Set(items.map((it) => it.id))
      const next = new Set<string>()
      for (const id of prev) if (alive.has(id)) next.add(id)
      return next.size === prev.size ? prev : next
    })
  }, [items])

  const visibleFields = fields.filter((f) => f.visible)

  const paged = useMemo(() => {
    const start = (clampedPage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, clampedPage, pageSize])

  const selectedItems = useMemo(() => items.filter((it) => selectedIds.has(it.id)), [items, selectedIds])

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
  }, [focusItemId, items, focusItem, clampedPage])

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

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const it of items) next.add(it.id)
      return next
    })
  }
  const togglePage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const it of paged) {
        if (checked) next.add(it.id)
        else next.delete(it.id)
      }
      return next
    })
  }
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearSelection = () => setSelectedIds(new Set())

  /** 状态列：中性 Win11 标签 + 语义小圆点（不用彩色大色片） */
  const renderStatusTag = (value: FieldValue) => {
    if (value == null || String(value).trim() === '') return <span className="w-faint">—</span>
    const text = String(value)
    const variant = statusVariant(text)
    return (
      <span className="w-tag lib-tag">
        <span className={`w-dot${variant === 'neutral' ? '' : ` w-dot--${variant}`}`} aria-hidden />
        <span className="lib-tag-text">{text}</span>
      </span>
    )
  }

  /** 收藏（置顶）：星形按钮（线性 / 实心切换，不用彩色底） */
  const starButton = (it: Item) => (
    <Tooltip title={it.pinned ? t('common.unpinned') : t('common.pinned')}>
      <button
        type="button"
        className={`lib-star${it.pinned ? ' is-pinned' : ''}`}
        aria-label={it.pinned ? t('common.unpinned') : t('common.pinned')}
        aria-pressed={it.pinned}
        onClick={(e) => {
          e.stopPropagation()
          onPin(it, !it.pinned)
        }}
      >
        {it.pinned ? <StarFilled /> : <StarRegular />}
      </button>
    </Tooltip>
  )

  const canPrev = clampedPage > 1
  const canNext = clampedPage < pageCount

  const sizeMenu: MenuProps = {
    items: [10, 20, 50, 100].map((n) => ({ key: String(n), label: lt('status.perPage', { n }) })),
    selectable: true,
    selectedKeys: [String(pageSize)],
    onClick: ({ key }) => {
      setPageSize(Number(key))
      setPage(1)
    },
  }

  /** 页码序列（最多 7 个按钮，中间用省略号收拢） */
  const pageItems = useMemo(() => {
    const out: (number | 'gap')[] = []
    if (pageCount <= 7) {
      for (let p = 1; p <= pageCount; p++) out.push(p)
      return out
    }
    out.push(1)
    const start = Math.max(2, clampedPage - 1)
    const end = Math.min(pageCount - 1, clampedPage + 1)
    if (start > 2) out.push('gap')
    for (let p = start; p <= end; p++) out.push(p)
    if (end < pageCount - 1) out.push('gap')
    out.push(pageCount)
    return out
  }, [pageCount, clampedPage])

  const pager = (compact = false) => (
    <div className="lib-pager" role="navigation" aria-label={t('lib.total', { n: String(items.length) })}>
      <button
        type="button"
        className="lib-pager-btn"
        disabled={!canPrev}
        aria-label={lt('pager.prev')}
        onClick={() => setPage((p) => Math.max(1, p - 1))}
      >
        <ChevronLeftRegular />
      </button>
      {compact || pageCount <= 1 ? (
        <span className="lib-pager-num is-active">{lt('status.page', { p: clampedPage, total: pageCount })}</span>
      ) : (
        pageItems.map((p, i) =>
          p === 'gap' ? (
            <span className="lib-pager-gap" key={`gap-${i}`} aria-hidden>
              …
            </span>
          ) : (
            <button
              type="button"
              key={p}
              className={`lib-pager-num${p === clampedPage ? ' is-active' : ''}`}
              aria-current={p === clampedPage ? 'page' : undefined}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ),
        )
      )}
      <button
        type="button"
        className="lib-pager-btn"
        disabled={!canNext}
        aria-label={lt('pager.next')}
        onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
      >
        <ChevronRightRegular />
      </button>
    </div>
  )

  // —— 选择模式动作条：只在有选中项时出现（Win11 选择模式）——
  const selectionBar = selectedItems.length > 0 && (
    <div className="lib-selbar" role="status">
      <CheckmarkRegular style={{ fontSize: 15 }} aria-hidden />
      <span className="lib-selbar-count">{lt('status.selected', { n: selectedItems.length })}</span>
      <button type="button" className="w-btn w-btn--sm w-btn--subtle" onClick={toggleAll}>
        {lt('sel.all')}
      </button>
      <button type="button" className="w-btn w-btn--sm w-btn--subtle" onClick={clearSelection}>
        {lt('sel.clear')}
      </button>
      <span className="lib-selbar-sep" role="presentation" />
      <button type="button" className="w-btn w-btn--sm w-btn--subtle" onClick={() => onBatchPin(selectedItems, true)}>
        <PinRegular />
        {lt('sel.pin')}
      </button>
      <button type="button" className="w-btn w-btn--sm w-btn--subtle" onClick={() => onBatchPin(selectedItems, false)}>
        <PinOffRegular />
        {lt('sel.unpin')}
      </button>
      <span className="lib-selbar-spacer" />
      <button
        type="button"
        className="w-btn w-btn--sm w-btn--danger"
        onClick={() => onBatchDelete(selectedItems)}
      >
        <DeleteRegular />
        {lt('sel.delete')}
      </button>
    </div>
  )

  // ———— 移动端：单列卡片（保留字段渲染逻辑 / 置顶 / 编辑 / 删除 / 多选） ————
  if (isMobile) {
    return (
      <div className="lib-list" ref={tableRef}>
        {selectionBar}
        <div className="lib-cards">
          {paged.map((it) => (
            <div
              key={it.id}
              data-item-id={it.id}
              className={`lib-card${it.id === focusItemId ? ' is-focused' : ''}`}
            >
              <div className="lib-card-head">
                <span className="lib-card-check">
                  <Checkbox
                    checked={selectedIds.has(it.id)}
                    onChange={() => toggleOne(it.id)}
                    aria-label={primaryOf(it)}
                  />
                </span>
                {starButton(it)}
                <button type="button" className="lib-card-name" onClick={() => onEdit(it)} title={primaryOf(it)}>
                  {primaryOf(it)}
                </button>
                <div className="lib-card-actions">
                  <button
                    type="button"
                    className="w-iconbtn w-iconbtn--sm"
                    aria-label={t('common.edit')}
                    onClick={() => onEdit(it)}
                  >
                    <EditRegular />
                  </button>
                  <button
                    type="button"
                    className="w-iconbtn w-iconbtn--sm"
                    aria-label={t('common.delete')}
                    onClick={() => onDelete(it)}
                  >
                    <DeleteRegular />
                  </button>
                </div>
              </div>
              <div className="lib-card-fields">
                {restFields(it).map((f) => (
                  <div key={f.key} className="lib-card-field">
                    <span className="lib-card-label" title={f.label}>
                      {f.label}
                    </span>
                    <span className="lib-card-value">
                      {isStatusField(f) ? renderStatusTag(it.fields[f.key]) : <SmartValue field={f} value={it.fields[f.key]} />}
                    </span>
                  </div>
                ))}
              </div>
              {restFields(it).length === 0 && <div className="lib-card-only">{t('lib.card.onlyTitle')}</div>}
            </div>
          ))}
        </div>
        {pageCount > 1 && <div className="lib-cards-pager">{pager(true)}</div>}
      </div>
    )
  }

  // ── 单元格内联编辑 ────────────────────────────────────────────
  // 键盘约定采用全行业一致的一套（ArcGIS Pro / JMP / GraphPad / Budibase / Esko 相同）：
  //   Enter 或 F2  进入编辑      Enter  保存并下移      Tab  保存并右移
  //   Esc          取消并还原    方向键  在单元格间移动（编辑中不劫持）
  /** 当前页实际渲染的行数（只数带 data-row-key 的数据行，不数 antd 的测量行） */
  const renderedRowCount = (): number =>
    tableRef.current?.querySelectorAll('tbody tr[data-row-key]').length ?? 0

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
      const el = tableRef.current?.querySelector<HTMLElement>(`[data-cell="${next.row}-${next.col}"]`)
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
    const el = tableRef.current?.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`)
    el?.focus()
  }

  // ———— 桌面端：文件资源管理器式表格 ————
  /** 列宽（文件资源管理器：列宽稳定，少列时不把列拉宽成大片空白） */
  const fieldWidth = (f: FieldDef, i: number): number =>
    i === 0
      ? 168
      : f.type === 'textarea'
        ? 220
        : f.type === 'number'
          ? 108
          : f.type === 'date'
            ? 112
            : f.type === 'select'
              ? 120
              : f.type === 'text'
                ? f.key === 'phone'
                  ? 132
                  : 108
                : 100
  /** 38(选择) + 40(置顶) + 各字段 + 76(操作) */
  const tableWidth =
    38 + 40 + 76 + visibleFields.reduce((sum, f, i) => sum + fieldWidth(f, i), 0)

  const columns: ColumnsType<Item> = [
    {
      title: '',
      dataIndex: 'pinned',
      key: '__pin',
      width: 40,
      render: (_, record) => starButton(record),
    },
    // 第一个可见字段当作「标识列」：给足宽度 + 600 字重，让每行第一眼就能认出是哪条。
    ...visibleFields.map((f, i) => ({
      title: (
        <span className={`lib-th-inner${isNumericField(f.type) ? ' is-num' : ''}`}>
          <span className="lib-th-label">{f.label}</span>
          {sortField === f.key ? sortDesc ? <ArrowSortDownRegular /> : <ArrowSortUpRegular /> : null}
        </span>
      ),
      dataIndex: ['fields', f.key],
      key: f.key,
      onHeaderCell: () => ({
        style: { textAlign: isNumericField(f.type) ? 'right' : 'left' },
        className: 'lib-th-sortable',
        role: 'columnheader',
        'aria-sort': sortField === f.key ? (sortDesc ? 'descending' : 'ascending') : 'none',
        title: t('lib.sort'),
        onClick: () => onToggleSort(f.key),
      }),
      onCell: () => ({
        style: { textAlign: isNumericField(f.type) ? 'right' : 'left' },
      }),
      width: fieldWidth(f, i),
      render: (_: unknown, record: Item, rowIndex: number) => {
        const value = record.fields[f.key]
        const isEditing = editCell?.id === record.id && editCell.key === f.key
        if (isEditing) {
          return (
            <div
              className={`lib-cell-editing${savingCell ? ' is-saving' : ''}`}
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
              {cellError ? <div className="lib-cell-error">{cellError}</div> : null}
            </div>
          )
        }
        const title = value == null || value === '' ? undefined : String(value)
        return (
          <div
            tabIndex={0}
            role="button"
            data-cell={`${rowIndex}-${i}`}
            aria-label={`${record.fields[visibleFields[0]?.key ?? ''] ?? ''} · ${f.label} · ${t('lib.cell.editHint')}`}
            title={title}
            className={`lib-cell-btn${isNumericField(f.type) ? ' is-num' : ''}`}
            onClick={() => beginEdit(record, rowIndex, f)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'F2') {
                e.preventDefault()
                beginEdit(record, rowIndex, f)
              } else {
                onGridKeyDown(e, rowIndex, i)
              }
            }}
          >
            <div className={`lib-cell${isNumericField(f.type) ? ' is-num' : ''}`}>
              {isStatusField(f) ? (
                renderStatusTag(value)
              ) : (
                <span className={`lib-cell-text${i === 0 ? ' lib-cell-primary' : ''}`}>
                  <SmartValue field={f} value={value} />
                </span>
              )}
            </div>
          </div>
        )
      },
    })) as ColumnsType<Item>,
    {
      title: '',
      key: '__actions',
      width: 76,
      render: (_, record) => (
        <div className="lib-row-actions">
          <button
            type="button"
            className="w-iconbtn w-iconbtn--sm"
            aria-label={t('common.edit')}
            title={t('common.edit')}
            onClick={(e) => {
              e.stopPropagation()
              onEdit(record)
            }}
          >
            <EditRegular />
          </button>
          <button
            type="button"
            className="w-iconbtn w-iconbtn--sm"
            aria-label={t('common.delete')}
            title={t('common.delete')}
            onClick={(e) => {
              e.stopPropagation()
              onDelete(record)
            }}
          >
            <DeleteRegular />
          </button>
        </div>
      ),
    },
  ]

  const headerCheckbox = (
    <Checkbox
      checked={paged.length > 0 && paged.every((it) => selectedIds.has(it.id))}
      indeterminate={paged.some((it) => selectedIds.has(it.id)) && !paged.every((it) => selectedIds.has(it.id))}
      onChange={(e) => togglePage(e.target.checked)}
      aria-label={lt('sel.all')}
    />
  )

  return (
    <div className="lib-list" ref={tableRef}>
      {selectionBar}
      <div className="lib-table-scroll w-scroll">
        <div className="lib-table">
          <Table<Item>
            tableLayout="fixed"
            rowKey="id"
            columns={columns}
            dataSource={paged}
            scroll={{ x: tableWidth }}
            onRow={() => ({
              style: { height: 40 },
              onClick: () => {
                if (focusItemId) focusItem(null)
              },
            })}
            pagination={false}
            locale={{ emptyText: <div /> }}
            rowClassName={(record) => (record.id === focusItemId ? 'lib-row-focus' : '')}
            rowSelection={{
              selectedRowKeys: [...selectedIds],
              onChange: (keys) => setSelectedIds(new Set(keys.map(String))),
              columnWidth: 38,
              columnTitle: headerCheckbox,
            }}
          />
        </div>
      </div>
      <div className="lib-statusbar">
        <div className="lib-status-group">
          <span className="lib-status-strong">{lt('status.total', { n: items.length })}</span>
          {selectedItems.length > 0 && (
            <>
              <span className="lib-status-sep" role="presentation" />
              <span>{lt('status.selected', { n: selectedItems.length })}</span>
            </>
          )}
        </div>
        <span className="lib-status-spacer" />
        <div className="lib-pager-size">
          <Dropdown menu={sizeMenu} trigger={['click']} placement="topRight">
            <button type="button" className="w-chip">
              {lt('status.perPage', { n: pageSize })}
              <ChevronDownRegular style={{ fontSize: 12 }} />
            </button>
          </Dropdown>
        </div>
        {items.length === 0 ? null : pager()}
      </div>
    </div>
  )
}
