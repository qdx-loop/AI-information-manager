import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Card,
  Segmented,
  Table,
  Button,
  Tag,
  Space,
  Input,
  InputNumber,
  Modal,
  Select,
  App,
  Typography,
  Popconfirm,
  Statistic,
  Alert,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  StopOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  CopyOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useI18n } from '@/i18n'
import {
  adminLogin,
  adminListAccounts,
  adminCreateAccount,
  adminAccountOp,
  adminListAudit,
  adminGetStats,
  getAdminToken,
  type AdminAccountRow,
  type AuditEntry,
  type OpsStats,
} from '@/lib/serverApi'

const { Text } = Typography

// 卡种选项随语言生成；与后端 CARD_TYPES 保持一致
export const buildCardOptions = (t: (k: string) => string) => [
  { value: 'trial', label: t('admin.cardTypes.trial') },
  { value: 'month', label: t('admin.cardTypes.month') },
  { value: 'quarter', label: t('admin.cardTypes.quarter') },
  { value: 'halfYear', label: t('admin.cardTypes.halfYear') },
  { value: 'year', label: t('admin.cardTypes.year') },
]
const CUSTOM_DAYS = '__custom__'

function normalizeDays(days: number | null): number | null {
  return days !== null && Number.isInteger(days) && days >= 1 && days <= 3650 ? days : null
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
  const [filterKey, setFilterKey] = useState<'all' | 'expiring' | 'expired' | 'disabled' | 'inactive'>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [cardType, setCardType] = useState('month')
  const [customDays, setCustomDays] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [issuedCreds, setIssuedCreds] = useState<{ username: string; password: string; days: number } | null>(null)
  const [renewFor, setRenewFor] = useState<AdminAccountRow | null>(null)
  const [renewType, setRenewType] = useState('month')
  const [renewCustomDays, setRenewCustomDays] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoadingList(true)
    // 审计日志独立容错：未执行迁移的旧部署没有该表时静默降级
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

  // 组装生成账号的请求体：固定卡种传 cardType；自定义传 days
  const buildCreatePayload = (): { cardType?: string; days?: number } | null => {
    if (cardType === CUSTOM_DAYS) {
      const days = normalizeDays(customDays)
      return days ? { days } : null
    }
    return { cardType }
  }

  const handleCreate = async () => {
    const payload = buildCreatePayload()
    if (!payload) {
      message.warning(t('admin.customDays.invalid'))
      return
    }
    setCreating(true)
    try {
      const r = await adminCreateAccount(payload)
      setIssuedCreds({ ...r.credentials, days: r.days })
      setCreateOpen(false)
      load()
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  // 返回是否成功，供调用方决定是否关闭弹窗
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

  const copyCreds = () => {
    if (!issuedCreds) return
    navigator.clipboard.writeText(`${t('admin.create.username')} ${issuedCreds.username}\n${t('admin.create.password')} ${issuedCreds.password}`)
    message.success(t('admin.create.copied'))
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
              {t('admin.cardOnly')}
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

  const activeCount = accounts.filter((a) => !a.disabled && a.expiresAt && a.expiresAt > Date.now()).length

  const cardOptions = useMemo(() => buildCardOptions(t), [t])
  const daySelectOptions = useMemo(
    () => [...cardOptions, { value: CUSTOM_DAYS, label: t('admin.cardTypes.custom') }],
    [cardOptions, t],
  )
  function expiryTag(row: AdminAccountRow) {
    if (!row.expiresAt) return <Text type="secondary">—</Text>
    const days = Math.floor((row.expiresAt - Date.now()) / 86400000)
    if (row.disabled)
      return <Tag color="default">{t('admin.tag.disabledUntil', { date: dayjs(row.expiresAt).format('YYYY-MM-DD') })}</Tag>
    if (days <= 0) return <Tag color="red">{t('admin.tag.expired')}</Tag>
    if (days <= 3) return <Tag color="orange">{t('app.daysLeft', { n: days })}</Tag>
    return (
      <Tag color="green">
        {t('admin.tag.until', { date: dayjs(row.expiresAt).format('YYYY-MM-DD'), n: days })}
      </Tag>
    )
  }

  const EVENT_LABELS = () => ({
    login: t('admin.ev.login'),
    library_created: t('admin.ev.library_created'),
    item_created: t('admin.ev.item_created'),
    items_imported: t('admin.ev.items_imported'),
    ai_message_sent: t('admin.ev.ai_message_sent'),
    demo_created: t('admin.ev.demo_created'),
  })

  // —— 到期提醒自动化：7 天内到期的账号，一键复制催续费话术 ——
  const expiringSoon = accounts.filter((a) => {
    if (a.disabled || !a.expiresAt) return false
    const days = Math.floor((a.expiresAt - Date.now()) / 86400000)
    return days >= 0 && days <= 7
  })
  // —— 流失预警：仍有效但已超过 14 天未登录的账号（曾用过、现在沉默）——
  const INACTIVE_DAYS = 14
  const churnRisk = accounts.filter(
    (a) =>
      !a.disabled &&
      a.expiresAt &&
      a.expiresAt > Date.now() &&
      a.lastLogin &&
      a.lastLogin < Date.now() - INACTIVE_DAYS * 86400000,
  )
  const exportAccountsCsv = () => {
    const esc = (v: string) => (/^[=+@\t\r]|^-[^0-9.]/.test(v) ? `'${v}` : v)
    const head = '用户名,状态,到期时间,最近登录'
    const rows = accounts.map((a) =>
      [
        a.username,
        a.disabled ? '停用' : a.expiresAt && a.expiresAt < Date.now() ? '已到期' : '正常',
        a.expiresAt ? dayjs(a.expiresAt).format('YYYY-MM-DD') : '',
        a.lastLogin ? dayjs(a.lastLogin).format('YYYY-MM-DD HH:mm') : '从未',
      ]
        .map((c) => esc(String(c)))
        .join(','),
    )
    const blob = new Blob([`\uFEFF${[head, ...rows].join('\n')}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `账号列表_${dayjs().format('YYYYMMDD_HHmmss')}.csv`
    link.click()
    // 移动端/WebView 下载异步启动，延迟 revoke 防空文件
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    message.success('已导出')
  }

  const copyRenewScripts = () => {
    if (expiringSoon.length === 0) return
    const lines = expiringSoon.map(
      (a) =>
        `【续费提醒】您好！您的账号 ${a.username} 将于 ${dayjs(a.expiresAt).format('YYYY-MM-DD')} 到期，如需继续使用请回复本消息办理续费哦~`,
    )
    navigator.clipboard.writeText(lines.join('\n\n'))
    message.success(t('admin.expiry.copied', { n: lines.length }))
  }

  // 表格筛选
  const filteredAccounts = accounts.filter((a) => {
    if (filterKey === 'all') return true
    if (filterKey === 'disabled') return !!a.disabled
    if (filterKey === 'inactive') return churnRisk.some((c) => c.id === a.id)
    if (!a.expiresAt) return false
    const days = Math.floor((a.expiresAt - Date.now()) / 86400000)
    if (filterKey === 'expiring') return !a.disabled && days >= 0 && days <= 7
    if (filterKey === 'expired') return !a.disabled && days < 0
    return true
  })


  const columns: ColumnsType<AdminAccountRow> = [
    { title: t('admin.tbl.username'), dataIndex: 'username', key: 'username', render: (v) => <Text code>{v}</Text> },
    { title: t('admin.tbl.validity'), key: 'expiry', render: (_, r) => expiryTag(r) },
    {
      title: t('admin.tbl.status'),
      dataIndex: 'disabled',
      key: 'disabled',
      width: 80,
      render: (v: boolean) => (v ? <Tag color="default">{t('admin.status.disabled')}</Tag> : <Tag color="green">{t('admin.status.normal')}</Tag>),
    },
    {
      title: t('admin.tbl.lastLogin'),
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      render: (v?: number | null) => (v ? dayjs(v).format('MM-DD HH:mm') : t('admin.never')),
    },
    {
      title: t('admin.tbl.op'),
      key: 'op',
      width: 300,
      render: (_, r) => (
        <Space wrap size={4}>
          <Button
            size="small"
            icon={<ClockCircleOutlined />}
            onClick={() => {
              setRenewFor(r)
              setRenewType('month')
              setRenewCustomDays(null)
            }}
          >
            {t('admin.op.renew')}
          </Button>
          {r.disabled ? (
            <Button
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
              <Button size="small" icon={<StopOutlined />}>
                停用
              </Button>
            </Popconfirm>
          )}
          <Popconfirm
            title={t('admin.deleteConfirm.title', { name: r.username })}
            description={t('admin.deleteConfirm.body')}
            okText={t('common.delete')}
            okType="danger"
            onConfirm={() => handleOp(r.id, { op: 'delete' }, t('admin.deleted', { name: r.username }))}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#F0FDFA' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card>
            <Space size="large" align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space size="large">
                <Statistic title={t('admin.stat.total')} value={accounts.length} />
                <Statistic title={t('admin.stat.active')} value={activeCount} valueStyle={{ color: '#3f8600' }} />
              </Space>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={load} loading={loadingList}>
                  {t('common.refresh')}
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateOpen(true)}
                >
                  {t('admin.btn.create')}
                </Button>
                <Button icon={<DownloadOutlined />} onClick={exportAccountsCsv} disabled={accounts.length === 0}>
                  {t('admin.btn.exportCsv')}
                </Button>
                <Button
                  danger
                  onClick={() => {
                    sessionStorage.removeItem('info-mgmt-admin-token')
                    setAccounts([])
                    setLogged(false)
                  }}
                >
                  {t('admin.btn.logout')}
                </Button>
              </Space>
            </Space>
          </Card>

          {expiringSoon.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message={t('admin.expiry.alert', { n: expiringSoon.length, names: expiringSoon.map((a) => a.username).join(', ') })}
              action={
                <Button size="small" type="primary" onClick={copyRenewScripts}>
                  {t('admin.expiry.copyBtn')}
                </Button>
              }
              style={{ marginBottom: 16 }}
            />
          )}

          {churnRisk.length > 0 && (
            <Alert
              type="info"
              showIcon
              message={t('admin.churn.alert', { n: churnRisk.length, days: INACTIVE_DAYS, names: churnRisk.map((a) => a.username).join(', ') })}
              action={
                <Button size="small" onClick={() => setFilterKey('inactive')}>
                  {t('admin.churn.view')}
                </Button>
              }
              style={{ marginBottom: 16 }}
            />
          )}

          <Card title={t('admin.stats.title')} size="small" style={{ marginBottom: 16 }}>
            <Space size="large" wrap align="center">
              <Statistic title={t('admin.stats.active7')} value={stats?.activeUsers7 ?? 0} valueStyle={{ color: '#3f8600' }} />
              <Statistic title={t('admin.stats.signups')} value={stats?.signups7 ?? 0} />
              {(stats?.events7 ?? []).slice(0, 6).map((e) => (
                <Statistic key={e.name} title={EVENT_LABELS()[e.name as keyof ReturnType<typeof EVENT_LABELS>] ?? e.name} value={e.count} />
              ))}
            </Space>
            {/* —— 续费漏斗（近 30 天；旧部署无数据时隐藏）—— */}
            {stats?.renewCount30 != null && (
              <Alert
                type={stats.renewCount30 > 0 ? 'success' : 'warning'}
                showIcon
                style={{ marginTop: 12 }}
                message={t('admin.funnel.title')}
                description={t('admin.funnel.body', {
                  renew: stats.renewCount30,
                  expiring: stats.expiredCount30 ?? 0,
                  rate: (stats.expiredCount30 ?? 0) > 0
                    ? Math.round((stats.renewCount30 / (stats.expiredCount30 || 1)) * 100)
                    : 0,
                  trialRate: (stats.trialTotal ?? 0) > 0
                    ? Math.round(((stats.trialRenewed ?? 0) / (stats.trialTotal || 1)) * 100)
                    : 0,
                  trialRenewed: stats.trialRenewed ?? 0,
                  trialTotal: stats.trialTotal ?? 0,
                })}
              />
            )}
          </Card>

          <Card
            title={t('admin.tbl.accounts')}
            size="small"
            extra={
              <Segmented
                value={filterKey}
                onChange={(v) => setFilterKey(v as typeof filterKey)}
                options={[
                  { label: t('admin.filter.all'), value: 'all' },
                  { label: t('admin.filter.expiring', { n: expiringSoon.length }), value: 'expiring' },
                  { label: t('admin.filter.expired'), value: 'expired' },
                  { label: t('admin.filter.inactive', { n: churnRisk.length }), value: 'inactive' },
                  { label: t('admin.filter.disabled'), value: 'disabled' },
                ]}
              />
            }
          >
            <Table rowKey="id" columns={columns} dataSource={filteredAccounts} loading={loadingList} pagination={{ pageSize: 15 }} size="middle" />
          </Card>

          <Card title={t('admin.audit.title')} size="small">
            <Table
              rowKey={(r) => `${r.created_at}-${r.action}-${r.target}`}
              columns={[
                {
                  title: t('admin.audit.col.time'),
                  key: 'time',
                  width: 150,
                  render: (_, r) => dayjs(r.created_at).format('MM-DD HH:mm:ss'),
                },
                {
                  title: t('admin.tbl.op'),
                  key: 'action',
                  width: 90,
                  render: (_, r) =>
                    ({ login: t('admin.audit.act.login'), create: t('admin.audit.act.create'), renew: t('admin.audit.act.renew'), disable: t('admin.audit.act.disable'), enable: t('admin.audit.act.enable'), delete: t('admin.audit.act.delete') } as Record<string, string>)[r.action] ?? r.action,
                },
                { title: t('admin.audit.col.target'), dataIndex: 'target', key: 'target', width: 170, render: (v) => <Text code>{v}</Text> },
                { title: t('admin.audit.col.detail'), dataIndex: 'detail', key: 'detail', ellipsis: true },
                { title: t('admin.audit.col.ip'), dataIndex: 'ip', key: 'ip', width: 130 },
              ]}
              dataSource={logs}
              pagination={{ pageSize: 8 }}
              size="small"
            />
          </Card>

          <Text type="secondary" style={{ fontSize: 12 }}>
            提示：生成账号后弹出的用户名/密码只显示这一次，请当场复制发给买家。
          </Text>
        </Space>
      </div>

      {/* 生成账号 */}
      <Modal
        title={t('admin.create.modalTitle')}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        confirmLoading={creating}
        okText={t('admin.create.okText')}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            options={daySelectOptions}
            value={cardType}
            onChange={(v) => {
              setCardType(v)
              if (v !== CUSTOM_DAYS) setCustomDays(null)
            }}
            style={{ width: '100%' }}
            size="large"
          />
          {cardType === CUSTOM_DAYS && (
            <InputNumber
              min={1}
              max={3650}
              precision={0}
              value={customDays}
              onChange={(v) => setCustomDays(v)}
              placeholder={t('admin.customDays.placeholder')}
              addonAfter={t('admin.customDays.unit')}
              style={{ width: '100%' }}
              size="large"
              autoFocus
            />
          )}
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('admin.create.auto')}
          </Text>
        </Space>
      </Modal>

      {/* 新账号凭证（只显示一次） */}
      <Modal open={!!issuedCreds} footer={null} onCancel={() => setIssuedCreds(null)} title={t('admin.create.doneTitle')}>
        {issuedCreds && (
          <div style={{ fontSize: 16, lineHeight: 2 }}>
            <div>
              {t('admin.create.cardType')}<b>{cardOptions.find((c) => c.value === cardType)?.label ?? `${issuedCreds.days}${t('admin.customDays.unit')}`}</b>
            </div>
            <div>
              {t('admin.create.username')}<Text code copyable style={{ fontSize: 18 }}>{issuedCreds.username}</Text>
            </div>
            <div>
              {t('admin.create.password')}<Text code copyable style={{ fontSize: 18 }}>{issuedCreds.password}</Text>
            </div>
            <Button block type="primary" ghost icon={<CopyOutlined />} style={{ marginTop: 12 }} onClick={copyCreds}>
              {t('admin.create.copyAll')}
            </Button>
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 12 }}
              message={t('admin.create.warning')}
            />
          </div>
        )}
      </Modal>

      {/* 续费 */}
      <Modal
        title={t('admin.renew.title', { name: renewFor?.username ?? '' })}
        open={!!renewFor}
        onCancel={() => setRenewFor(null)}
        onOk={async () => {
          if (!renewFor) return
          let ok = false
          if (renewType === CUSTOM_DAYS) {
            const days = normalizeDays(renewCustomDays)
            if (!days) {
              message.warning(t('admin.customDays.invalid'))
              return Promise.reject()
            }
            ok = await handleOp(renewFor.id, { op: 'renew', days }, t('admin.renew.success'))
          } else {
            ok = await handleOp(renewFor.id, { op: 'renew', cardType: renewType }, t('admin.renew.success'))
          }
          if (ok) setRenewFor(null)
          else return Promise.reject()
        }}
        okText={t('admin.renew.ok')}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            options={daySelectOptions}
            value={renewType}
            onChange={(v) => {
              setRenewType(v)
              if (v !== CUSTOM_DAYS) setRenewCustomDays(null)
            }}
            style={{ width: '100%' }}
            size="large"
          />
          {renewType === CUSTOM_DAYS && (
            <InputNumber
              min={1}
              max={3650}
              precision={0}
              value={renewCustomDays}
              onChange={(v) => setRenewCustomDays(v)}
              placeholder={t('admin.customDays.placeholder')}
              addonAfter={t('admin.customDays.unit')}
              style={{ width: '100%' }}
              size="large"
            />
          )}
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
            {t('admin.renew.hint')}
          </Text>
        </Space>
      </Modal>
    </div>
  )
}
