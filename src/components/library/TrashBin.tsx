import { useEffect, useMemo, useState } from 'react'
import { Table, Popconfirm, App, Pagination } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  InfoRegular,
  HomeRegular,
  ChevronRightRegular,
  ArrowClockwiseRegular,
  ArrowUndoRegular,
  DeleteRegular,
  FolderRegular,
  DocumentRegular,
} from '@fluentui/react-icons'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { useLibraryStore } from '@/store/libraryStore'
import type { TrashEntry } from '@/types'
import { useI18n, tNow } from '@/i18n'
import { TRASH_RETENTION_DAYS } from '@/utils/retentionDays'
import EmptyPanel from './EmptyPanel'
import { useLibText } from './labels'

/**
 * 回收站（v9 · Windows 11 文件资源管理器）。
 *
 * 地址条（首页 > 回收站）+ InfoBar 说明 + 文件资源管理器式表格 + 底部状态栏；
 * 剩余天数用中性标签（≤3 天改警告语义），恢复 / 永久删除逻辑与原来完全一致。
 * 移动端退化为单列卡片。
 */
export default function TrashBin() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { trash, loadTrash, restoreLibrary, purgeLibrary, restoreItem, purgeItem } =
    useLibraryStore()
  const t = useI18n()
  const lt = useLibText()
  const [page, setPage] = useState(1)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    loadTrash().catch((e) => message.error(tNow('lib.trash.loadFailed', { msg: (e as Error).message })))
  }, [loadTrash, message])

  const PAGE_SIZE = 20
  const pageCount = Math.max(1, Math.ceil(trash.length / PAGE_SIZE))
  const clampedPage = Math.min(page, pageCount)
  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])
  const paged = useMemo(
    () => trash.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE),
    [trash, clampedPage],
  )

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

  const handleRefresh = () => {
    loadTrash().catch((e) => message.error(tNow('lib.trash.loadFailed', { msg: (e as Error).message })))
  }

  /** 距离「彻底清除」还剩几天（0 = 今天就会过期） */
  const remainingDays = (deletedAt: number): number =>
    Math.max(0, TRASH_RETENTION_DAYS - dayjs().startOf('day').diff(dayjs(deletedAt).startOf('day'), 'day'))

  const kindTag = (kind: 'library' | 'item') => (
    <span className="w-tag lib-trash-kind">
      {kind === 'library' ? <FolderRegular style={{ fontSize: 13 }} /> : <DocumentRegular style={{ fontSize: 13 }} />}
      {kind === 'library' ? t('lib.trash.kind.library') : t('lib.trash.kind.item')}
    </span>
  )

  const daysTag = (deletedAt: number) => {
    const days = remainingDays(deletedAt)
    return (
      <span className={`w-tag lib-trash-days${days <= 3 ? ' w-tag--warning' : ''}`}>
        {lt('trash.remaining', { n: days })}
      </span>
    )
  }

  const entryText = (entry: TrashEntry) => {
    if (entry.kind === 'library') return entry.record.name
    const vals = Object.values(entry.record.fields).filter((v) => v != null && v !== '')
    return vals.length ? vals.map(String).join(' / ') : t('lib.trash.emptyItem')
  }

  const rowActions = (entry: TrashEntry) => (
    <div className="lib-trash-actions">
      <button type="button" className="w-btn w-btn--sm w-btn--subtle" onClick={() => void handleRestore(entry)}>
        <ArrowUndoRegular />
        {lt('trash.restore')}
      </button>
      <Popconfirm
        icon={null}
        title={t('lib.trash.purgeConfirm')}
        okText={t('lib.trash.purgeOk')}
        okButtonProps={{ danger: true }}
        cancelText={t('common.cancel')}
        onConfirm={() => void handlePurge(entry)}
      >
        <button type="button" className="w-btn w-btn--sm w-btn--danger">
          <DeleteRegular />
          {lt('trash.purge')}
        </button>
      </Popconfirm>
    </div>
  )

  const columns: ColumnsType<TrashEntry> = [
    {
      title: t('lib.trash.col.type'),
      dataIndex: 'kind',
      width: 120,
      render: (_: unknown, entry) => kindTag(entry.kind),
    },
    {
      title: t('lib.trash.col.name'),
      key: 'name',
      render: (_, entry) => (
        <span className="lib-trash-name" title={entryText(entry)}>
          {entryText(entry)}
        </span>
      ),
    },
    {
      title: t('lib.trash.col.library'),
      key: 'lib',
      width: 160,
      render: (_, entry) => (
        <span className="lib-trash-lib">
          {entry.kind === 'item' ? entry.libraryName || t('lib.trash.orphanLib') : '—'}
        </span>
      ),
    },
    {
      title: t('lib.trash.col.time'),
      dataIndex: 'deletedAt',
      width: 168,
      render: (v: number) => <span className="lib-trash-time">{dayjs(v).format('YYYY-MM-DD HH:mm')}</span>,
    },
    {
      title: t('lib.trash.col.remaining'),
      key: 'remaining',
      width: 132,
      render: (_, entry) => daysTag(entry.deletedAt),
    },
    {
      title: '',
      key: 'action',
      width: 200,
      render: (_, entry) => rowActions(entry),
    },
  ]

  return (
    <div className="lib-page">
      {/* 地址条（32）：首页 > 回收站 */}
      <div className="lib-addrbar">
        <div className="lib-addr-nav">
          <button
            type="button"
            className="w-iconbtn"
            aria-label={t('app.home')}
            title={t('app.home')}
            onClick={() => navigate('/')}
          >
            <HomeRegular />
          </button>
          <button
            type="button"
            className="w-iconbtn"
            aria-label={t('common.refresh')}
            title={t('common.refresh')}
            onClick={handleRefresh}
          >
            <ArrowClockwiseRegular />
          </button>
        </div>
        <nav className="w-bcrumb" aria-label={t('app.home')}>
          <button type="button" className="w-bcrumb-item" onClick={() => navigate('/')}>
            <HomeRegular />
            {t('app.home')}
          </button>
          <span className="w-bcrumb-sep" aria-hidden>
            <ChevronRightRegular />
          </span>
          <span className="w-bcrumb-current">
            <DeleteRegular style={{ color: 'var(--w-accent)', fontSize: 14 }} />
            {t('lib.trash.title')}
          </span>
        </nav>
        <span className="lib-addr-meta">{lt('status.total', { n: trash.length })}</span>
      </div>

      {/* 移动端页头（桌面端地址条已说明当前位置） */}
      <div className="lib-mobile-head">
        <h1 className="lib-mobile-title">{t('lib.trash.title')}</h1>
        <span className="lib-mobile-meta">{lt('status.total', { n: trash.length })}</span>
        <button
          type="button"
          className="w-iconbtn w-iconbtn--sm"
          aria-label={t('common.refresh')}
          title={t('common.refresh')}
          onClick={handleRefresh}
        >
          <ArrowClockwiseRegular />
        </button>
      </div>

      {/* 说明：Win11 InfoBar（中性底 + 线性图标），不是柔和 Alert */}
      <div className="lib-notice-wrap">
        <div className="lib-infobar">
          <InfoRegular />
          <span className="lib-infobar-body">{t('lib.trash.notice')}</span>
        </div>
      </div>

      {trash.length === 0 ? (
        <EmptyPanel icon={<DeleteRegular />} title={t('lib.trash.empty')} />
      ) : (
        <div className="lib-list" style={{ marginTop: 8 }}>
          {isMobile ? (
            <div className="lib-cards">
              {paged.map((entry) => (
                <div key={`${entry.kind}-${entry.record.id}`} className="lib-card">
                  <div className="lib-card-head">
                    {kindTag(entry.kind)}
                    <span className="lib-card-name" title={entryText(entry)}>
                      {entryText(entry)}
                    </span>
                    {daysTag(entry.deletedAt)}
                  </div>
                  <div className="lib-card-fields">
                    <div className="lib-card-field">
                      <span className="lib-card-label">{t('lib.trash.col.library')}</span>
                      <span className="lib-card-value">
                        {entry.kind === 'item' ? entry.libraryName || t('lib.trash.orphanLib') : '—'}
                      </span>
                    </div>
                    <div className="lib-card-field">
                      <span className="lib-card-label">{t('lib.trash.col.time')}</span>
                      <span className="lib-card-value lib-trash-time">{dayjs(entry.deletedAt).format('YYYY-MM-DD HH:mm')}</span>
                    </div>
                  </div>
                  {rowActions(entry)}
                </div>
              ))}
            </div>
          ) : (
            <div className="lib-table-scroll w-scroll">
              <div className="lib-table">
                <Table<TrashEntry>
                  rowKey={(r) => `${r.kind}-${r.record.id}`}
                  columns={columns}
                  dataSource={paged}
                  scroll={{ x: 'max-content' }}
                  tableLayout="fixed"
                  pagination={false}
                  onRow={() => ({ style: { height: 40 } })}
                />
              </div>
            </div>
          )}
          <div className="lib-statusbar">
            <div className="lib-status-group">
              <span className="lib-status-strong">{lt('status.total', { n: trash.length })}</span>
            </div>
            <span className="lib-status-spacer" />
            {pageCount > 1 && (
              <Pagination
                simple
                size="small"
                current={clampedPage}
                pageSize={PAGE_SIZE}
                total={trash.length}
                showSizeChanger={false}
                onChange={(p) => setPage(p)}
                aria-label={lt('status.page', { p: clampedPage, total: pageCount })}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
