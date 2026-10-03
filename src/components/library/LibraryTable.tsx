import { Table, Button, Space, Tooltip, Card, Pagination } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, DeleteOutlined, PushpinOutlined, PushpinFilled } from '@ant-design/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FieldDef, FieldValue, Item } from '@/types'
import FieldRenderer, { renderCellValue } from '@/components/fields/FieldRenderer'
import type { FieldType } from '@/types'
import { useI18n } from '@/i18n'
import SmartValue from '@/components/fields/SmartValue'
import { useLibraryStore } from '@/store/libraryStore'
import dayjs from 'dayjs'

import { getFreeText } from '@/utils/freeText'
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

export default function LibraryTable({ fields, items, focusItemId, onEdit, onDelete, onPin, onPatch }: Props) {
  const t = useI18n()
  const tableRef = useRef<HTMLDivElement>(null)
  const focusItem = useLibraryStore((s) => s.focusItem)
  const isMobile = useIsMobile()
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

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
      // 一个字段都没有的库（用户还没配模板就记了东西），标题退回速记正文。
      // 不兜底的话这里永远返回「（无内容）」，用户会以为东西没存上。
      const free = getFreeText(it)
      if (free) return free.length > 60 ? `${free.slice(0, 60)}…` : free
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
  // 首列（标识列）：字段类型决定对齐方式，数字与日期右对齐便于纵向比较
  const alignOf = (t: FieldType): 'left' | 'right' =>
    t === 'number' || t === 'date' ? 'right' : 'left'

  // ———— 移动端：卡片列表（横向滚动太远才能摸到操作列，改为纵向卡片） ————
  if (isMobile) {
    const start = (page - 1) * PAGE_SIZE
    const paged = items.slice(start, start + PAGE_SIZE)
    return (
      <div ref={tableRef} className="lib-grid">
        {/* 手机上一屏能看到的记录数就是效率：卡片内字段行压到 ~26px/行，
            4 个字段的卡片从 ~200px 降到 ~165px，且仍留 24px 以上的可点区域。 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {paged.map((it) => (
            <Card
              key={it.id}
              size="small"
              data-item-id={it.id}
              className={it.id === focusItemId ? 'focus-card' : it.pinned ? 'pinned-card' : ''}
              title={
                // Tooltip 只包住「置顶」这一个按钮。原来它连标题文字一起包住，
                // 读屏会把这张卡片的标题念成「取消置顶」；长标题也不会被 Tooltip 处理。
                <span style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0 }}>
                  <Tooltip title={it.pinned ? t('common.unpinned') : t('common.pinned')}>
                    <Button
                      type="text"
                      size="small"
                      aria-label={it.pinned ? t('common.unpinned') : t('common.pinned')}
                      icon={
                        it.pinned ? (
                          <PushpinFilled style={{ color: 'var(--app-kiln)' }} />
                        ) : (
                          <PushpinOutlined />
                        )
                      }
                      onClick={() => onPin(it, !it.pinned)}
                      className="tap-action"
                      style={{ marginInlineEnd: 4 }}
                    />
                  </Tooltip>
                  <span
                    style={
                      visibleFields.length === 0
                        ? // 零字段时整段就是速记内容，截断会把记的东西藏起来
                          { fontWeight: 600, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
                        : { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                    }
                  >
                    {primaryOf(it)}
                  </span>
                </span>
              }
              extra={
                <Space size={0}>
                  <Button
                    type="link"
                    size="small"
                    className="tap-action"
                    aria-label={t('common.edit')}
                    icon={<EditOutlined />}
                    onClick={() => onEdit(it)}
                  />
                  <Button
                    type="link"
                    size="small"
                    className="tap-action"
                    danger
                    aria-label={t('common.delete')}
                    icon={<DeleteOutlined />}
                    onClick={() => onDelete(it)}
                  />
                </Space>
              }
            >
              {restFields(it).map((f) => (
                <div key={f.key} className="card-field">
                  <span className="card-field-label" title={f.label}>
                    {f.label}
                  </span>
                  <span className="card-field-value">
                    <SmartValue field={f} value={it.fields[f.key]} />
                  </span>
                </div>
              ))}
              {/* 零字段时不要再渲染一遍正文：卡片标题（primaryOf）已经是速记内容了，
                  两处都显示会出现同一句话重复两遍。 */}
              {restFields(it).length === 0 && visibleFields.length > 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--app-ink-faint)', padding: '6px 0' }}>
                  {t('lib.card.onlyTitle')}
                </div>
              )}
            </Card>
          ))}
        </div>
        {items.length > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
            <Pagination
              simple
              current={page}
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
  const [editCell, setEditCell] = useState<{ row: number; key: string } | null>(null)
  const [draft, setDraft] = useState<FieldValue>(null)
  const [savingCell, setSavingCell] = useState(false)
  const gridRef = useRef<HTMLTableElement | null>(null)

  const beginEdit = (rowIndex: number, f: FieldDef) => {
    setEditCell({ row: rowIndex, key: f.key })
    setDraft(items[rowIndex]?.fields[f.key] ?? null)
  }

  const cancelEdit = () => {
    setEditCell(null)
    setDraft(null)
  }

  const commitEdit = async (move: 'down' | 'right' | 'none' = 'none') => {
    if (!editCell) return
    const target = items[editCell.row]
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
    } catch {
      // 留在编辑态，让用户看到失败并重试，不要静默吞掉改动
    } finally {
      setSavingCell(false)
    }
  }

  /** 提交/取消后把下一个单元格聚焦，进入连续录入 */
  const focusNeighbour = (move: 'down' | 'right') => {
    const next =
      move === 'down'
        ? { row: Math.min((editCell?.row ?? 0) + 1, items.length - 1), col: editCell ? visibleFields.findIndex((x) => x.key === editCell.key) : 0 }
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
    if (e.key === 'ArrowDown') r = Math.min(row + 1, items.length - 1)
    else if (e.key === 'ArrowUp') r = Math.max(row - 1, 0)
    else if (e.key === 'ArrowRight') c = Math.min(col + 1, visibleFields.length - 1)
    else if (e.key === 'ArrowLeft') c = Math.max(col - 1, 0)
    else return
    e.preventDefault()
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`)
    el?.focus()
  }

  // ———— 桌面端：表格 ————
  const columns: ColumnsType<Item> = [
    {
      title: '',
      dataIndex: 'pinned',
      width: 48,
      render: (_, record) => (
        <Tooltip title={record.pinned ? t('common.unpinned') : t('common.pinned')}>
          <Button
            type="text"
            size="small"
            className="tap-action"
            aria-label={record.pinned ? t('common.unpinned') : t('common.pinned')}
            icon={
              record.pinned ? (
                <PushpinFilled style={{ color: 'var(--app-kiln)' }} />
              ) : (
                <PushpinOutlined />
              )
            }
            onClick={() => onPin(record, !record.pinned)}
          />
        </Tooltip>
      ),
    },
    /*
     * 一个字段都没有时（用户还没配模板就记了东西），必须给速记正文一列。
     * 原来这里只有 visibleFields.map(...)，于是零字段的库在桌面上只剩
     * 「创建时间 / 操作」两列，记录显示成一行空白 —— 东西确实存下来了，
     * 但用户看不见，「存下了却看不到」比一开始就不提供这个功能更糟。
     */
    ...(visibleFields.length === 0
      ? [{
          title: t('lib.freeText.label'),
          key: '__free',
          ellipsis: true,
          className: 'cell-primary',
          width: 320,
          render: (_: unknown, record: Item) => {
            const free = getFreeText(record)
            return free ? <span style={{ whiteSpace: 'pre-wrap' }}>{free}</span> : t('common.emptyValue')
          },
        } as ColumnsType<Item>[number]]
      : []),
    // 第一个可见字段当作「标识列」：给足宽度 + 加粗，让每行第一眼就能认出是哪条。
    // 研究里反复出现的一条：表格的第一职责是可扫读性，标识列必须排在最前并占最大权重。
    ...visibleFields.map((f, i) => ({
      title: f.label,
      dataIndex: ['fields', f.key],
      key: f.key,
      ellipsis: true,
      // 对齐必须走 onCell 的内联 style：antd 的 align 生成的是运行时 cssinjs 样式，
      // 而 index.css 是构建期打包的，两者同为作者级、后者插入，会被 antd 覆盖。
      onCell: () => ({ style: { textAlign: alignOf(f.type) } }),
      className: i === 0 ? 'cell-primary' : undefined,
      width: i === 0 ? 220 : undefined,
      render: (_: unknown, record: Item, rowIndex: number) => {
        const isEditing = editCell?.row === rowIndex && editCell.key === f.key
        if (isEditing) {
          return (
            <div className={`cell-editing${savingCell ? ' is-saving' : ''}`} onKeyDown={(e) => {
              if (e.key === 'Escape') { e.stopPropagation(); cancelEdit() }
              else if (e.key === 'Enter' && !e.shiftKey && f.type !== 'textarea') {
                e.preventDefault(); e.stopPropagation(); void commitEdit('down')
              } else if (e.key === 'Tab') {
                e.preventDefault(); void commitEdit('right')
              }
            }}>
              <FieldRenderer field={f} value={draft} onChange={setDraft} autoFocus compact />
            </div>
          )
        }
        return (
          <div
            tabIndex={0}
            role="button"
            data-cell={`${rowIndex}-${i}`}
            className="cell-edit"
            aria-label={`${record.fields[visibleFields[0]?.key ?? ''] ?? ''} · ${f.label}`}
            title={t('lib.cell.editHint')}
            onClick={() => beginEdit(rowIndex, f)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'F2') {
                e.preventDefault(); beginEdit(rowIndex, f)
              } else {
                onGridKeyDown(e, rowIndex, i)
              }
            }}
          >
            <SmartValue field={f} value={record.fields[f.key]} />
          </div>
        )
      },
    })),
    {
      title: t('lib.col.createdAt'),
      dataIndex: 'createdAt',
      width: 140,
      onCell: () => ({ style: { textAlign: 'right' } }),
      render: (v: number) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: t('lib.col.actions'),
      key: 'action',
      width: 92,
      fixed: 'right',
      align: 'right',
      render: (_, record) => (
        <Space size={0}>
          <Button
            type="link"
            size="small"
            className="tap-action"
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
          />
          <Button
            type="link"
            size="small"
            className="tap-action"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(record)}
          />
        </Space>
      ),
    },
  ]

  return (
    <div ref={tableRef}>
      <Table<Item>
        rowKey="id"
        columns={columns}
        dataSource={items}
        size="middle"
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (n) => t('lib.total', { n }),
        }}
        // 超过一屏时表头吸顶，否则滚动几行就不知道在看哪一列
        sticky={items.length > 12}
        // 列多时仍需横向滚动，锚定首列方便知道自己在看哪一行
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <div /> }}
        rowClassName={(record) =>
          record.id === focusItemId ? 'focus-row' : record.pinned ? 'pinned-row' : ''
        }
        onRow={() => ({
          onClick: () => {
            if (focusItemId) focusItem(null)
          },
        })}
      />
    </div>
  )
}
