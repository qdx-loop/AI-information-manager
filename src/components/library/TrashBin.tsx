import { useEffect } from 'react'
import { Table, Button, Popconfirm, App } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { InfoCircleOutlined, DeleteOutlined, UndoOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useLibraryStore } from '@/store/libraryStore'
import type { TrashEntry } from '@/types'
import { useI18n, tNow } from '@/i18n'
import { TRASH_RETENTION_DAYS } from '@/utils/retentionDays'
import EmptyPanel from './EmptyPanel'
import { usePagePadding } from './pageFrame'

/**
 * 回收站：白卡表格（类型 / 名称 / 所属库 / 删除时间 / 剩余天数 / 操作）。
 *
 * v3：页面标题 24 + 计数，说明是一行 13 muted（不是 Alert 色块），
 * 「剩余天数」用 .status-pill（≤3 天是 warning 变体），类型退成一列淡文字。
 */
export default function TrashBin() {
  const { message } = App.useApp()
  const pad = usePagePadding()
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

  /** 单元格统一 20px 行盒：14px 文字 + 上下 padding 8 + 1px 行线 = 37，行高钉在 38 */
  const CELL_LINE_HEIGHT = '20px'

  const columns: ColumnsType<TrashEntry> = [
    {
      title: t('lib.trash.col.type'),
      dataIndex: 'kind',
      width: 100,
      onHeaderCell: () => ({ style: { height: 40 } }),
      onCell: () => ({ style: { lineHeight: CELL_LINE_HEIGHT } }),
      // 类型用文字不用药丸 Tag：两种颜色在这里只是装饰
      render: (k: string) => (
        <span className="faint" style={{ fontSize: 'var(--text-xs)' }}>
          {k === 'library' ? t('lib.trash.kind.library') : t('lib.trash.kind.item')}
        </span>
      ),
    },
    {
      title: t('lib.trash.col.name'),
      key: 'name',
      onHeaderCell: () => ({ style: { height: 40 } }),
      onCell: () => ({ style: { lineHeight: CELL_LINE_HEIGHT } }),
      render: (_, entry) => {
        const text =
          entry.kind === 'library'
            ? entry.record.name
            : (() => {
                const vals = Object.values(entry.record.fields).filter((v) => v != null && v !== '')
                return vals.length ? vals.join(' / ') : t('lib.trash.emptyItem')
              })()
        return (
          <span
            style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}
          >
            {text}
          </span>
        )
      },
    },
    {
      title: t('lib.trash.col.library'),
      key: 'lib',
      onHeaderCell: () => ({ style: { height: 40 } }),
      onCell: () => ({ style: { lineHeight: CELL_LINE_HEIGHT } }),
      render: (_, entry) => (
        <span className="faint" style={{ fontSize: 'var(--text-xs)' }}>
          {entry.kind === 'item' ? entry.libraryName || t('lib.trash.orphanLib') : '—'}
        </span>
      ),
    },
    {
      title: t('lib.trash.col.time'),
      dataIndex: 'deletedAt',
      width: 168,
      onHeaderCell: () => ({ style: { height: 40, textAlign: 'right' } }),
      onCell: () => ({ style: { textAlign: 'right', lineHeight: CELL_LINE_HEIGHT } }),
      render: (v: number) => (
        <span className="mono tabular" style={{ fontSize: 'var(--text-xs)' }}>{dayjs(v).format('YYYY-MM-DD HH:mm')}</span>
      ),
    },
    {
      title: t('lib.trash.col.remaining'),
      key: 'remaining',
      width: 120,
      onHeaderCell: () => ({ style: { height: 40, textAlign: 'right' } }),
      onCell: () => ({ style: { textAlign: 'right', lineHeight: CELL_LINE_HEIGHT } }),
      render: (_, entry) => {
        const days = remainingDays(entry.deletedAt)
        // 剩 3 天内是「临期」：warning 色片；其余中性色片
        return (
          <span
            className={`status-pill ${days <= 3 ? 'is-warning' : ''}`}
            // pill 默认 22px 高会把 38px 行撑到 39：压到 20px 行盒
            style={{ lineHeight: '20px', padding: '0 8px' }}
          >
            {days} {t('lib.trash.days')}
          </span>
        )
      },
    },
    {
      title: t('lib.trash.col.actions'),
      key: 'action',
      width: 172,
      onHeaderCell: () => ({ style: { height: 40, textAlign: 'right' } }),
      onCell: () => ({ style: { textAlign: 'right', lineHeight: CELL_LINE_HEIGHT } }),
      render: (_, entry) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, margin: '-6px 0' }}>
          <Button size="small" type="default" icon={<UndoOutlined />} onClick={() => handleRestore(entry)}>
            {t('lib.trash.restore')}
          </Button>
          <Popconfirm
            title={t('lib.trash.purgeConfirm')}
            okText={t('lib.trash.purgeOk')}
            okButtonProps={{ danger: true }}
            onConfirm={() => handlePurge(entry)}
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />}>
              {t('lib.trash.purgeOk')}
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ]

  return (
    <div style={{ ...pad, height: '100%' }}>
      {/* 页面头：24 标题 + 计数；说明是一行 13px muted 文字，不是 Alert 色块 */}
      <div className="page-head">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h1 className="page-title">{t('lib.trash.title')}</h1>
          <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            <span className="tabular">{trash.length}</span> {t('lib.count.unit')}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '0 0 16px' }}>
        <InfoCircleOutlined style={{ fontSize: 14, color: 'var(--ink-faint)', flexShrink: 0, marginTop: 3 }} aria-hidden />
        <span className="muted" style={{ fontSize: 'var(--text-xs)', lineHeight: 1.6 }}>
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
            onHeaderRow={() => ({ style: { height: 40 } })}
            onRow={() => ({ style: { height: 38, fontSize: 'var(--text-sm)' } })}
            pagination={{ pageSize: 20, showTotal: (n) => t('lib.total', { n }) }}
          />
        </div>
      )}
    </div>
  )
}
