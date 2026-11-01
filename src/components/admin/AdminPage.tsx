/**
 * 管理后台 · v9 Windows 11 原生
 *
 * 登录 = 桌面壁纸上的居中 Acrylic 小窗（独立于 AppShell，自带桌面舞台）；
 * 控制台 = Win11 无边框窗口：标题栏 + 页头 + 事实条（账户数/启用/今日注册/7 天活跃）
 *          + Pivot 视图切换 / 筛选 / 搜索 + 行高 48 的账户设置式表格 + 危险色行操作。
 *
 * 功能与旧版完全一致：账户/审计双视图、筛选、搜索、CSV、刷新、重置密码（生成/复制）、
 * 停用/恢复/删除、近 7 天行为、说明——一个都没删。
 */
import { useEffect, useState, useCallback } from 'react'
import { Table, Button, Modal, App, Popconfirm } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  KeyOutlined,
  ReloadOutlined,
  StopOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  CopyOutlined,
  DownloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SafetyOutlined,
  WarningOutlined,
  ArrowLeftOutlined,
} from '@/components/common/icons'
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

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'accent'

/** Win11 状态标签：中性胶囊 tag + 6px 语义点 */
function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const cls =
    tone === 'success'
      ? 'w-tag w-tag--success'
      : tone === 'warning'
        ? 'w-tag w-tag--warning'
        : tone === 'danger'
          ? 'w-tag w-tag--danger'
          : tone === 'accent'
            ? 'w-tag w-tag--accent'
            : 'w-tag'
  const dot =
    tone === 'success'
      ? 'w-dot w-dot--success'
      : tone === 'warning'
        ? 'w-dot w-dot--warning'
        : tone === 'danger'
          ? 'w-dot w-dot--danger'
          : tone === 'accent'
            ? 'w-dot w-dot--accent'
            : 'w-dot'
  return (
    <span className={cls}>
      <span className={dot} aria-hidden />
      {children}
    </span>
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
  const [filterKey, setFilterKey] = useState<'all' | 'active' | 'disabled' | 'inactive'>('all')
  const [keyword, setKeyword] = useState('')
  const [tab, setTab] = useState<'accounts' | 'audit'>('accounts')

  // 重置密码
  const [resetFor, setResetFor] = useState<AdminAccountRow | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetDone, setResetDone] = useState<{ username: string; password: string } | null>(null)

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
  useBackButtonLayer(!!resetFor, () => setResetFor(null))

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

  if (!logged) {
    return (
      <div className="w-admin-stage">
        <div className="w-admin-login">
          <span className="w-admin-login-mark" aria-hidden>
            <AppIcon size={32} />
          </span>
          <h1 className="w-admin-login-title">{t('admin.title')}</h1>
          <p className="w-admin-login-desc">{t('admin.consoleHint')}</p>
          <label className="w-admin-login-field">
            <span className="w-label">{t('auth.password')}</span>
            <input
              type="password"
              className="w-input"
              placeholder={t('auth.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleLogin()
              }}
              autoFocus
            />
          </label>
          <Button
            type="primary"
            block
            size="large"
            loading={loginLoading}
            onClick={() => void handleLogin()}
            icon={<KeyOutlined />}
          >
            {t('admin.loginBtn')}
          </Button>
          <div className="w-admin-login-foot">
            <SafetyOutlined />
            <span>{t('w11.status.local')}</span>
          </div>
        </div>
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
    if (row.disabled) return <Pill tone="neutral">{t('admin.status.disabled')}</Pill>
    const at = row.lastLogin ?? row.createdAt ?? 0
    const days = Math.floor((now - at) / DAY)
    const label = days <= 0 ? t('admin.seen.today') : t('admin.seen.days', { n: days })
    if (days <= 7) return <Pill tone="success">{label}</Pill>
    if (days <= 30) return <Pill tone="warning">{label}</Pill>
    return <Pill tone="neutral">{label}</Pill>
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
          <span className="w-admin-user-avatar" aria-hidden>
            {(v || '?').slice(0, 1)}
          </span>
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
          <span className="w-admin-cell-soft">{v}</span>
        ) : (
          <span className="w-admin-cell-faint">—</span>
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
        v ? <span className="w-admin-cell-date">{dayjs(v).format('YYYY-MM-DD')}</span> : '—',
    },
    {
      title: t('admin.col.actions'),
      key: 'ops',
      width: 300,
      render: (_, r) => (
        <div className="w-admin-ops">
          <button
            type="button"
            className="w-btn w-btn--subtle w-btn--sm"
            onClick={() => openReset(r)}
          >
            <SafetyCertificateOutlined />
            {t('admin.op.resetPwd')}
          </button>
          {r.disabled ? (
            <button
              type="button"
              className="w-btn w-btn--subtle w-btn--sm"
              onClick={() => handleOp(r.id, { op: 'enable' }, t('admin.enabled', { name: r.username }))}
            >
              <CheckCircleOutlined />
              {t('admin.op.enable')}
            </button>
          ) : (
            <Popconfirm
              title={t('admin.disableConfirm.title', { name: r.username })}
              description={t('admin.disableConfirm.body')}
              onConfirm={() => handleOp(r.id, { op: 'disable' }, t('admin.disabled', { name: r.username }))}
            >
              <button type="button" className="w-btn w-btn--subtle w-btn--sm">
                <StopOutlined />
                {t('admin.op.disable')}
              </button>
            </Popconfirm>
          )}
          <Popconfirm
            title={t('admin.deleteConfirm.title', { name: r.username })}
            description={t('admin.deleteConfirm.body')}
            okButtonProps={{ danger: true }}
            onConfirm={() => handleOp(r.id, { op: 'delete' }, t('admin.deleted', { name: r.username }))}
          >
            <button type="button" className="w-btn w-btn--subtle w-btn--danger w-btn--sm">
              <DeleteOutlined />
              {t('admin.op.delete')}
            </button>
          </Popconfirm>
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
      render: (v: number) => <span className="w-admin-cell-date">{dayjs(v).format('YYYY-MM-DD HH:mm')}</span>,
    },
    {
      title: t('admin.col.action'),
      dataIndex: 'action',
      key: 'a',
      width: 140,
      render: (v: string) => <span className="w-admin-cell-date">{v}</span>,
    },
    { title: t('admin.col.target'), dataIndex: 'target', key: 'target', width: 160 },
    {
      title: t('admin.col.detail'),
      dataIndex: 'detail',
      key: 'd',
      render: (v: string) => <span className="w-admin-cell-soft">{v || '—'}</span>,
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 130,
      render: (v: string) => <span className="w-admin-cell-date">{v}</span>,
    },
  ]

  const filters: { key: typeof filterKey; label: string }[] = [
    { key: 'all', label: t('admin.filter.all') },
    { key: 'active', label: t('admin.filter.active') },
    { key: 'inactive', label: t('admin.filter.inactive', { n: inactiveCount }) },
    { key: 'disabled', label: t('admin.filter.disabled') },
  ]

  return (
    <div className="w-admin-window">
      <header className="w-admin-titlebar">
        <span className="w-admin-titlebar-brand">
          <AppIcon size={16} />
          <span>{t('admin.title')}</span>
        </span>
        <span className="w-admin-titlebar-spacer" />
        <a className="w-btn w-btn--subtle w-btn--sm" href="/">
          <ArrowLeftOutlined />
          {t('app.home')}
        </a>
      </header>

      <div className="w-admin-body">
        <div className="w-admin-scroll">
          <div className="w-admin-page">
            <header className="w-page-head">
              <div className="w-head-main">
                <h1 className="w-title">{t('admin.title')}</h1>
                <p className="w-desc">{t('admin.consoleHint')}</p>
              </div>
              <div className="w-actions">
                <Button icon={<DownloadOutlined />} onClick={exportCsv}>
                  {t('admin.export')}
                </Button>
                <Button icon={<ReloadOutlined />} onClick={load} loading={loadingList}>
                  {t('admin.refresh')}
                </Button>
              </div>
            </header>

            {/* 事实条：一个 CardFill 表面，而不是三张网页 KPI 卡 */}
            <div className="w-admin-facts">
              <div className="w-admin-fact">
                <span className="w-admin-fact-label">{t('admin.stat.total')}</span>
                <span className="w-admin-fact-value">{totalAccounts}</span>
                <span className="w-admin-fact-note">
                  {t('admin.stat.active')} {activeCount} · {t('admin.stat.disabled')} {disabledCount}
                </span>
              </div>
              <div className="w-admin-fact">
                <span className="w-admin-fact-label">{t('admin.stat.active')}</span>
                <span className="w-admin-fact-value">{activeCount}</span>
                <span className="w-admin-fact-note">
                  {t('admin.stat.disabled')} {disabledCount}
                </span>
              </div>
              <div className="w-admin-fact">
                <span className="w-admin-fact-label">{t('admin.stat.today')}</span>
                <span className="w-admin-fact-value">{registeredToday}</span>
                <span className="w-admin-fact-note">
                  {t('admin.stat.signups7')} {stats?.signups7 ?? 0}
                </span>
              </div>
              <div className="w-admin-fact">
                <span className="w-admin-fact-label">{t('admin.stat.active7')}</span>
                <span className="w-admin-fact-value">{stats?.activeUsers7 ?? 0}</span>
                <span className="w-admin-fact-note">{t('admin.events.title')}</span>
              </div>
            </div>

            {/* 筛选条：Pivot + Win11 分段筛选 + 搜索 + 计数 */}
            <div className="w-admin-toolbar">
              <div className="w-tabs" role="tablist">
                {(['accounts', 'audit'] as const).map((k) => {
                  const active = tab === k
                  const label = k === 'accounts' ? t('admin.tab.accounts') : t('admin.tab.audit')
                  return (
                    <button
                      key={k}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(k)}
                      className={`w-tab${active ? ' is-active' : ''}`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              {tab === 'accounts' && (
                <>
                  <div className="w-set-seg" role="group" aria-label={t('admin.filter.all')}>
                    {filters.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        aria-pressed={filterKey === f.key}
                        onClick={() => setFilterKey(f.key)}
                        className={`w-set-seg-item${filterKey === f.key ? ' is-active' : ''}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="w-search w-admin-search">
                    <SearchOutlined />
                    <input
                      className="w-search-input"
                      type="search"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder={t('admin.searchPlaceholder')}
                      aria-label={t('admin.searchPlaceholder')}
                    />
                  </div>
                  <span className="w-admin-count">{t('admin.count', { n: shown.length })}</span>
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
        </div>
      </div>

      {/* 重置密码（Win11 ContentDialog） */}
      <Modal
        open={!!resetFor}
        title={t('admin.reset.title', { name: resetFor?.username ?? '' })}
        onCancel={() => setResetFor(null)}
        width={440}
        footer={
          resetDone ? (
            <Button type="primary" onClick={() => setResetFor(null)}>
              {t('common.close')}
            </Button>
          ) : (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button onClick={() => setResetFor(null)}>{t('common.cancel')}</Button>
              <Button type="primary" loading={resetting} onClick={() => void submitReset()}>
                {t('admin.reset.submit')}
              </Button>
            </div>
          )
        }
      >
        {resetDone ? (
          <div className="w-admin-dialog-body">
            <div className="w-admin-dialog-note">
              <WarningOutlined />
              <span>{t('admin.reset.onceWarn')}</span>
            </div>
            <div className="w-admin-secret">
              <div style={{ minWidth: 0 }}>
                <div className="w-admin-secret-name">{resetDone.username}</div>
                <div className="w-admin-secret-value">{resetDone.password}</div>
              </div>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() => copyText(resetDone.password, t('admin.reset.copied'))}
              >
                {t('common.copy')}
              </Button>
            </div>
            <p style={{ margin: 0 }}>{t('admin.reset.afterHint')}</p>
          </div>
        ) : (
          <div className="w-admin-dialog-body">
            <p>{t('admin.reset.body')}</p>
            <label className="w-field">
              <span className="w-label">{t('admin.reset.placeholder')}</span>
              <input
                type="password"
                className="w-input"
                placeholder={t('admin.reset.placeholder')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                maxLength={200}
              />
            </label>
            <p className="w-hint" style={{ marginTop: 8, marginBottom: 0 }}>
              {t('admin.reset.blankHint')}
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
