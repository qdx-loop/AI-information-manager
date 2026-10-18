import { useEffect } from 'react'
import { Card, Table, Button, Space, Popconfirm, Empty, App, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, UndoOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useLibraryStore } from '@/store/libraryStore'
import type { TrashEntry } from '@/types'
import { useI18n, tNow } from '@/i18n'

const { Text } = Typography

export default function TrashBin() {
  const { message } = App.useApp()
  const { trash, loadTrash, restoreLibrary, purgeLibrary, restoreItem, purgeItem } =
    useLibraryStore()
  const t = useI18n()

  useEffect(() => {
    loadTrash().catch((e) => message.error(tNow('lib.trash.loadFailed', { msg: (e as Error).message })))
  }, [loadTrash, message])

  const handleRestore = async (entry: TrashEntry) => {
    try {
      if (entry.kind === 'library') await restoreLibrary(entry.record.id)
      else await restoreItem(entry.record.id)
      message.success(t('lib.trash.restored'))
    } catch (e) {
      message.error(t('lib.trash.restoreFailed', { msg: (e as Error).message }))
    }
  }

  const handlePurge = async (entry: TrashEntry) => {
    try {
      if (entry.kind === 'library') await purgeLibrary(entry.record.id)
      else await purgeItem(entry.record.id)
      message.success(t('lib.trash.purged'))
    } catch (e) {
      message.error(t('lib.trash.purgeFailed', { msg: (e as Error).message }))
    }
  }

  const columns: ColumnsType<TrashEntry> = [
    {
      title: t('lib.trash.col.type'),
      dataIndex: 'kind',
      width: 90,
      // 类型用文字不用药丸 Tag：两种颜色在这里只是装饰
      render: (k: string) => (
        <Text type="secondary" style={{ fontSize: 12.5 }}>
          {k === 'library' ? t('lib.trash.kind.library') : t('lib.trash.kind.item')}
        </Text>
      ),
    },
    {
      title: t('lib.trash.col.name'),
      key: 'name',
      render: (_, entry) => {
        if (entry.kind === 'library') return entry.record.name
        const vals = Object.values(entry.record.fields).filter((v) => v != null && v !== '')
        return vals.length ? vals.join(' / ') : t('lib.trash.emptyItem')
      },
    },
    {
      title: t('lib.trash.col.library'),
      key: 'lib',
      render: (_, entry) => (entry.kind === 'item' ? (entry.libraryName || t('lib.trash.orphanLib')) : '—'),
    },
    {
      title: t('lib.trash.col.time'),
      dataIndex: 'deletedAt',
      width: 170,
      render: (v: number) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: t('lib.trash.col.actions'),
      key: 'action',
      width: 160,
      render: (_, entry) => (
        <Space>
          <Button size="small" icon={<UndoOutlined />} onClick={() => handleRestore(entry)}>{t('lib.trash.restore')}
          </Button>
          <Popconfirm title={t('lib.trash.purgeConfirm')} okText={t('lib.trash.purgeOk')} okButtonProps={{ danger: true }} onConfirm={() => handlePurge(entry)}>
            <Button size="small" danger icon={<DeleteOutlined />}>
              {t('lib.trash.purgeOk')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 16, height: '100%' }}>
      {/* 页面头不套 Card：标题一行、说明一行，编辑部式 */}
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {t('lib.trash.title')}
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--app-ink-faint)' }}>
          {t('lib.trash.notice')}
        </p>
      </div>
      <Card styles={{ body: { padding: 0 } }}>
        {trash.length === 0 ? (
          <Empty
            image={false}
            description={t('lib.trash.empty')}
            style={{ padding: '56px 0 64px' }}
          />
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
