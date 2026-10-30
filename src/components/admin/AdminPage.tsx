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
import SealMark from '@/components/public/SealMark'

/**
 * 管理后台：产品改为「自助注册 + 永久免费」后的运营面板（内部工具，密度优先）。
 *
 * 不再有卖卡/续费。这里的能力围绕另外三件事：
 *   1. 看清谁在用（注册量、活跃、行为分布）
 *   2. 处理异常（停用违规账户、删除垃圾账户）
 *   3. 帮用户找回入口（重置密码——用户自己设的密码，忘记后只能靠管理员）
 *
 * 版式：一行筛选 + 右上导出；统计是等宽数字条（不是 Statistic 卡片）；
 * 表格 28px 行、只有横线；状态是 11px mono 文本 + 6px 方点。
 * 所有颜色走 token（暗色下自动反相），不再在组件里写死色值。
 */

/** 6px 方点：状态只用一个方块 + 一个字，不用彩色胶囊 Tag */
function Dot({ tone }: { tone: 'ok' | 'warn' | 'off' }) {
  const color =
    tone === 'ok' ? 'var(--app-success)' : tone === 'warn' ? 'var(--app-warning)' : 'var(--app-ink-faint)'
  return (
    <span
      aria-hidden
      style={{ width: 6, height: 6, background: color, display: 'inline-block', marginRight: 6 }}
    />
  )
}

const MONO = { fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' } as const

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
    // 审计日志与概览独立容错：未执行迁移的旧部署没有该表时静默降级
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

  // 必须在 `if (!logged) return` 之前调用：否则管理员登录成功后
  // （logged 从 false 变 true）渲染中途多出一个 Hook，React 抛
  // 「Rendered more hooks than during the previous render」，
  // 整个管理后台变成错误页 —— 也就是「密码输对了反而进不去」。
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
          background: 'var(--app-canvas)',
        }}
      >
        <div style={{ width: '100%', maxWidth: 320, margin: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <SealMark />
            <span className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--app-ink)' }}>
              {t('admin.title')}
            </span>
          </div>
          <p className="muted" style={{ fontSize: 12.5, margin: '0 0 16px', lineHeight: 1.7 }}>
            {t('admin.consoleHint')}
          </p>
          <Input.Password
            placeholder={t('auth.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onPressEnter={handleLogin}
            autoFocus
            style={{ height: 32, borderRadius: 2, marginBottom: 12 }}
          />
          <Button type="primary" block loading={loginLoading} onClick={handleLogin} icon={<KeyOutlined />}>
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

  /** 状态：11px mono 文本 + 6px 方点（绿=近期活跃 / 赭=渐冷 / 灰=停用或久未用） */
  function lastSeen(row: AdminAccountRow) {
    if (row.disabled) {
      return (
        <span className="mono" style={{ fontSize: 11, color: 'var(--app-ink-faint)' }}>
          <Dot tone="off" />
          {t('admin.status.disabled')}
        </span>
      )
    }
    const at = row.lastLogin ?? row.createdAt ?? 0
    const days = Math.floor((now - at) / DAY)
    if (days <= 7) {
      return (
        <span className="mono" style={{ fontSize: 11, color: 'var(--app-ink-soft)' }}>
          <Dot tone="ok" />
          {days <= 0 ? t('admin.seen.today') : t('admin.seen.days', { n: days })}
        </span>
      )
    }
    if (days <= 30) {
      return (
        <span className="mono" style={{ fontSize: 11, color: 'var(--app-ink-soft)' }}>
          <Dot tone="warn" />
          {t('admin.seen.days', { n: days })}
        </span>
      )
    }
    return (
      <span className="mono" style={{ fontSize: 11, color: 'var(--app-ink-faint)' }}>
        <Dot tone="off" />
        {t('admin.seen.days', { n: days })}
      </span>
    )
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
    // 走公共下载工具：必须先把 a 挂到文档里再 click（Firefox 会忽略未插入 DOM 的
    // a 上的 click），且 revoke 不能同步执行（此刻浏览器可能还没开始取 blob）。
    // 原来这里自己写了一遍，两条都违反，Firefox / 安卓 WebView 上导出「点了没反应」。
    downloadBlob(`accounts-${dayjs().format('YYYYMMDD')}.csv`, blob)
  }

  const accountColumns: ColumnsType<AdminAccountRow> = [
    {
      title: t('admin.col.username'),
      dataIndex: 'username',
      key: 'username',
      render: (v: string) => <span style={{ fontWeight: 500, color: 'var(--app-ink)' }}>{v}</span>,
    },
    {
      title: t('admin.col.contact'),
      dataIndex: 'contact',
      key: 'contact',
      render: (v: string | null) =>
        v ? <span style={{ fontSize: 12, color: 'var(--app-ink-soft)' }}>{v}</span> : <span className="faint">—</span>,
    },
    {
      title: t('admin.col.status'),
      key: 'status',
      render: (_, r) => lastSeen(r),
    },
    {
      title: t('admin.col.registered'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v?: number) =>
        v ? (
          <span className="mono" style={{ fontSize: 12, color: 'var(--app-ink-soft)' }}>
            {dayjs(v).format('YYYY-MM-DD')}
          </span>
        ) : (
          '—'
        ),
    },
    {
      title: t('admin.col.actions'),
      key: 'ops',
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
              <Button type="link" size="small" danger icon={<StopOutlined />}>
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
      render: (v: number) => (
        <span className="mono" style={{ fontSize: 12, color: 'var(--app-ink-soft)' }}>
          {dayjs(v).format('YYYY-MM-DD HH:mm')}
        </span>
      ),
    },
    {
      title: t('admin.col.action'),
      dataIndex: 'action',
      key: 'a',
      render: (v: string) => (
        <span className="mono" style={{ fontSize: 11, color: 'var(--app-ink)' }}>
          {v}
        </span>
      ),
    },
    { title: t('admin.col.target'), dataIndex: 'target', key: 'target' },
    {
      title: t('admin.col.detail'),
      dataIndex: 'detail',
      key: 'd',
      render: (v: string) => (
        <span style={{ fontSize: 12, color: 'var(--app-ink-soft)' }}>{v || '—'}</span>
      ),
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      render: (v: string) => (
        <span className="mono" style={{ fontSize: 11, color: 'var(--app-ink-faint)' }}>
          {v}
        </span>
      ),
    },
  ]

  const statItems: Array<{ label: string; value: number | string; accent?: boolean }> = [
    { label: t('admin.stat.total'), value: stats?.totalAccounts ?? accounts.length },
    { label: t('admin.stat.active'), value: activeCount },
    { label: t('admin.stat.today'), value: registeredToday },
    { label: t('admin.stat.active7'), value: stats?.activeUsers7 ?? 0 },
    { label: t('admin.stat.signups7'), value: stats?.signups7 ?? 0 },
    {
      label: t('admin.stat.disabled'),
      value: stats?.disabledAccounts ?? 0,
      accent: (stats?.disabledAccounts ?? 0) > 0,
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-canvas)', padding: '20px 24px 40px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* 顶栏：印 + 标题 + 右上操作 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SealMark size={14} />
            <span className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--app-ink)' }}>
              {t('admin.title')}
            </span>
            <span className="faint" style={{ fontSize: 12 }}>
              {t('admin.consoleHint')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button icon={<DownloadOutlined />} onClick={exportCsv}>
              {t('admin.export')}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loadingList}>
              {t('admin.refresh')}
            </Button>
          </div>
        </div>

        {/* 统计条：等宽数字 + 12px 标签，细线分隔（不用 Statistic 卡片） */}
        <div
          className="stat-strip"
          style={{ borderTop: '1px solid var(--app-rule)', borderBottom: '1px solid var(--app-rule)', padding: '12px 0', marginBottom: 16 }}
        >
          {statItems.map((s, i) => (
            <div
              key={s.label}
              className="stat-cell"
              style={{
                flex: 1,
                minWidth: 120,
                paddingLeft: i === 0 ? 0 : 16,
                borderLeft: i === 0 ? 'none' : '1px solid var(--app-rule)',
              }}
            >
              <div className="stat-label" style={{ fontSize: 11, color: 'var(--app-ink-faint)' }}>
                {s.label}
              </div>
              <div
                className="stat-num mono"
                style={{
                  ...MONO,
                  fontSize: 26,
                  lineHeight: 1.2,
                  color: s.accent ? 'var(--app-accent-text)' : 'var(--app-ink)',
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* 筛选行：左 tab + 筛选 + 搜索，右计数 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
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
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    color: active ? 'var(--app-ink)' : 'var(--app-ink-faint)',
                    borderBottom: active ? '2px solid var(--app-accent)' : '2px solid transparent',
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
                style={{ width: 200 }}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <span className="mono" style={{ fontSize: 12, color: 'var(--app-ink-faint)' }}>
                {t('admin.count', { n: shown.length })}
              </span>
            </>
          )}
        </div>

        {tab === 'accounts' ? (
          <Table
            rowKey="id"
            size="small"
            columns={accountColumns}
            dataSource={shown}
            loading={loadingList}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            scroll={{ x: 'max-content' }}
          />
        ) : (
          <Table
            rowKey={(r) => `${r.created_at}-${r.action}-${r.target}`}
            size="small"
            columns={auditColumns}
            dataSource={logs}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            scroll={{ x: 'max-content' }}
          />
        )}

        {/* 近 7 天行为：一行 mono 文本，不做卡片 */}
        {stats && stats.events7.length > 0 && (
          <div style={{ marginTop: 20, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span className="eyebrow">{t('admin.events.title')}</span>
            {stats.events7.map((e) => (
              <span key={e.name} className="mono" style={{ fontSize: 11, color: 'var(--app-ink-soft)' }}>
                {e.name} {e.count}
              </span>
            ))}
          </div>
        )}

        <p className="faint" style={{ fontSize: 12, lineHeight: 1.7, marginTop: 24, maxWidth: 720 }}>
          <span style={{ color: 'var(--app-ink)', fontWeight: 600 }}>{t('admin.tips.title')}</span>
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
                borderLeft: '2px solid var(--app-warning)',
                paddingLeft: 10,
                marginBottom: 16,
                fontSize: 12.5,
                lineHeight: 1.7,
                color: 'var(--app-ink-soft)',
              }}
            >
              {t('admin.reset.onceWarn')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13 }}>
                <span className="faint" style={{ minWidth: 64 }}>
                  {t('auth.username')}
                </span>
                <span style={{ fontWeight: 600, color: 'var(--app-ink)' }}>{resetDone.username}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <span className="faint" style={{ minWidth: 64 }}>
                  {t('auth.password')}
                </span>
                <span className="mono" style={{ fontWeight: 600, color: 'var(--app-ink)' }}>
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
            <p className="faint" style={{ fontSize: 12, margin: '12px 0 0', lineHeight: 1.7 }}>
              {t('admin.reset.afterHint')}
            </p>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--app-ink-soft)', marginTop: 0, lineHeight: 1.7 }}>
              {t('admin.reset.body')}
            </p>
            <Input.Password
              placeholder={t('admin.reset.placeholder')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              maxLength={200}
            />
            <p className="faint" style={{ fontSize: 12, marginBottom: 0, lineHeight: 1.7 }}>
              {t('admin.reset.blankHint')}
            </p>
          </>
        )}
      </Modal>
    </div>
  )
}
