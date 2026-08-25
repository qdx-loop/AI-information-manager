import { Table, Button, Space, Tooltip, Card, Pagination } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, DeleteOutlined, PushpinOutlined, PushpinFilled } from '@ant-design/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FieldDef, Item } from '@/types'
import { renderCellValue } from '@/components/fields/FieldRenderer'
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

  const primaryOf = useMemo(
    () => (it: Item) => {
      for (const f of visibleFields) {
        const v = it.fields[f.key]
        if (v != null && String(v).trim() !== '') return `${f.label}: ${renderCellValue(f, v)}`
      }
      return '(无内容)'
    },
    [visibleFields],
  )

  // ———— 移动端：卡片列表（横向滚动太远才能摸到操作列，改为纵向卡片） ————
  if (isMobile) {
    const start = (page - 1) * PAGE_SIZE
    const paged = items.slice(start, start + PAGE_SIZE)
    return (
      <div ref={tableRef}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                    style={{ marginInlineEnd: 4 }}
                  />
                  {primaryOf(it)}
                </Tooltip>
              }
              extra={
                <Space size={0}>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(it)} />
                  <Button
                    type="link"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => onDelete(it)}
                  />
                </Space>
              }
            >
              {visibleFields.map((f) => (
                <div key={f.key} style={{ display: 'flex', gap: 8, fontSize: 13, padding: '2px 0' }}>
                  <span
                    style={{
                      color: 'var(--ant-color-text-secondary)',
                      minWidth: 76,
                      flexShrink: 0,
                    }}
                  >
                    {f.label}
                  </span>
                  <span style={{ wordBreak: 'break-all' }}>{renderCellValue(f, it.fields[f.key])}</span>
                </div>
              ))}
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
    ...visibleFields.map((f) => ({
      title: f.label,
      dataIndex: ['fields', f.key],
      key: f.key,
      ellipsis: true,
      render: (_: unknown, record: Item) => renderCellValue(f, record.fields[f.key]),
    })),
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: number) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 110,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(record)} />
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)} />
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
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        scroll={{ x: 'max-content' }}
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
