/**
 * 管理后台 · v10 Fluent UI 2（Windows 11 应用页面，无桌面/壁纸/窗口 chrome）
 *
 * 登录 = 居中 Fluent Card（Field/Input/Button）；控制台 = 页头 Text + 事实 Card 区
 * + TabList/Dropdown/SearchBox 筛选 + 账户表格（行内 Fluent Button/Badge）+ 危险操作 Fluent Dialog。
 * 功能与旧版完全一致：账户/审计双视图、筛选、搜索、CSV、刷新、重置密码（生成/复制）、
 * 停用/恢复/删除、近 7 天行为、说明——一个都没删。
 */
import { useEffect, useState, useCallback } from 'react'
import { App, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  SearchBox,
  Spinner,
  Tab,
  TabList,
  Text,
} from '@fluentui/react-components'
import {
  ArrowDownloadRegular,
  ArrowLeftRegular,
  ArrowSyncRegular,
  CheckmarkCircleRegular,
  CopyRegular,
  DeleteRegular,
  KeyRegular,
  LockClosedRegular,
  ProhibitedRegular,
  ShieldCheckmarkRegular,
  WarningRegular,
} from '@fluentui/react-icons'
import dayjs from 'dayjs'
import AppIcon from '@/components/common/AppIcon'
import { useI18n } from '@/i18n'
import {
  adminLogin,
  adminListAccounts,
  adminAccountOp,
  adminListAudit,
  adminGetStats,
  getAdminToken,
  type AdminAccountRow,
  type AuditEntry,
  type OpsStats,
} from '@/lib/serverApi'

import { useBackButtonLayer } from '@/utils/backButton'
import { downloadBlob } from '@/utils/csv'

type FilterKey = 'all' | 'active' | 'inactive' | 'disabled'

type StatusTone = 'success' | 'warning' | 'danger' | 'brand' | 'subtle'

/** 账户状态：Fluent Badge（tint 语义色） */
function StatusBadge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return (
    <Badge appearance="tint" color={tone} size="medium">
      {children}
    </Badge>
  )
}

export default function AdminPage() {
  const { message } = App.useApp()
  const t = useI18n()
  const [logged, setLogged] = useState(!!getAdminToken())
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [accounts, setAccounts] = useState<AdminAccountRow[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [stats, setStats] = useState<OpsStats | null>(null)
  const [filterKey, setFilterKey] = useState<FilterKey>('all')
  const [keyword, setKeyword] = useState('')
  const [tab, setTab] = useState<'accounts' | 'audit'>('accounts')

  // 重置密码
  const [resetFor, setResetFor] = useState<AdminAccountRow | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState<{ username: string; password: string } | null>(null)
  // 危险操作确认（停用/删除）
  const [dangerOp, setDangerOp] = useState<{ row: AdminAccountRow; kind: 'disable' | 'delete' } | null>(null)

  const load = useCallback(async () => {
    setLoadingList(true)
    // 审计与概览独立容错：未执行迁移的旧部署没有该表时静默降级
    adminListAudit()
      .then(setLogs)
      .catch(() => setLogs([]))
    adminGetStats()
      .then(setStats)
      .catch(() => setStats(null))
    try {
      setAccounts(await adminListAccounts())
    } catch (e) {
      message.error((e as Error).message)
      if ((e as Error).message.includes('登录')) setLogged(false)
    } finally {
      setLoadingList(false)
    }
  }, [message])

  useEffect(() => {
    if (logged) load()
  }, [logged, load])

  // 必须在 `if (!logged) return` 之前调用：否则登录成功后 Hook 数量变化会白屏
  useBackButtonLayer(!!resetFor || !!dangerOp, () => {
    setResetFor(null)
    setDangerOp(null)
  })

  const handleLogin = async () => {
    if (!password) return
    setLoginLoading(true)
    try {
      await adminLogin(password)
      setLogged(true)
      setPassword('')
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoginLoading(false)
    }
  }

  const handleOp = async (
    accountId: string,
    payload: Parameters<typeof adminAccountOp>[1],
    tip: string,
  ): Promise<boolean> => {
    try {
      await adminAccountOp(accountId, payload)
      message.success(tip)
      load()
      return true
    } catch (e) {
      message.error((e as Error).message)
      return false
    }
  }

  const openReset = (row: AdminAccountRow) => {
    setResetFor(row)
    setNewPassword('')
    setResetDone(null)
  }

  const submitReset = async () => {
    if (!resetFor) return
    setResetting(true)
    try {
      const r = await adminAccountOp(resetFor.id, {
        op: 'resetPassword',
        ...(newPassword.trim() ? { newPassword: newPassword.trim() } : {}),
      })
      setResetDone({ username: resetFor.username, password: r.password || newPassword.trim() })
      setNewPassword('')
      load()
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setResetting(false)
    }
  }

  const copyText = (text: string, tip: string) => {
    navigator.clipboard.writeText(text)
    message.success(tip)
  }

  const appbar = (
    <header className="w-admin-appbar">
      <span className="w-admin-appbar-brand">
        <AppIcon size={20} />
        <Text size={300} weight="semibold" className="w-admin-appbar-title">
          {t('admin.title')}
        </Text>
      </span>
      <span className="w-admin-appbar-spacer" />
      <Button as="a" href="/" appearance="subtle" icon={<ArrowLeftRegular />}>
        {t('app.home')}
      </Button>
    </header>
  )

  if (!logged) {
    return (
      <div className="w-admin-app">
        {appbar}
        <main className="w-admin-scroll">
          <div className="w-admin-login-wrap">
            <Card appearance="filled" className="w-admin-card">
              <span className="w-admin-card-icon" aria-hidden>
                <AppIcon size={28} />
              </span>
              <Text as="h1" size={600} weight="semibold" className="w-admin-card-title">
                {t('admin.title')}
              </Text>
              <Text size={300} className="w-muted">
                {t('admin.consoleHint')}
              </Text>
              <Field label={t('auth.password')}>
                <Input
                  type="password"
                  value={password}
                  onChange={(_, data) => setPassword(data.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleLogin()
                  }}
                  autoFocus
                />
              </Field>
              <Button
                appearance="primary"
                icon={loginLoading ? <Spinner size="tiny" /> : <KeyRegular />}
                disabled={loginLoading}
                onClick={() => void handleLogin()}
              >
                {t('admin.loginBtn')}
              </Button>
              <Text size={200} className="w-muted">
                <LockClosedRegular /> {t('w11.status.local')}
              </Text>
            </Card>
          </div>
        </main>
      </div>
    )
  }

  const DAY = 86400000
  const now = Date.now()
  const activeCount = accounts.filter((a) => !a.disabled).length
  const registeredToday = accounts.filter((a) => now - (a.createdAt ?? 0) < DAY).length
  const inactiveCount = accounts.filter(
    (a) => !a.disabled && now - (a.lastLogin ?? a.createdAt ?? 0) > 30 * DAY,
  ).length
  const disabledCount = stats?.disabledAccounts ?? accounts.filter((a) => a.disabled).length
  const totalAccounts = stats?.totalAccounts ?? accounts.length

  const filtered = accounts.filter((a) => {
    if (filterKey === 'disabled' && !a.disabled) return false
    if (filterKey === 'active') {
      if (a.disabled) return false
      return now - (a.lastLogin ?? a.createdAt ?? 0) <= 7 * DAY
    }
    if (filterKey === 'inactive') {
      if (a.disabled) return false
      return now - (a.lastLogin ?? a.createdAt ?? 0) > 30 * DAY
    }
    return true
  })
  const kw = keyword.trim().toLowerCase()
  const shown = kw
    ? filtered.filter(
        (a) =>
          a.username.toLowerCase().includes(kw) || (a.contact ?? '').toLowerCase().includes(kw),
      )
    : filtered

  function lastSeen(row: AdminAccountRow) {
    if (row.disabled) return <StatusBadge tone="subtle">{t('admin.status.disabled')}</StatusBadge>
    const at = row.lastLogin ?? row.createdAt ?? 0
    const days = Math.floor((now - at) / DAY)
    const label = days <= 0 ? t('admin.seen.today') : t('admin.seen.days', { n: days })
    if (days <= 7) return <StatusBadge tone="success">{label}</StatusBadge>
    if (days <= 30) return <StatusBadge tone="warning">{label}</StatusBadge>
    return <StatusBadge tone="subtle">{label}</StatusBadge>
  }

  function exportCsv() {
    const head = ['username', 'contact', 'status', 'created', 'lastLogin']
    const lines = [head.join(',')]
    for (const a of accounts) {
      const cells = [
        a.username,
        a.contact ?? '',
        a.disabled ? 'disabled' : 'active',
        a.createdAt ? dayjs(a.createdAt).format('YYYY-MM-DD HH:mm') : '',
        a.lastLogin ? dayjs(a.lastLogin).format('YYYY-MM-DD HH:mm') : '',
      ].map((v) => {
        const s = String(v)
        // 防 CSV 公式注入 + 逗号/引号转义
        const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
        return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
      })
      lines.push(cells.join(','))
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    // 公共下载工具：a 必须先入文档、revoke 必须延后（Firefox / 安卓 WebView 曾有「点了没反应」）
    downloadBlob(`accounts-${dayjs().format('YYYYMMDD')}.csv`, blob)
  }

  const accountColumns: ColumnsType<AdminAccountRow> = [
    {
      title: t('admin.col.username'),
      dataIndex: 'username',
      key: 'username',
      render: (v: string) => (
        <span className="w-admin-user">
          <Avatar size={28} name={v} initials={(v || '?').slice(0, 1).toUpperCase()} color="colorful" aria-hidden />
          <span className="w-admin-user-name">{v}</span>
        </span>
      ),
    },
    {
      title: t('admin.col.contact'),
      dataIndex: 'contact',
      key: 'contact',
      render: (v: string | null) =>
        v ? (
          <Text size={200} className="w-admin-cell-soft">
            {v}
          </Text>
        ) : (
          <Text size={200} className="w-admin-cell-faint">
            —
          </Text>
        ),
    },
    {
      title: t('admin.col.status'),
      key: 'status',
      width: 132,
      render: (_, r) => lastSeen(r),
    },
    {
      title: t('admin.col.registered'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (v?: number) =>
        v ? (
          <Text size={200} className="w-admin-cell-date">
            {dayjs(v).format('YYYY-MM-DD')}
          </Text>
        ) : (
          '—'
        ),
    },
    {
      title: t('admin.col.actions'),
      key: 'ops',
      width: 300,
      render: (_, r) => (
        <div className="w-admin-ops">
          <Button size="small" appearance="subtle" icon={<ShieldCheckmarkRegular />} onClick={() => openReset(r)}>
            {t('admin.op.resetPwd')}
          </Button>
          {r.disabled ? (
            <Button
              size="small"
              appearance="subtle"
              icon={<CheckmarkCircleRegular />}
              onClick={() => void handleOp(r.id, { op: 'enable' }, t('admin.enabled', { name: r.username }))}
            >
              {t('admin.op.enable')}
            </Button>
          ) : (
            <Button
              size="small"
              appearance="subtle"
              icon={<ProhibitedRegular />}
              onClick={() => setDangerOp({ row: r, kind: 'disable' })}
            >
              {t('admin.op.disable')}
            </Button>
          )}
          <Button
            size="small"
            appearance="subtle"
            className="w-danger-action"
            icon={<DeleteRegular />}
            onClick={() => setDangerOp({ row: r, kind: 'delete' })}
          >
            {t('admin.op.delete')}
          </Button>
        </div>
      ),
    },
  ]

  const auditColumns: ColumnsType<AuditEntry> = [
    {
      title: t('admin.col.time'),
      dataIndex: 'created_at',
      key: 't',
      width: 140,
      render: (v: number) => (
        <Text size={200} className="w-admin-cell-date">
          {dayjs(v).format('YYYY-MM-DD HH:mm')}
        </Text>
      ),
    },
    {
      title: t('admin.col.action'),
      dataIndex: 'action',
      key: 'a',
      width: 140,
      render: (v: string) => (
        <Text size={200} className="w-admin-cell-date">
          {v}
        </Text>
      ),
    },
    { title: t('admin.col.target'), dataIndex: 'target', key: 'target', width: 160 },
    {
      title: t('admin.col.detail'),
      dataIndex: 'detail',
      key: 'd',
      render: (v: string) => (
        <Text size={200} className="w-admin-cell-soft">
          {v || '—'}
        </Text>
      ),
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 130,
      render: (v: string) => (
        <Text size={200} className="w-admin-cell-date">
          {v}
        </Text>
      ),
    },
  ]

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t('admin.filter.all') },
    { key: 'active', label: t('admin.filter.active') },
    { key: 'inactive', label: t('admin.filter.inactive', { n: inactiveCount }) },
    { key: 'disabled', label: t('admin.filter.disabled') },
  ]
  const filterLabel = filters.find((f) => f.key === filterKey)?.label ?? t('admin.filter.all')

  const dangerTitle = dangerOp
    ? dangerOp.kind === 'delete'
      ? t('admin.deleteConfirm.title', { name: dangerOp.row.username })
      : t('admin.disableConfirm.title', { name: dangerOp.row.username })
    : ''
  const dangerBody = dangerOp
    ? dangerOp.kind === 'delete'
      ? t('admin.deleteConfirm.body')
      : t('admin.disableConfirm.body')
    : ''

  return (
    <div className="w-admin-app">
      {appbar}
      <main className="w-admin-scroll">
        <div className="w-page w-admin-page">
          <header className="w-page-head">
            <div className="w-head-main">
              <Text as="h1" size={700} weight="semibold" className="w-set-page-title">
                {t('admin.title')}
              </Text>
              <Text size={300} className="w-muted">
                {t('admin.consoleHint')}
              </Text>
            </div>
            <div className="w-actions">
              <Button icon={<ArrowDownloadRegular />} onClick={exportCsv}>
                {t('admin.export')}
              </Button>
              <Button
                icon={loadingList ? <Spinner size="tiny" /> : <ArrowSyncRegular />}
                disabled={loadingList}
                onClick={() => void load()}
              >
                {t('admin.refresh')}
              </Button>
            </div>
          </header>

          {/* 事实 Card 区：四张 Fluent Card（不做网页 KPI 大卡） */}
          <div className="w-admin-facts">
            <Card appearance="filled" className="w-admin-fact">
              <Text size={200} className="w-admin-fact-label">
                {t('admin.stat.total')}
              </Text>
              <Text size={600} weight="semibold" className="w-admin-fact-value">
                {totalAccounts}
              </Text>
              <Text size={200} className="w-admin-fact-note">
                {t('admin.stat.active')} {activeCount} · {t('admin.stat.disabled')} {disabledCount}
              </Text>
            </Card>
            <Card appearance="filled" className="w-admin-fact">
              <Text size={200} className="w-admin-fact-label">
                {t('admin.stat.active')}
              </Text>
              <Text size={600} weight="semibold" className="w-admin-fact-value">
                {activeCount}
              </Text>
              <Text size={200} className="w-admin-fact-note">
                {t('admin.stat.disabled')} {disabledCount}
              </Text>
            </Card>
            <Card appearance="filled" className="w-admin-fact">
              <Text size={200} className="w-admin-fact-label">
                {t('admin.stat.today')}
              </Text>
              <Text size={600} weight="semibold" className="w-admin-fact-value">
                {registeredToday}
              </Text>
              <Text size={200} className="w-admin-fact-note">
                {t('admin.stat.signups7')} {stats?.signups7 ?? 0}
              </Text>
            </Card>
            <Card appearance="filled" className="w-admin-fact">
              <Text size={200} className="w-admin-fact-label">
                {t('admin.stat.active7')}
              </Text>
              <Text size={600} weight="semibold" className="w-admin-fact-value">
                {stats?.activeUsers7 ?? 0}
              </Text>
              <Text size={200} className="w-admin-fact-note">
                {t('admin.events.title')}
              </Text>
            </Card>
          </div>

          {/* 筛选条：Fluent TabList + Dropdown + SearchBox */}
          <div className="w-admin-toolbar">
            <TabList selectedValue={tab} onTabSelect={(_, data) => setTab(data.value as 'accounts' | 'audit')}>
              <Tab value="accounts">{t('admin.tab.accounts')}</Tab>
              <Tab value="audit">{t('admin.tab.audit')}</Tab>
            </TabList>

            {tab === 'accounts' && (
              <>
                <Dropdown
                  className="w-admin-filter"
                  value={filterLabel}
                  selectedOptions={[filterKey]}
                  onOptionSelect={(_, data) => {
                    if (data.optionValue) setFilterKey(data.optionValue as FilterKey)
                  }}
                  aria-label={t('admin.filter.all')}
                >
                  {filters.map((f) => (
                    <Option key={f.key} value={f.key}>
                      {f.label}
                    </Option>
                  ))}
                </Dropdown>
                <SearchBox
                  className="w-admin-search"
                  value={keyword}
                  onChange={(_, data) => setKeyword(data.value)}
                  placeholder={t('admin.searchPlaceholder')}
                />
                <Text size={200} className="w-admin-count">
                  {t('admin.count', { n: shown.length })}
                </Text>
              </>
            )}
          </div>

          {tab === 'accounts' ? (
            <div className="w-admin-table">
              <Table
                rowKey="id"
                size="small"
                columns={accountColumns}
                dataSource={shown}
                loading={loadingList}
                pagination={{ pageSize: 20, showSizeChanger: false }}
                scroll={{ x: 'max-content' }}
              />
            </div>
          ) : (
            <div className="w-admin-table">
              <Table
                rowKey={(r) => `${r.created_at}-${r.action}-${r.target}`}
                size="small"
                columns={auditColumns}
                dataSource={logs}
                pagination={{ pageSize: 20, showSizeChanger: false }}
                scroll={{ x: 'max-content' }}
              />
            </div>
          )}

          {/* 近 7 天行为：一行事实文字，不做卡片 */}
          {stats && stats.events7.length > 0 && (
            <div className="w-admin-events">
              <span className="w-admin-events-title">{t('admin.events.title')}</span>
              {stats.events7.map((e) => (
                <span key={e.name} className="w-admin-event">
                  {e.name}
                  <b>{e.count}</b>
                </span>
              ))}
            </div>
          )}

          <p className="w-admin-tips">
            <strong>{t('admin.tips.title')}</strong>
            {' · '}
            {t('admin.tips.body')}
          </p>
        </div>
      </main>

      {/* 重置密码（Fluent Dialog） */}
      <Dialog open={!!resetFor} onOpenChange={(_, data) => !data.open && setResetFor(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t('admin.reset.title', { name: resetFor?.username ?? '' })}</DialogTitle>
            <DialogContent>
              {resetDone ? (
                <div className="w-admin-dialog-content">
                  <MessageBar intent="warning">
                    <MessageBarBody>{t('admin.reset.onceWarn')}</MessageBarBody>
                  </MessageBar>
                  <div className="w-admin-secret">
                    <div className="w-admin-secret-main">
                      <div className="w-admin-secret-name">{resetDone.username}</div>
                      <div className="w-admin-secret-value">{resetDone.password}</div>
                    </div>
                    <Button
                      size="small"
                      icon={<CopyRegular />}
                      onClick={() => copyText(resetDone.password, t('admin.reset.copied'))}
                    >
                      {t('common.copy')}
                    </Button>
                  </div>
                  <Text size={200} className="w-muted">
                    {t('admin.reset.afterHint')}
                  </Text>
                </div>
              ) : (
                <div className="w-admin-dialog-content">
                  <Text size={300} className="w-muted">
                    {t('admin.reset.body')}
                  </Text>
                  <Field label={t('admin.reset.placeholder')}>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(_, data) => setNewPassword(data.value)}
                      maxLength={200}
                    />
                  </Field>
                  <Text size={200} className="w-muted">
                    {t('admin.reset.blankHint')}
                  </Text>
                </div>
              )}
            </DialogContent>
            <DialogActions>
              {resetDone ? (
                <Button appearance="primary" onClick={() => setResetFor(null)}>
                  {t('common.close')}
                </Button>
              ) : (
                <>
                  <Button onClick={() => setResetFor(null)}>{t('common.cancel')}</Button>
                  <Button
                    appearance="primary"
                    disabled={resetting}
                    icon={resetting ? <Spinner size="tiny" /> : undefined}
                    onClick={() => void submitReset()}
                  >
                    {t('admin.reset.submit')}
                  </Button>
                </>
              )}
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* 停用 / 删除（Fluent Dialog 危险操作确认） */}
      <Dialog open={!!dangerOp} onOpenChange={(_, data) => !data.open && setDangerOp(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>
              <span className="w-admin-dialog-note">
                <WarningRegular />
                {dangerTitle}
              </span>
            </DialogTitle>
            <DialogContent>
              <Text size={300} className="w-muted">
                {dangerBody}
              </Text>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDangerOp(null)}>{t('common.cancel')}</Button>
              <Button
                appearance="primary"
                className={dangerOp?.kind === 'delete' ? 'w-admin-delete-confirm' : undefined}
                onClick={() => {
                  if (!dangerOp) return
                  const { row, kind } = dangerOp
                  setDangerOp(null)
                  void handleOp(
                    row.id,
                    kind === 'delete' ? { op: 'delete' } : { op: 'disable' },
                    kind === 'delete'
                      ? t('admin.deleted', { name: row.username })
                      : t('admin.disabled', { name: row.username }),
                  )
                }}
              >
                {dangerOp?.kind === 'delete' ? t('admin.op.delete') : t('admin.op.disable')}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  )
}
