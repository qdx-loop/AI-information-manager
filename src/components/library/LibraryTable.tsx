import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Option,
  Text,
  Tooltip,
} from '@fluentui/react-components'
import {
  ArrowSortDownRegular,
  ArrowSortUpRegular,
  DeleteRegular,
  EditRegular,
  PinOffRegular,
  PinRegular,
  StarFilled,
  StarRegular,
} from '@fluentui/react-icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FieldDef, FieldValue, Item } from '@/types'
import type { FieldType } from '@/types'
import FieldRenderer, { renderCellValue } from '@/components/fields/FieldRenderer'
import SmartValue from '@/components/fields/SmartValue'
import { useI18n } from '@/i18n'
import { useLibraryStore } from '@/store/libraryStore'
import { LibPager, useLibText } from './labels'

interface Props {
  fields: FieldDef[]
  items: Item[]
  focusItemId: string | null
  onEdit: (item: Item) => void
  onDelete: (item: Item) => void
  onPin: (item: Item, pinned: boolean) => void
  /** 内联编辑：只传变化后的整份 fields（已合并），由父组件落库 */
  onPatch: (item: Item, fields: Item['fields']) => Promise<void> | void
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

/** 数字列：右对齐 + tabular（日期列在资源管理器里保持左对齐） */
const isNumericField = (type: FieldType): boolean => type === 'number'

/**
 * 哪些 select 字段是「状态列」。
 *
 * 城市、单位这类 select 只是普通文本列，不能全都当状态；
 * 只有列名带状态语义（状态/阶段/结果/等级…）时才给语义色。
 */
function isStatusField(f: FieldDef): boolean {
  return f.type === 'select' && /状态|阶段|结果|等级|级别|进度|类型/.test(f.label)
}

/** 状态文案 → Fluent Badge 语义色（只做视觉归类，不改数据） */
function statusColor(text: string): 'success' | 'warning' | 'danger' | 'subtle' {
  if (/成交|成功|完成|已付|正常|通过|已签|收入|有效/.test(text)) return 'success'
  if (/流失|失败|拒绝|取消|停用|逾期|支出|无效|关闭/.test(text)) return 'danger'
  if (/跟进|待|进行|中|暂停|意向|处理|新/.test(text)) return 'warning'
  return 'subtle'
}

const PAGE_SIZES = [10, 20, 50, 100]

/**
 * 库表（v10 Fluent UI · 资源管理器式详细信息视图）。
 *
 * 桌面 = 原生 <table> + Fluent token 渲染（吸附表头 34 / 行 40 / 仅横分割线 /
 *        hover 用 colorSubtleBackgroundHover / 选中用 colorSubtleBackgroundSelected +
 *        3px 品牌色指示条），单元格内的复选框、置顶按钮、状态 Badge、行内操作按钮
 *        全部是 Fluent 组件；
 * 移动 = Fluent Card 单列卡片（同一套字段渲染与操作）。
 *
 * 业务逻辑（内联编辑 / 键盘导航 / 分页边界 / 收藏 / 多选批量操作）与旧版一致，
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

  // 身份一律以 id 为准：page 只用于切片，row 只用于 DOM 定位
  const [editCell, setEditCell] = useState<{ id: string; row: number; key: string } | null>(null)
  const [draft, setDraft] = useState<FieldValue>(null)
  const [savingCell, setSavingCell] = useState(false)
  const [cellError, setCellError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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

  /** select 字段 / 状态列：Fluent Badge（中性 outline / 语义 tint） */
  const renderChip = (f: FieldDef, value: FieldValue) => {
    if (value == null || String(value).trim() === '') {
      return <span style={{ color: 'var(--w-text-3)' }}>—</span>
    }
    const text = String(value)
    const status = isStatusField(f)
    return (
      <Badge
        appearance={status ? 'tint' : 'outline'}
        color={status ? statusColor(text) : 'subtle'}
        size="small"
        className="lib-select-tag"
      >
        <span className="lib-select-tag--value">{text}</span>
      </Badge>
    )
  }

  /** 收藏（置顶）：Fluent 图标按钮（星形线性 / 实心切换） */
  const starButton = (it: Item) => (
    <Tooltip content={it.pinned ? t('common.unpinned') : t('common.pinned')} relationship="label">
      <Button
        appearance="transparent"
        size="small"
        aria-label={it.pinned ? t('common.unpinned') : t('common.pinned')}
        aria-pressed={it.pinned}
        icon={
          it.pinned ? (
            <StarFilled style={{ color: 'var(--w-brand-fg)' }} />
          ) : (
            <StarRegular style={{ color: 'var(--w-text-3)' }} />
          )
        }
        onClick={(e) => {
          e.stopPropagation()
          onPin(it, !it.pinned)
        }}
      />
    </Tooltip>
  )

  /** 选择模式动作条（只在有选中项时出现） */
  const selectionBar = selectedItems.length > 0 && (
    <div className="lib-selbar" role="status">
      <Text size={200} weight="semibold" className="lib-selbar-text">
        {lt('status.selected', { n: selectedItems.length })}
      </Text>
      <Button appearance="subtle" size="small" onClick={toggleAll}>
        {lt('sel.all')}
      </Button>
      <Button appearance="subtle" size="small" onClick={clearSelection}>
        {lt('sel.clear')}
      </Button>
      <Button
        appearance="subtle"
        size="small"
        icon={<PinRegular />}
        onClick={() => onBatchPin(selectedItems, true)}
      >
        {lt('sel.pin')}
      </Button>
      <Button
        appearance="subtle"
        size="small"
        icon={<PinOffRegular />}
        onClick={() => onBatchPin(selectedItems, false)}
      >
        {lt('sel.unpin')}
      </Button>
      <span className="lib-selbar-spacer" />
      <Button
        appearance="subtle"
        size="small"
        icon={<DeleteRegular />}
        style={{ color: 'var(--w-danger)' }}
        onClick={() => onBatchDelete(selectedItems)}
      >
        {lt('sel.delete')}
      </Button>
    </div>
  )

  const pager = (compact = false) => (
    <LibPager page={clampedPage} pageCount={pageCount} onChange={setPage} compact={compact} />
  )

  // ———— 移动端：Fluent Card 单列卡片 ————
  if (isMobile) {
    return (
      <div className="lib-list" ref={tableRef}>
        {selectionBar}
        <div className="lib-cards">
          {paged.map((it) => (
            <Card
              key={it.id}
              data-item-id={it.id}
              appearance="filled"
              size="small"
              className={`lib-item-card${it.id === focusItemId ? ' is-focused' : ''}`}
            >
              <div className="lib-item-head">
                <Checkbox
                  checked={selectedIds.has(it.id)}
                  onChange={() => toggleOne(it.id)}
                  aria-label={primaryOf(it)}
                />
                {starButton(it)}
                <button type="button" className="lib-item-name" onClick={() => onEdit(it)} title={primaryOf(it)}>
                  {primaryOf(it)}
                </button>
                <div className="lib-item-actions">
                  <Tooltip content={t('common.edit')} relationship="label">
                    <Button
                      appearance="transparent"
                      size="small"
                      icon={<EditRegular />}
                      aria-label={t('common.edit')}
                      onClick={() => onEdit(it)}
                    />
                  </Tooltip>
                  <Tooltip content={t('common.delete')} relationship="label">
                    <Button
                      appearance="transparent"
                      size="small"
                      icon={<DeleteRegular />}
                      aria-label={t('common.delete')}
                      onClick={() => onDelete(it)}
                    />
                  </Tooltip>
                </div>
              </div>
              <div className="lib-item-fields">
                {restFields(it).map((f) => (
                  <div key={f.key} className="lib-item-field">
                    <span className="lib-item-field-label" title={f.label}>
                      {f.label}
                    </span>
                    <span className="lib-item-field-value">
                      {isStatusField(f) ? renderChip(f, it.fields[f.key]) : <SmartValue field={f} value={it.fields[f.key]} />}
                    </span>
                  </div>
                ))}
              </div>
              {restFields(it).length === 0 && <span className="lib-item-empty-hint">{t('lib.card.onlyTitle')}</span>}
            </Card>
          ))}
        </div>
        {pageCount > 1 && <div className="lib-cards-pager">{pager(true)}</div>}
      </div>
    )
  }

  // ── 单元格内联编辑 ────────────────────────────────────────────
  //   Enter / F2 进入编辑   Enter 保存并下移   Tab 保存并右移   Esc 取消
  /** 当前页实际渲染的行数（只数带 data-row-key 的数据行） */
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
      // 留在编辑态，让用户看到失败并重试，不要静默吞掉改动
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

  // ———— 桌面端：资源管理器式表格 ————
  /** 列宽：列宽稳定，少列时由末尾填充列吸收剩余宽度（不把数据列拉得过大） */
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

  const allPageSelected = paged.length > 0 && paged.every((it) => selectedIds.has(it.id))
  const somePageSelected = paged.some((it) => selectedIds.has(it.id))
  const headerChecked: boolean | 'mixed' = allPageSelected ? true : somePageSelected ? 'mixed' : false

  return (
    <div className="lib-list" ref={tableRef}>
      {selectionBar}
      <div className="lib-table-scroll">
        <table className="lib-table" role="grid" aria-label={t('lib.items')}>
          <colgroup>
            <col style={{ width: 38 }} />
            <col style={{ width: 40 }} />
            {visibleFields.map((f, i) => (
              <col key={f.key} style={{ width: fieldWidth(f, i) }} />
            ))}
            <col style={{ width: 'auto' }} />
            <col style={{ width: 76 }} />
          </colgroup>
          <thead>
            <tr>
              <th className="lib-th-check" scope="col">
                <Checkbox
                  checked={headerChecked}
                  onChange={(_, data) => togglePage(data.checked === true || data.checked === 'mixed')}
                  aria-label={lt('sel.all')}
                />
              </th>
              <th className="lib-th-pin" scope="col">
                <span className="lib-sr-only">{lt('table.col.pin')}</span>
              </th>
              {visibleFields.map((f) => (
                <th
                  key={f.key}
                  scope="col"
                  className={`lib-th${isNumericField(f.type) ? ' is-num' : ''}`}
                  aria-sort={sortField === f.key ? (sortDesc ? 'descending' : 'ascending') : 'none'}
                >
                  <button
                    type="button"
                    className={`lib-th-sort${isNumericField(f.type) ? ' is-num' : ''}`}
                    title={t('lib.sort')}
                    onClick={() => onToggleSort(f.key)}
                  >
                    <span className="lib-th-label">{f.label}</span>
                    {sortField === f.key ? sortDesc ? <ArrowSortDownRegular /> : <ArrowSortUpRegular /> : null}
                  </button>
                </th>
              ))}
              <th className="lib-th-fill" scope="col" aria-hidden />
              <th className="lib-th-actions" scope="col">
                <span className="lib-sr-only">{lt('table.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.map((record, rowIndex) => {
              const selected = selectedIds.has(record.id)
              const rowClass = [
                'lib-row',
                selected ? 'is-selected' : '',
                record.id === focusItemId ? 'is-focused' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <tr
                  key={record.id}
                  data-row-key={record.id}
                  className={rowClass}
                  aria-selected={selected}
                  onClick={() => {
                    if (focusItemId) focusItem(null)
                  }}
                >
                  <td className="lib-td-check">
                    <Checkbox
                      checked={selected}
                      onChange={() => toggleOne(record.id)}
                      aria-label={primaryOf(record)}
                    />
                  </td>
                  <td className="lib-td-pin">{starButton(record)}</td>
                  {visibleFields.map((f, i) => {
                    const value = record.fields[f.key]
                    const isEditing = editCell?.id === record.id && editCell.key === f.key
                    const isNum = isNumericField(f.type)
                    return (
                      <td key={f.key} className={`lib-td${isNum ? ' is-num' : ''}`}>
                        {isEditing ? (
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
                        ) : (
                          <div
                            tabIndex={0}
                            role="button"
                            data-cell={`${rowIndex}-${i}`}
                            aria-label={`${record.fields[visibleFields[0]?.key ?? ''] ?? ''} · ${f.label} · ${t('lib.cell.editHint')}`}
                            title={value == null || value === '' ? undefined : String(value)}
                            className={`lib-cell-btn${isNum ? ' is-num' : ''}`}
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
                            <div className={`lib-cell-inner${isNum ? ' is-num' : ''}`}>
                              {isStatusField(f) ? (
                                renderChip(f, value)
                              ) : (
                                <span className={`lib-cell-text${i === 0 ? ' lib-cell-primary' : ''}`}>
                                  <SmartValue field={f} value={value} />
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    )
                  })}
                  <td className="lib-td-fill" aria-hidden />
                  <td className="lib-td-actions">
                    <div className="lib-row-actions">
                      <Tooltip content={t('common.edit')} relationship="label">
                        <Button
                          appearance="transparent"
                          size="small"
                          icon={<EditRegular />}
                          aria-label={t('common.edit')}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEdit(record)
                          }}
                        />
                      </Tooltip>
                      <Tooltip content={t('common.delete')} relationship="label">
                        <Button
                          appearance="transparent"
                          size="small"
                          icon={<DeleteRegular />}
                          aria-label={t('common.delete')}
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(record)
                          }}
                        />
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="lib-statusbar">
        <div className="lib-status-group">
          <span className="lib-status-strong">{lt('status.total', { n: items.length })}</span>
          {selectedItems.length > 0 && (
            <span className="lib-status-group">{lt('status.selected', { n: selectedItems.length })}</span>
          )}
        </div>
        <span className="lib-status-spacer" />
        <Dropdown
          size="small"
          value={lt('status.perPage', { n: pageSize })}
          selectedOptions={[String(pageSize)]}
          onOptionSelect={(_, data) => {
            if (!data.optionValue) return
            setPageSize(Number(data.optionValue))
            setPage(1)
          }}
          aria-label={lt('status.perPage', { n: pageSize })}
        >
          {PAGE_SIZES.map((n) => (
            <Option key={n} value={String(n)} text={lt('status.perPage', { n })}>
              {lt('status.perPage', { n })}
            </Option>
          ))}
        </Dropdown>
        {pager()}
      </div>
    </div>
  )
}
