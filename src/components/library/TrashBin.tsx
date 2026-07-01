import { useEffect } from 'react'
import { Card, Table, Button, Space, Tag, Popconfirm, Empty, App } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, UndoOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useLibraryStore } from '@/store/libraryStore'
import type { TrashEntry } from '@/types'

export default function TrashBin() {
  const { message } = App.useApp()
  const { trash, loadTrash, restoreLibrary, purgeLibrary, restoreItem, purgeItem } =
    useLibraryStore()

  useEffect(() => {
    void loadTrash()
  }, [loadTrash])

  const handleRestore = async (entry: TrashEntry) => {
    if (entry.kind === 'library') await restoreLibrary(entry.record.id)
    else await restoreItem(entry.record.id)
    message.success('已恢复')
  }

  const handlePurge = async (entry: TrashEntry) => {
    if (entry.kind === 'library') await purgeLibrary(entry.record.id)
    else await purgeItem(entry.record.id)
    message.success('已永久删除')
  }

  const columns: ColumnsType<TrashEntry> = [
    {
      title: '类型',
      dataIndex: 'kind',
      width: 90,
      render: (k: string) =>
        k === 'library' ? <Tag color="purple">管理库</Tag> : <Tag color="blue">条目</Tag>,
    },
    {
      title: '名称/摘要',
      key: 'name',
      render: (_, entry) => {
        if (entry.kind === 'library') return entry.record.name
        const vals = Object.values(entry.record.fields).filter((v) => v != null && v !== '')
        return vals.length ? vals.join(' / ') : '（空条目）'
      },
    },
    {
      title: '所属库',
      key: 'lib',
      render: (_, entry) => (entry.kind === 'item' ? entry.libraryName : '—'),
    },
    {
      title: '删除时间',
      dataIndex: 'deletedAt',
      width: 170,
      render: (v: number) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, entry) => (
        <Space>
          <Button size="small" icon={<UndoOutlined />} onClick={() => handleRestore(entry)}>
            恢复
          </Button>
          <Popconfirm title="永久删除后无法恢复" okText="永久删除" okType="danger" onConfirm={() => handlePurge(entry)}>
            <Button size="small" danger icon={<DeleteOutlined />}>
              永久删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 16, height: '100%' }}>
      <Card title="回收站" styles={{ body: { padding: 0 } }}>
        {trash.length === 0 ? (
          <Empty description="回收站为空" style={{ padding: 48 }} />
        ) : (
          <Table<TrashEntry>
            rowKey={(r) => `${r.kind}-${r.record.id}`}
            columns={columns}
            dataSource={trash}
            pagination={{ pageSize: 20 }}
          />
        )}
      </Card>
    </div>
  )
}
