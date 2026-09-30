import { Table, Button, Space, Tooltip, Card, Pagination } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, DeleteOutlined, PushpinOutlined, PushpinFilled } from '@ant-design/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FieldDef, Item } from '@/types'
import { renderCellValue } from '@/components/fields/FieldRenderer'
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

export default function LibraryTable({ fields, items, focusItemId, onEdit, onDelete, onPin }: Props) {
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
      return '(无内容)'
    },
    [visibleFields],
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
      <div ref={tableRef}>
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
                <Tooltip title={it.pinned ? '取消置顶' : '置顶'}>
                  <Button
                    type="text"
                    size="small"
                    icon={
                      it.pinned ? <PushpinFilled style={{ color: '#faad14' }} /> : <PushpinOutlined />
                    }
                    onClick={() => onPin(it, !it.pinned)}
                    className="tap-action"
                    style={{ marginInlineEnd: 4 }}
                  />
                  {primaryOf(it)}
                </Tooltip>
              }
              extra={
                <Space size={0}>
                  <Button type="link" size="small" className="tap-action" icon={<EditOutlined />} onClick={() => onEdit(it)} />
                  <Button
                    type="link"
                    size="small"
                    className="tap-action"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => onDelete(it)}
                  />
                </Space>
              }
            >
              {restFields(it).map((f) => (
                <div
                  key={f.key}
                  style={{
                    display: 'flex',
                    gap: 10,
                    fontSize: 13,
                    padding: '2px 0',
                    alignItems: 'baseline',
                  }}
                >
                  <span
                    style={{
                      color: 'var(--app-ink-faint)',
                      width: 72,
                      flexShrink: 0,
                      fontSize: 12,
                    }}
                  >
                    {f.label}
                  </span>
                  <span
                    style={{
                      wordBreak: 'break-word',
                      minWidth: 0,
                      flex: 1,
                      textAlign: alignOf(f.type) === 'left' ? 'left' : 'right',
                    }}
                  >
                    <SmartValue field={f} value={it.fields[f.key]} />
                  </span>
                </div>
              ))}
              {restFields(it).length === 0 && (
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

  // ———— 桌面端：表格 ————
  const columns: ColumnsType<Item> = [
    {
      title: '',
      dataIndex: 'pinned',
      width: 48,
      render: (_, record) => (
        <Tooltip title={record.pinned ? '取消置顶' : '置顶'}>
          <Button
            type="text"
            size="small"
            icon={record.pinned ? <PushpinFilled style={{ color: '#faad14' }} /> : <PushpinOutlined />}
            onClick={() => onPin(record, !record.pinned)}
          />
        </Tooltip>
      ),
    },
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
      render: (_: unknown, record: Item) => <SmartValue field={f} value={record.fields[f.key]} />,
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
