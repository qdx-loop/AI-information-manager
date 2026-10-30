import { useEffect } from 'react'
import { Table, Button, Space, Popconfirm, App } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useLibraryStore } from '@/store/libraryStore'
import type { TrashEntry } from '@/types'
import { useI18n, tNow } from '@/i18n'
import { TRASH_RETENTION_DAYS } from '@/utils/retentionDays'
import { usePagePadding } from './pageFrame'

/**
 * 回收站：一张账页表格（类型 / 名称 / 所属库 / 删除时间 / 剩余天数）。
 *
 * 原来顶部是一条 antd Alert 黄色块，类型用彩色 Tag —— 两个都是「后台模板」的
 * 默认长相。现在警示是一行 13px 文字 + 赭色小方点，类型退成一列淡文字；
 * 唯一需要强调的数字是「剩余天数」，所以它是唯一的等宽数字列。
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

  /** 行内文字按钮：18px 高，避免把 32px 的账页行撑高 */
  const actionBtnStyle: React.CSSProperties = { height: 18, padding: '0 4px', fontSize: 'var(--text-xs)' }

  const headCell = (right = false): React.CSSProperties => ({
    height: 36,
    padding: '0 12px',
    ...(right ? { textAlign: 'right' as const } : null),
  })
  const bodyCell = (right = false): React.CSSProperties => ({
    padding: '6px 12px',
    verticalAlign: 'middle',
    // 13px × 1.3 ≈ 17，加上下 padding 12 与 1px 行线 → 32px 账页行
    lineHeight: 1.3,
    ...(right ? { textAlign: 'right' as const, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' } : null),
  })

  const columns: ColumnsType<TrashEntry> = [
    {
      title: <span className="eyebrow">{t('lib.trash.col.type')}</span>,
      dataIndex: 'kind',
      width: 96,
      onHeaderCell: () => ({ style: headCell() }),
      onCell: () => ({ style: bodyCell() }),
      // 类型用文字不用药丸 Tag：两种颜色在这里只是装饰
      render: (k: string) => (
        <span className="faint" style={{ fontSize: 'var(--text-xs)' }}>
          {k === 'library' ? t('lib.trash.kind.library') : t('lib.trash.kind.item')}
        </span>
      ),
    },
    {
      title: <span className="eyebrow">{t('lib.trash.col.name')}</span>,
      key: 'name',
      onHeaderCell: () => ({ style: headCell() }),
      onCell: () => ({ style: bodyCell() }),
      render: (_, entry) => {
        const text =
          entry.kind === 'library'
            ? entry.record.name
            : (() => {
                const vals = Object.values(entry.record.fields).filter((v) => v != null && v !== '')
                return vals.length ? vals.join(' / ') : t('lib.trash.emptyItem')
              })()
        return (
          <span className="cell-primary" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {text}
          </span>
        )
      },
    },
    {
      title: <span className="eyebrow">{t('lib.trash.col.library')}</span>,
      key: 'lib',
      onHeaderCell: () => ({ style: headCell() }),
      onCell: () => ({ style: bodyCell() }),
      render: (_, entry) => (
        <span className="faint" style={{ fontSize: 'var(--text-xs)' }}>
          {entry.kind === 'item' ? entry.libraryName || t('lib.trash.orphanLib') : '—'}
        </span>
      ),
    },
    {
      title: <span className="eyebrow">{t('lib.trash.col.time')}</span>,
      dataIndex: 'deletedAt',
      width: 170,
      onHeaderCell: () => ({ style: headCell(true) }),
      onCell: () => ({ style: bodyCell(true) }),
      render: (v: number) => <span className="mono num">{dayjs(v).format('YYYY-MM-DD HH:mm')}</span>,
    },
    {
      title: <span className="eyebrow">{t('lib.trash.col.remaining')}</span>,
      key: 'remaining',
      width: 110,
      onHeaderCell: () => ({ style: headCell(true) }),
      onCell: () => ({ style: bodyCell(true) }),
      render: (_, entry) => {
        const days = remainingDays(entry.deletedAt)
        // 剩 3 天内是「临期」：赭色文字 + 6px 方点（不是彩色胶囊）
        if (days <= 3)
          return (
            <span className="tag-dot" style={{ color: 'var(--app-warning)', justifyContent: 'flex-end' }}>
              <span className="mono num">{days}</span> {t('lib.trash.days')}
            </span>
          )
        return (
          <span className="mono num faint">
            {days} <span style={{ fontFamily: 'var(--font-sans)' }}>{t('lib.trash.days')}</span>
          </span>
        )
      },
    },
    {
      title: <span className="eyebrow">{t('lib.trash.col.actions')}</span>,
      key: 'action',
      width: 168,
      onHeaderCell: () => ({ style: headCell(true) }),
      onCell: () => ({ style: { padding: '0 8px', textAlign: 'right' as const, verticalAlign: 'middle' as const, lineHeight: 1 } }),
      render: (_, entry) => (
        <Space size={4}>
          <Button size="small" type="text" style={actionBtnStyle} onClick={() => handleRestore(entry)}>{t('lib.trash.restore')}</Button>
          <Popconfirm title={t('lib.trash.purgeConfirm')} okText={t('lib.trash.purgeOk')} okButtonProps={{ danger: true }} onConfirm={() => handlePurge(entry)}>
            <Button size="small" type="text" danger style={actionBtnStyle}>
              {t('lib.trash.purgeOk')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ ...pad, height: '100%' }}>
      {/* 页面头：26 衬线标题 + 12 mono 计数；说明是一行 13px 文字，不是 Alert 色块 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, minHeight: 40, flexWrap: 'wrap' }}>
        <h1 className="page-title">{t('lib.trash.title')}</h1>
        <span className="faint" style={{ fontSize: 'var(--text-xs)' }}>
          <span className="mono num">{trash.length}</span> {t('lib.count.unit')}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '4px 0 16px' }}>
        <span aria-hidden style={{ width: 6, height: 6, background: 'var(--app-warning)', flexShrink: 0, marginTop: 6 }} />
        <span className="muted" style={{ fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
          {t('lib.trash.notice')}
        </span>
      </div>

      {trash.length === 0 ? (
        <div className="empty-state" style={{ padding: '48px 16px', textAlign: 'center' }}>
          <div className="empty-state-title">{t('lib.trash.empty')}</div>
        </div>
      ) : (
        <Table<TrashEntry>
          rowKey={(r) => `${r.kind}-${r.record.id}`}
          columns={columns}
          dataSource={trash}
          size="small"
          onHeaderRow={() => ({ style: { height: 36 } })}
          onRow={() => ({ style: { height: 32, fontSize: 'var(--text-sm)' } })}
          pagination={{ pageSize: 20, showTotal: (n) => t('lib.total', { n }) }}
          scroll={{ x: 'max-content' }}
        />
      )}
    </div>
  )
}
