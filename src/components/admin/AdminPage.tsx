/**
 * 管理后台 · v3『石墨信号』（内部工具，密度优先）
 *
 * 版式：页头 + 3 张统计白卡（24/600 tabular）+ 顶部筛选条（36 高）+ 紧凑表格（行 32，白卡容器）
 * + `.status-pill` 状态片 + 危险操作红色。所有颜色走 v3 token，暗色自动反相。
 * 功能与 v2 完全一致：账户/审计双视图、筛选、搜索、CSV、刷新、重置密码（生成/复制）、
 * 停用/恢复/删除、近 7 天行为、说明——一个都没删。
 */
import { useEffect, useState, useCallback } from 'react'
import { Segmented, Table, Button, Input, Modal, App, Popconfirm } from 'antd'
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
} from '@ant-design/icons'
import dayjs from 'dayjs'
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

/** 状态片：6px 圆点 + 12/500 文字（.status-pill 变体） */
function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const cls =
    tone === 'success'
      ? 'status-pill is-success'
      : tone === 'warning'
        ? 'status-pill is-warning'
        : tone === 'danger'
          ? 'status-pill is-danger'
          : tone === 'accent'
            ? 'status-pill is-accent'
            : 'status-pill'
  return <span className={cls}>{children}</span>
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
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-canvas)',
          padding: 16,
        }}
      >
        <div className="surface-card" style={{ width: '100%', maxWidth: 380, padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span className="app-brand-dot" aria-hidden />
            <span style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--ink)' }}>
              {t('admin.title')}
            </span>
          </div>
          <p className="muted" style={{ fontSize: 'var(--text-xs)', margin: '0 0 16px', lineHeight: 1.5 }}>
            {t('admin.consoleHint')}
          </p>
          <Input.Password
            placeholder={t('auth.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onPressEnter={handleLogin}
            autoFocus
            style={{ height: 40, borderRadius: 'var(--r-2)', marginBottom: 12 }}
          />
          <Button
            type="primary"
            block
            loading={loginLoading}
            onClick={handleLogin}
            icon={<KeyOutlined />}
            style={{ height: 40 }}
          >
            {t('admin.loginBtn')}
          </Button>
        </div>
      </div>
    )
  }

  const DAY = 86400000
  const now = Date.now()
  const activeCount = accounts.filter((a) => !a.disabled).length
  const registeredToday = accounts.filter((a) => now - (a.createdAt ?? 0) < DAY).length

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
        <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{v}</span>
      ),
    },
    {
      title: t('admin.col.contact'),
      dataIndex: 'contact',
      key: 'contact',
      render: (v: string | null) =>
        v ? (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>{v}</span>
        ) : (
          <span className="faint">—</span>
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
          <span className="mono" style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-muted)' }}>
            {dayjs(v).format('YYYY-MM-DD')}
          </span>
        ) : (
          '—'
        ),
    },
    {
      title: t('admin.col.actions'),
      key: 'ops',
      width: 280,
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 2, flexWrap: 'nowrap' }} title={t('admin.col.actions')}>
          <Button type="link" size="small" icon={<SafetyCertificateOutlined />} onClick={() => openReset(r)}>
            {t('admin.op.resetPwd')}
          </Button>
          {r.disabled ? (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleOp(r.id, { op: 'enable' }, t('admin.enabled', { name: r.username }))}
            >
              {t('admin.op.enable')}
            </Button>
          ) : (
            <Popconfirm
              title={t('admin.disableConfirm.title', { name: r.username })}
              description={t('admin.disableConfirm.body')}
              onConfirm={() => handleOp(r.id, { op: 'disable' }, t('admin.disabled', { name: r.username }))}
            >
              <Button type="link" size="small" icon={<StopOutlined />}>
                {t('admin.op.disable')}
              </Button>
            </Popconfirm>
          )}
          <Popconfirm
            title={t('admin.deleteConfirm.title', { name: r.username })}
            description={t('admin.deleteConfirm.body')}
            okButtonProps={{ danger: true }}
            onConfirm={() => handleOp(r.id, { op: 'delete' }, t('admin.deleted', { name: r.username }))}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              {t('admin.op.delete')}
            </Button>
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
      render: (v: number) => (
        <span className="mono" style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-muted)' }}>
          {dayjs(v).format('YYYY-MM-DD HH:mm')}
        </span>
      ),
    },
    {
      title: t('admin.col.action'),
      dataIndex: 'action',
      key: 'a',
      width: 120,
      render: (v: string) => (
        <span className="mono" style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink)' }}>
          {v}
        </span>
      ),
    },
    { title: t('admin.col.target'), dataIndex: 'target', key: 'target', width: 160 },
    {
      title: t('admin.col.detail'),
      dataIndex: 'detail',
      key: 'd',
      render: (v: string) => (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>{v || '—'}</span>
      ),
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 130,
      render: (v: string) => (
        <span className="mono" style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-faint)' }}>
          {v}
        </span>
      ),
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', padding: '24px 32px 48px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* 页头 */}
        <header className="page-head">
          <div className="page-head-main">
            <h1 className="page-title">{t('admin.title')}</h1>
            <p className="page-lede">{t('admin.consoleHint')}</p>
          </div>
          <div className="page-head-actions">
            <Button icon={<DownloadOutlined />} onClick={exportCsv}>
              {t('admin.export')}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loadingList}>
              {t('admin.refresh')}
            </Button>
          </div>
        </header>

        {/* 3 张统计白卡：主数字 + 12px 标签 + 次要行 */}
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginBottom: 20 }}>
          <div className="kpi-card">
            <div className="kpi-label">{t('admin.stat.total')}</div>
            <div className="kpi-value">{stats?.totalAccounts ?? accounts.length}</div>
            <div className="kpi-delta">
              {t('admin.stat.active')} {activeCount}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">{t('admin.stat.today')}</div>
            <div className="kpi-value">{registeredToday}</div>
            <div className="kpi-delta">
              {t('admin.stat.signups7')} {stats?.signups7 ?? 0}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">{t('admin.stat.active7')}</div>
            <div className="kpi-value">{stats?.activeUsers7 ?? 0}</div>
            <div className="kpi-delta">
              {t('admin.stat.disabled')} {stats?.disabledAccounts ?? 0}
            </div>
          </div>
        </div>

        {/* 筛选条（36 高）：视图切换 + 筛选 + 搜索 */}
        <div
          className="toolbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            minHeight: 36,
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 16 }}>
            {(['accounts', 'audit'] as const).map((k) => {
              const active = tab === k
              const label = k === 'accounts' ? t('admin.tab.accounts') : t('admin.tab.audit')
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  style={{
                    background: 'none',
                    border: 'none',
                    font: 'inherit',
                    padding: '0 0 6px',
                    marginBottom: -1,
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                    fontWeight: active ? 600 : 400,
                    color: active ? 'var(--ink)' : 'var(--ink-muted)',
                    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {tab === 'accounts' && (
            <>
              <Segmented
                size="small"
                value={filterKey}
                onChange={(v) => setFilterKey(v as typeof filterKey)}
                options={[
                  { label: t('admin.filter.all'), value: 'all' },
                  { label: t('admin.filter.active'), value: 'active' },
                  { label: t('admin.filter.inactive'), value: 'inactive' },
                  { label: t('admin.filter.disabled'), value: 'disabled' },
                ]}
              />
              <Input.Search
                allowClear
                placeholder={t('admin.searchPlaceholder')}
                style={{ width: 220 }}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <span className="mono" style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-faint)' }}>
                {t('admin.count', { n: shown.length })}
              </span>
            </>
          )}
        </div>

        {tab === 'accounts' ? (
          <div className="data-table">
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
          <div className="data-table">
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

        {/* 近 7 天行为 + 说明：一行文字，不做卡片 */}
        {stats && stats.events7.length > 0 && (
          <div style={{ marginTop: 20, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span className="eyebrow">{t('admin.events.title')}</span>
            {stats.events7.map((e) => (
              <span key={e.name} className="mono" style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-muted)' }}>
                {e.name} {e.count}
              </span>
            ))}
          </div>
        )}

        <p className="faint" style={{ fontSize: 'var(--text-xs)', lineHeight: 1.7, marginTop: 24, maxWidth: 720 }}>
          <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{t('admin.tips.title')}</span>
          {' · '}
          {t('admin.tips.body')}
        </p>
      </div>

      {/* 重置密码 */}
      <Modal
        open={!!resetFor}
        title={t('admin.reset.title', { name: resetFor?.username ?? '' })}
        onCancel={() => setResetFor(null)}
        footer={
          resetDone ? (
            <Button type="primary" onClick={() => setResetFor(null)}>
              {t('common.close')}
            </Button>
          ) : (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button onClick={() => setResetFor(null)}>{t('common.cancel')}</Button>
              <Button type="primary" loading={resetting} onClick={submitReset}>
                {t('admin.reset.submit')}
              </Button>
            </div>
          )
        }
      >
        {resetDone ? (
          <>
            <div
              style={{
                background: 'var(--warning-wash)',
                border: '1px solid var(--warning)',
                borderRadius: 'var(--r-2)',
                padding: '8px 12px',
                marginBottom: 16,
                fontSize: 'var(--text-xs)',
                lineHeight: 1.5,
                color: 'var(--warning)',
              }}
            >
              {t('admin.reset.onceWarn')}
            </div>
            <div className="surface-sunken" style={{ padding: 12, marginBottom: 12 }}>
              <div className="faint" style={{ fontSize: 'var(--text-2xs)', marginBottom: 4 }}>
                {resetDone.username}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="mono" style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--ink)' }}>
                  {resetDone.password}
                </span>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => copyText(resetDone.password, t('admin.reset.copied'))}
                >
                  {t('common.copy')}
                </Button>
              </div>
            </div>
            <p className="faint" style={{ fontSize: 'var(--text-xs)', margin: 0, lineHeight: 1.6 }}>
              {t('admin.reset.afterHint')}
            </p>
          </>
        ) : (
          <>
            <p className="muted" style={{ fontSize: 'var(--text-sm)', marginTop: 0, lineHeight: 1.6 }}>
              {t('admin.reset.body')}
            </p>
            <Input.Password
              placeholder={t('admin.reset.placeholder')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              maxLength={200}
              style={{ height: 40, borderRadius: 'var(--r-2)' }}
            />
            <p className="faint" style={{ fontSize: 'var(--text-xs)', margin: '8px 0 0', lineHeight: 1.6 }}>
              {t('admin.reset.blankHint')}
            </p>
          </>
        )}
      </Modal>
    </div>
  )
}
