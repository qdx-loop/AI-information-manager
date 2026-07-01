import { Table, Button, Space, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, DeleteOutlined, PushpinOutlined, PushpinFilled } from '@ant-design/icons'
import { useEffect, useRef } from 'react'
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

export default function LibraryTable({ fields, items, focusItemId, onEdit, onDelete, onPin }: Props) {
  const tableRef = useRef<HTMLDivElement>(null)
  const focusItem = useLibraryStore((s) => s.focusItem)

  const visibleFields = fields.filter((f) => f.visible)

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

  // 焦点条目滚动定位 + 自动清除高亮
  useEffect(() => {
    if (!focusItemId) return
    const el = tableRef.current?.querySelector(`tr[data-row-key="${focusItemId}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // 5 秒后自动清除高亮
    const timer = setTimeout(() => focusItem(null), 5000)
    return () => clearTimeout(timer)
  }, [focusItemId, items, focusItem])

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
      <style>{`
        .focus-row td { background: #fff7e6 !important; box-shadow: inset 3px 0 0 #fa8c16; }
        .pinned-row td { background: #fffbe6; }
      `}</style>
    </div>
  )
}
