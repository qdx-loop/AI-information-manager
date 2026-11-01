import { useEffect } from 'react'
import { Table, Button, Popconfirm, App } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { InfoCircleOutlined, UndoOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useLibraryStore } from '@/store/libraryStore'
import type { TrashEntry } from '@/types'
import { useI18n, tNow } from '@/i18n'
import { TRASH_RETENTION_DAYS } from '@/utils/retentionDays'
import EmptyPanel from './EmptyPanel'

/**
 * 回收站（v4 SIGNAL PRESS）：page-head + `.data-table` 硬边表格（行 40）。
 *
 * 剩余天数用 `.status-pill`（≤3 天 warning / 其他 neutral）；类型用 mono 小标签；
 * 说明是一行 13 文字 + signal 色 dot，不是柔和 Alert。恢复/永久删除逻辑不变。
 */
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

  /** 距离「彻底清除」还剩几天（0 = 今天就会过期） */
  const remainingDays = (deletedAt: number): number =>
    Math.max(0, TRASH_RETENTION_DAYS - dayjs().startOf('day').diff(dayjs(deletedAt).startOf('day'), 'day'))

  const columns: ColumnsType<TrashEntry> = [
    {
      title: t('lib.trash.col.type'),
      dataIndex: 'kind',
      width: 112,
      render: (k: string) => (
        <span className="tag-mono">
          {k === 'library' ? t('lib.trash.kind.library') : t('lib.trash.kind.item')}
        </span>
      ),
    },
    {
      title: t('lib.trash.col.name'),
      key: 'name',
      render: (_, entry) => {
        const text =
          entry.kind === 'library'
            ? entry.record.name
            : (() => {
                const vals = Object.values(entry.record.fields).filter((v) => v != null && v !== '')
                return vals.length ? vals.join(' / ') : t('lib.trash.emptyItem')
              })()
        return (
          <span style={{ display: 'block', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {text}
          </span>
        )
      },
    },
    {
      title: t('lib.trash.col.library'),
      key: 'lib',
      render: (_, entry) => (
        <span style={{ fontSize: 'var(--t-xs)', color: 'var(--text-secondary)' }}>
          {entry.kind === 'item' ? entry.libraryName || t('lib.trash.orphanLib') : '—'}
        </span>
      ),
    },
    {
      title: t('lib.trash.col.time'),
      dataIndex: 'deletedAt',
      width: 180,
      onHeaderCell: () => ({ style: { textAlign: 'right' } }),
      onCell: () => ({ style: { textAlign: 'right' } }),
      render: (v: number) => (
        <span className="mono tabular" style={{ fontSize: 'var(--t-xs)' }}>{dayjs(v).format('YYYY-MM-DD HH:mm')}</span>
      ),
    },
    {
      title: t('lib.trash.col.remaining'),
      key: 'remaining',
      width: 128,
      onHeaderCell: () => ({ style: { textAlign: 'right' } }),
      onCell: () => ({ style: { textAlign: 'right' } }),
      render: (_, entry) => {
        const days = remainingDays(entry.deletedAt)
        // 剩 3 天内是「临期」：warning 色片；其余 neutral
        return (
          <span
            className={`status-pill ${days <= 3 ? 'is-warning' : 'is-neutral'}`}
            // 22px pill 用 -1px 负 margin 压进 40px 行高
            style={{ margin: '-1px 0' }}
          >
            {days} {t('lib.trash.days')}
          </span>
        )
      },
    },
    {
      title: '',
      key: 'action',
      width: 188,
      fixed: 'right',
      render: (_, entry) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '-6px 0' }}>
          <Button size="small" icon={<UndoOutlined />} onClick={() => handleRestore(entry)}>
            {t('lib.trash.restore')}
          </Button>
          <Popconfirm
            title={t('lib.trash.purgeConfirm')}
            okText={t('lib.trash.purgeOk')}
            okButtonProps={{ danger: true }}
            onConfirm={() => handlePurge(entry)}
          >
            <Button size="small" type="text" danger>
              {t('lib.trash.purgeOk')}
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ]

  return (
    <div className="workbench">
      {/* 页头：kicker + Outfit 800 标题 + count-chip */}
      <div className="page-head">
        <div className="page-head-main">
          <div className="page-kicker">{t('lib.trash.kicker')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 className="page-title">{t('lib.trash.title')}</h1>
            <span className="count-chip">{trash.length} {t('lib.count.unit')}</span>
          </div>
        </div>
      </div>
      <div className="page-bar" />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 'var(--s4)' }}>
        <InfoCircleOutlined style={{ fontSize: 14, color: 'var(--accent-2)', flexShrink: 0, marginTop: 3 }} aria-hidden />
        <span className="field-hint" style={{ lineHeight: 1.5 }}>
          {t('lib.trash.notice')}
        </span>
      </div>

      {trash.length === 0 ? (
        <EmptyPanel title={t('lib.trash.empty')} />
      ) : (
        <div className="data-table">
          <Table<TrashEntry>
            rowKey={(r) => `${r.kind}-${r.record.id}`}
            columns={columns}
            dataSource={trash}
            scroll={{ x: 'max-content' }}
            onRow={() => ({ style: { height: 40 } })}
            pagination={{
              pageSize: 20,
              showTotal: (n) => <span className="table-count">{t('lib.total', { n })}</span>,
            }}
          />
        </div>
      )}
    </div>
  )
}
