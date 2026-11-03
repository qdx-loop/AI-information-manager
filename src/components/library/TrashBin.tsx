import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Breadcrumb,
  BreadcrumbButton,
  BreadcrumbDivider,
  BreadcrumbItem,
  Button,
  Card,
  MessageBar,
  MessageBarBody,
  Text,
  Tooltip,
} from '@fluentui/react-components'
import {
  ArrowClockwiseRegular,
  ArrowUndoRegular,
  DeleteRegular,
  DocumentRegular,
  FolderRegular,
  HomeRegular,
  InfoRegular,
} from '@fluentui/react-icons'
import { App } from 'antd'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { useLibraryStore } from '@/store/libraryStore'
import type { TrashEntry } from '@/types'
import { useI18n, tNow } from '@/i18n'
import { TRASH_RETENTION_DAYS } from '@/utils/retentionDays'
import EmptyPanel from './EmptyPanel'
import { LibConfirm, LibPager, useLibText } from './labels'

/**
 * 回收站（v10 Fluent UI · 资源管理器式）。
 *
 * 面包屑（首页 > 回收站）+ Fluent MessageBar 说明 + 原生表格（Fluent token 渲染）+
 * 底部状态栏；恢复 / 永久删除逻辑与原来完全一致。移动端退化为 Fluent Card 列表。
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
  const [purgeTarget, setPurgeTarget] = useState<TrashEntry | null>(null)
  const [purging, setPurging] = useState(false)

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

  const handlePurge = async () => {
    const entry = purgeTarget
    if (!entry || purging) return
    setPurging(true)
    try {
      if (entry.kind === 'library') await purgeLibrary(entry.record.id)
      else await purgeItem(entry.record.id)
      message.success(t('lib.trash.purged'))
      setPurgeTarget(null)
    } catch (e) {
      message.error(t('lib.trash.purgeFailed', { msg: (e as Error).message }))
    } finally {
      setPurging(false)
    }
  }

  const handleRefresh = () => {
    loadTrash().catch((e) => message.error(tNow('lib.trash.loadFailed', { msg: (e as Error).message })))
  }

  /** 距离「彻底清除」还剩几天（0 = 今天就会过期） */
  const remainingDays = (deletedAt: number): number =>
    Math.max(0, TRASH_RETENTION_DAYS - dayjs().startOf('day').diff(dayjs(deletedAt).startOf('day'), 'day'))

  const kindBadge = (kind: 'library' | 'item') => (
    <Badge appearance="outline" color="subtle" size="small">
      <span className="lib-trash-kind">
        {kind === 'library' ? <FolderRegular /> : <DocumentRegular />}
        {kind === 'library' ? t('lib.trash.kind.library') : t('lib.trash.kind.item')}
      </span>
    </Badge>
  )

  const daysBadge = (deletedAt: number) => {
    const days = remainingDays(deletedAt)
    return (
      <Badge appearance={days <= 3 ? 'tint' : 'outline'} color={days <= 3 ? 'warning' : 'subtle'} size="small">
        {lt('trash.remaining', { n: days })}
      </Badge>
    )
  }

  const entryText = (entry: TrashEntry) => {
    if (entry.kind === 'library') return entry.record.name
    const vals = Object.values(entry.record.fields).filter((v) => v != null && v !== '')
    return vals.length ? vals.map(String).join(' / ') : t('lib.trash.emptyItem')
  }

  const rowActions = (entry: TrashEntry) => (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', width: '100%' }}>
      <Tooltip content={lt('trash.restore')} relationship="label">
        <Button
          appearance="subtle"
          size="small"
          icon={<ArrowUndoRegular />}
          aria-label={lt('trash.restore')}
          onClick={() => void handleRestore(entry)}
        >
          {lt('trash.restore')}
        </Button>
      </Tooltip>
      <Tooltip content={lt('trash.purge')} relationship="label">
        <Button
          appearance="subtle"
          size="small"
          icon={<DeleteRegular />}
          aria-label={lt('trash.purge')}
          style={{ color: 'var(--w-danger)' }}
          onClick={() => setPurgeTarget(entry)}
        >
          {lt('trash.purge')}
        </Button>
      </Tooltip>
    </div>
  )

  return (
    <div className="lib-page">
      {/* 工具栏：刷新 + 数量 */}
      <div className="lib-toolbar">
        <Button appearance="subtle" icon={<ArrowClockwiseRegular />} onClick={handleRefresh}>
          {t('common.refresh')}
        </Button>
        <span className="lib-toolbar-spacer" />
      </div>

      {/* 面包屑：首页 > 回收站 */}
      <div className="lib-pathrow">
        <Breadcrumb aria-label={t('app.home')}>
          <BreadcrumbItem>
            <BreadcrumbButton icon={<HomeRegular />} onClick={() => navigate('/')}>
              {t('app.home')}
            </BreadcrumbButton>
          </BreadcrumbItem>
          <BreadcrumbDivider />
          <BreadcrumbItem>
            <BreadcrumbButton current icon={<DeleteRegular />}>
              {t('lib.trash.title')}
            </BreadcrumbButton>
          </BreadcrumbItem>
        </Breadcrumb>
      </div>

      <div className="lib-content">
        <div style={{ marginBottom: 10 }}>
          <MessageBar intent="info">
            <MessageBarBody>
              <InfoRegular /> {t('lib.trash.notice')}
            </MessageBarBody>
          </MessageBar>
        </div>

        {trash.length === 0 ? (
          <EmptyPanel icon={<DeleteRegular />} title={t('lib.trash.empty')} />
        ) : (
          <div className="lib-list">
            {isMobile ? (
              <div className="lib-cards">
                {paged.map((entry) => (
                  <Card key={`${entry.kind}-${entry.record.id}`} appearance="filled" size="small" className="lib-item-card">
                    <div className="lib-item-head">
                      {kindBadge(entry.kind)}
                      <Text weight="semibold" className="lib-item-name" title={entryText(entry)}>
                        {entryText(entry)}
                      </Text>
                      {daysBadge(entry.deletedAt)}
                    </div>
                    <div className="lib-item-fields">
                      <div className="lib-item-field">
                        <span className="lib-item-field-label">{t('lib.trash.col.library')}</span>
                        <span className="lib-item-field-value">
                          {entry.kind === 'item' ? entry.libraryName || t('lib.trash.orphanLib') : '—'}
                        </span>
                      </div>
                      <div className="lib-item-field">
                        <span className="lib-item-field-label">{t('lib.trash.col.time')}</span>
                        <span className="lib-item-field-value lib-trash-time">
                          {dayjs(entry.deletedAt).format('YYYY-MM-DD HH:mm')}
                        </span>
                      </div>
                    </div>
                    {rowActions(entry)}
                  </Card>
                ))}
              </div>
            ) : (
              <div className="lib-card">
                <div className="lib-table-scroll">
                  <table className="lib-table" role="grid" aria-label={t('lib.trash.title')}>
                    <colgroup>
                      <col style={{ width: 120 }} />
                      <col style={{ width: 'auto' }} />
                      <col style={{ width: 160 }} />
                      <col style={{ width: 168 }} />
                      <col style={{ width: 132 }} />
                      <col style={{ width: 200 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col">{t('lib.trash.col.type')}</th>
                        <th scope="col">{t('lib.trash.col.name')}</th>
                        <th scope="col">{t('lib.trash.col.library')}</th>
                        <th scope="col">{t('lib.trash.col.time')}</th>
                        <th scope="col">{t('lib.trash.col.remaining')}</th>
                        <th scope="col" aria-hidden />
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((entry) => (
                        <tr key={`${entry.kind}-${entry.record.id}`} className="lib-row">
                          <td className="lib-td">{kindBadge(entry.kind)}</td>
                          <td className="lib-td">
                            <Text weight="semibold" className="lib-trash-name" title={entryText(entry)}>
                              {entryText(entry)}
                            </Text>
                          </td>
                          <td className="lib-td">
                            <Text size={200}>
                              {entry.kind === 'item' ? entry.libraryName || t('lib.trash.orphanLib') : '—'}
                            </Text>
                          </td>
                          <td className="lib-td">
                            <span className="lib-trash-time">{dayjs(entry.deletedAt).format('YYYY-MM-DD HH:mm')}</span>
                          </td>
                          <td className="lib-td">{daysBadge(entry.deletedAt)}</td>
                          <td className="lib-td">{rowActions(entry)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="lib-statusbar">
                  <div className="lib-status-group">
                    <span className="lib-status-strong">{lt('status.total', { n: trash.length })}</span>
                  </div>
                  <span className="lib-status-spacer" />
                  <LibPager page={clampedPage} pageCount={pageCount} onChange={setPage} />
                </div>
              </div>
            )}
            {isMobile && pageCount > 1 && (
              <div className="lib-cards-pager">
                <LibPager page={clampedPage} pageCount={pageCount} onChange={setPage} compact />
              </div>
            )}
          </div>
        )}
      </div>

      <LibConfirm
        open={purgeTarget !== null}
        title={lt('trash.purgeTitle')}
        body={lt('trash.purgeBody')}
        confirmText={lt('trash.purge')}
        danger
        confirming={purging}
        onConfirm={handlePurge}
        onClose={() => {
          if (!purging) setPurgeTarget(null)
        }}
      />
    </div>
  )
}
