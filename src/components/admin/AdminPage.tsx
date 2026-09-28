import { useEffect, useState, useCallback } from 'react'
import {
  Card,
  Segmented,
  Table,
  Button,
  Tag,
  Space,
  Input,
  Modal,
  App,
  Typography,
  Popconfirm,
  Statistic,
  Alert,
  Descriptions,
} from 'antd'
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

const { Text } = Typography

/**
 * 管理后台：产品改为「自助注册 + 永久免费」后的运营面板。
 *
 * 不再有卖卡/续费。这里的能力围绕另外三件事：
 *   1. 看清谁在用（注册量、活跃、行为分布）
 *   2. 处理异常（停用违规账户、删除垃圾账户）
 *   3. 帮用户找回入口（重置密码——用户自己设的密码，忘记后只能靠管理员）
 */
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
    adminListAudit().then(setLogs).catch(() => setLogs([]))
    adminGetStats().then(setStats).catch(() => setStats(null))
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
          background: '#F0FDFA',
        }}
      >
        <Card style={{ width: '100%', maxWidth: 360, margin: '0 12px', border: '1px solid #99F6E4' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: '#0D9488',
                display: 'inline-block',
                marginBottom: 10,
              }}
            />
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#134E4A' }}>{t('admin.title')}</h2>
            <p style={{ color: '#475569', fontSize: 12, marginTop: 4, marginBottom: 0 }}>
              {t('admin.consoleHint')}
            </p>
          </div>
          <Input.Password
            placeholder={t('auth.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onPressEnter={handleLogin}
            size="large"
            autoFocus
          />
          <Button
            type="primary"
            block
            style={{ marginTop: 16 }}
            loading={loginLoading}
            onClick={handleLogin}
            icon={<KeyOutlined />}
          >
            {t('admin.loginBtn')}
          </Button>
        </Card>
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

  function lastSeenTag(row: AdminAccountRow) {
    if (row.disabled) return <Tag color="default">{t('admin.status.disabled')}</Tag>
    const at = row.lastLogin ?? row.createdAt ?? 0
    const days = Math.floor((now - at) / DAY)
    if (days <= 0) return <Tag color="green">{t('admin.seen.today')}</Tag>
    if (days <= 7) return <Tag color="green">{t('admin.seen.days', { n: days })}</Tag>
    if (days <= 30) return <Tag color="orange">{t('admin.seen.days', { n: days })}</Tag>
    return <Tag>{t('admin.seen.days', { n: days })}</Tag>
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
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url
    el.download = `accounts-${dayjs().format('YYYYMMDD')}.csv`
    el.click()
    URL.revokeObjectURL(url)
  }

  const accountColumns: ColumnsType<AdminAccountRow> = [
    {
      title: t('admin.col.username'),
      dataIndex: 'username',
      key: 'username',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: t('admin.col.contact'),
      dataIndex: 'contact',
      key: 'contact',
      render: (v: string | null) => (v ? <Text style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text>),
    },
    {
      title: t('admin.col.status'),
      key: 'status',
      render: (_, r) => lastSeenTag(r),
    },
    {
      title: t('admin.col.registered'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v?: number) => (v ? <Text type="secondary">{dayjs(v).format('YYYY-MM-DD')}</Text> : '—'),
    },
    {
      title: t('admin.col.actions'),
      key: 'ops',
      render: (_, r) => (
        <Space size={4} wrap>
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
            okType="danger"
            onConfirm={() => handleOp(r.id, { op: 'delete' }, t('admin.deleted', { name: r.username }))}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              {t('admin.op.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const auditColumns: ColumnsType<AuditEntry> = [
    { title: t('admin.col.time'), dataIndex: 'created_at', key: 't', render: (v: number) => dayjs(v).format('YYYY-MM-DD HH:mm') },
    { title: t('admin.col.action'), dataIndex: 'action', key: 'a', render: (v: string) => <Tag>{v}</Tag> },
    { title: t('admin.col.target'), dataIndex: 'target', key: 'target' },
    { title: t('admin.col.detail'), dataIndex: 'detail', key: 'd', render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v || '—'}</Text> },
    { title: 'IP', dataIndex: 'ip', key: 'ip', render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#F0FDFA', padding: 16 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
          <Space align="center">
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#0D9488', display: 'inline-block' }} />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#134E4A' }}>{t('admin.title')}</span>
          </Space>
          <Space>
            <Button icon={<DownloadOutlined />} onClick={exportCsv}>
              {t('admin.export')}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loadingList}>
              {t('admin.refresh')}
            </Button>
          </Space>
        </Space>

        <Card size="small" style={{ marginBottom: 16, border: '1px solid #99F6E4' }}>
          <Space size={32} wrap>
            <Statistic title={t('admin.stat.total')} value={stats?.totalAccounts ?? accounts.length} valueStyle={{ color: '#3F8600' }} />
            <Statistic title={t('admin.stat.active')} value={activeCount} />
            <Statistic title={t('admin.stat.today')} value={registeredToday} />
            <Statistic title={t('admin.stat.active7')} value={stats?.activeUsers7 ?? 0} />
            <Statistic title={t('admin.stat.signups7')} value={stats?.signups7 ?? 0} />
            <Statistic title={t('admin.stat.disabled')} value={stats?.disabledAccounts ?? 0} valueStyle={{ color: (stats?.disabledAccounts ?? 0) > 0 ? '#FA8C16' : undefined }} />
          </Space>
        </Card>

        {stats && stats.events7.length > 0 && (
          <Card size="small" title={t('admin.events.title')} style={{ marginBottom: 16 }}>
            <Space size={16} wrap>
              {stats.events7.map((e) => (
                <Tag key={e.name}>
                  {e.name} · {e.count}
                </Tag>
              ))}
            </Space>
          </Card>
        )}

        <Card
          size="small"
          title={
            <Segmented
              value={tab}
              onChange={(v) => setTab(v as 'accounts' | 'audit')}
              options={[
                { label: t('admin.tab.accounts'), value: 'accounts' },
                { label: t('admin.tab.audit'), value: 'audit' },
              ]}
            />
          }
        >
          {tab === 'accounts' ? (
            <>
              <Space style={{ marginBottom: 12 }} wrap>
                <Segmented
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
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('admin.count', { n: shown.length })}
                </Text>
              </Space>
              <Table
                rowKey="id"
                size="small"
                columns={accountColumns}
                dataSource={shown}
                loading={loadingList}
                pagination={{ pageSize: 20, showSizeChanger: false }}
                scroll={{ x: 'max-content' }}
              />
            </>
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
        </Card>

        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          message={t('admin.tips.title')}
          description={t('admin.tips.body')}
        />
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
            <Space>
              <Button onClick={() => setResetFor(null)}>{t('common.cancel')}</Button>
              <Button type="primary" loading={resetting} onClick={submitReset}>
                {t('admin.reset.submit')}
              </Button>
            </Space>
          )
        }
      >
        {resetDone ? (
          <>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={t('admin.reset.onceWarn')}
            />
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label={t('auth.username')}>
                <Text strong>{resetDone.username}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('auth.password')}>
                <Space>
                  <Text strong>{resetDone.password}</Text>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => copyText(resetDone.password, t('admin.reset.copied'))}
                  >
                    {t('common.copy')}
                  </Button>
                </Space>
              </Descriptions.Item>
            </Descriptions>
            <p style={{ fontSize: 12, color: '#64748B', marginTop: 12, marginBottom: 0 }}>
              {t('admin.reset.afterHint')}
            </p>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: '#475569', marginTop: 0 }}>{t('admin.reset.body')}</p>
            <Input.Password
              placeholder={t('admin.reset.placeholder')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              maxLength={200}
            />
            <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 0 }}>{t('admin.reset.blankHint')}</p>
          </>
        )}
      </Modal>
    </div>
  )
}
