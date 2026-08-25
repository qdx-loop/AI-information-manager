import { useEffect, useState, useCallback } from 'react'
import {
  Card,
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
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  adminLogin,
  adminListAccounts,
  adminCreateAccount,
  adminAccountOp,
  adminListAudit,
  getAdminToken,
  type AdminAccountRow,
  type AuditEntry,
} from '@/lib/serverApi'

const { Text } = Typography

// 卡种选项：与后端 CARD_TYPES 保持一致
export const CARD_OPTIONS = [
  { value: 'trial', label: '体验卡（3天）' },
  { value: 'month', label: '月卡（30天）' },
  { value: 'quarter', label: '季卡（90天）' },
  { value: 'halfYear', label: '半年卡（180天）' },
  { value: 'year', label: '年卡（365天）' },
]

// 卡种下拉中的「自定义天数」哨兵值；选中时按输入的天数（1~3650）提交
const CUSTOM_DAYS = '__custom__'

const DAY_SELECT_OPTIONS = [...CARD_OPTIONS, { value: CUSTOM_DAYS, label: '自定义天数…' }]

function normalizeDays(days: number | null): number | null {
  return days !== null && Number.isInteger(days) && days >= 1 && days <= 3650 ? days : null
}

function expiryTag(row: AdminAccountRow) {
  if (!row.expiresAt) return <Text type="secondary">—</Text>
  const days = Math.floor((row.expiresAt - Date.now()) / 86400000)
  if (row.disabled) return <Tag color="default">已停用 · 至 {dayjs(row.expiresAt).format('YYYY-MM-DD')}</Tag>
  if (days <= 0) return <Tag color="red">已到期</Tag>
  if (days <= 3) return <Tag color="orange">剩 {days} 天</Tag>
  return (
    <Tag color="green">
      至 {dayjs(row.expiresAt).format('YYYY-MM-DD')}（剩 {days} 天）
    </Tag>
  )
}

export default function AdminPage() {
  const { message } = App.useApp()
  const [logged, setLogged] = useState(!!getAdminToken())
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [accounts, setAccounts] = useState<AdminAccountRow[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [logs, setLogs] = useState<AuditEntry[]>([])
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
      message.warning('自定义天数需为 1~3650 的整数')
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
    navigator.clipboard.writeText(`用户名：${issuedCreds.username}\n密码：${issuedCreds.password}`)
    message.success('已复制，可直接发给买家')
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
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#134E4A' }}>管理后台</h2>
            <p style={{ color: '#475569', fontSize: 12, marginTop: 4, marginBottom: 0 }}>
              仅管理员使用 · 用户请从首页登录
            </p>
          </div>
          <Input.Password
            placeholder="管理密码"
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
            进入后台
          </Button>
        </Card>
      </div>
    )
  }

  const activeCount = accounts.filter((a) => !a.disabled && a.expiresAt && a.expiresAt > Date.now()).length

  const columns: ColumnsType<AdminAccountRow> = [
    { title: '用户名', dataIndex: 'username', key: 'username', render: (v) => <Text code>{v}</Text> },
    { title: '有效期', key: 'expiry', render: (_, r) => expiryTag(r) },
    {
      title: '状态',
      dataIndex: 'disabled',
      key: 'disabled',
      width: 80,
      render: (v: boolean) => (v ? <Tag color="default">停用</Tag> : <Tag color="green">正常</Tag>),
    },
    {
      title: '最近登录',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      render: (v?: number | null) => (v ? dayjs(v).format('MM-DD HH:mm') : '从未'),
    },
    {
      title: '操作',
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
            续费
          </Button>
          {r.disabled ? (
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleOp(r.id, { op: 'enable' }, `已启用 ${r.username}`)}
            >
              启用
            </Button>
          ) : (
            <Popconfirm
              title={`停用 ${r.username}？`}
              description="停用后该用户立即无法使用"
              onConfirm={() => handleOp(r.id, { op: 'disable' }, `已停用 ${r.username}`)}
            >
              <Button size="small" icon={<StopOutlined />}>
                停用
              </Button>
            </Popconfirm>
          )}
          <Popconfirm
            title={`删除 ${r.username}？`}
            description="仅删除登录账号；用户的资料数据不受影响。"
            okText="删除"
            okType="danger"
            onConfirm={() => handleOp(r.id, { op: 'delete' }, `已删除 ${r.username}`)}
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
                <Statistic title="总账号数" value={accounts.length} />
                <Statistic title="有效用户" value={activeCount} valueStyle={{ color: '#3f8600' }} />
              </Space>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={load} loading={loadingList}>
                  刷新
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateOpen(true)}
                >
                  卖卡 · 生成账号
                </Button>
                <Button
                  danger
                  onClick={() => {
                    sessionStorage.removeItem('info-mgmt-admin-token')
                    setAccounts([])
                    setLogged(false)
                  }}
                >
                  退出后台
                </Button>
              </Space>
            </Space>
          </Card>

          <Card title="账户列表" size="small">
            <Table rowKey="id" columns={columns} dataSource={accounts} loading={loadingList} pagination={{ pageSize: 15 }} size="middle" />
          </Card>

          <Card title="操作日志（最近 200 条）" size="small">
            <Table
              rowKey={(r) => `${r.created_at}-${r.action}-${r.target}`}
              columns={[
                {
                  title: '时间',
                  key: 'time',
                  width: 150,
                  render: (_, r) => dayjs(r.created_at).format('MM-DD HH:mm:ss'),
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 90,
                  render: (_, r) =>
                    ({ login: '登录后台', create: '生成账号', renew: '续费', disable: '停用', enable: '启用', delete: '删除账号' } as Record<string, string>)[r.action] ?? r.action,
                },
                { title: '目标账号', dataIndex: 'target', key: 'target', width: 170, render: (v) => <Text code>{v}</Text> },
                { title: '详情', dataIndex: 'detail', key: 'detail', ellipsis: true },
                { title: 'IP', dataIndex: 'ip', key: 'ip', width: 130 },
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
        title="生成新账号（卖卡）"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        confirmLoading={creating}
        okText="生成"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            options={DAY_SELECT_OPTIONS}
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
              placeholder="输入天数（1~3650）"
              addonAfter="天"
              style={{ width: '100%' }}
              size="large"
              autoFocus
            />
          )}
          <Text type="secondary" style={{ fontSize: 12 }}>
            系统自动生成用户名和随机密码，有效期自现在起算。
          </Text>
        </Space>
      </Modal>

      {/* 新账号凭证（只显示一次） */}
      <Modal open={!!issuedCreds} footer={null} onCancel={() => setIssuedCreds(null)} title="✅ 账号已生成，请复制发给买家">
        {issuedCreds && (
          <div style={{ fontSize: 16, lineHeight: 2 }}>
            <div>
              卡种：<b>{CARD_OPTIONS.find((c) => c.value === cardType)?.label ?? `${issuedCreds.days}天`}</b>
            </div>
            <div>
              用户名：<Text code copyable style={{ fontSize: 18 }}>{issuedCreds.username}</Text>
            </div>
            <div>
              密　码：<Text code copyable style={{ fontSize: 18 }}>{issuedCreds.password}</Text>
            </div>
            <Button block type="primary" ghost icon={<CopyOutlined />} style={{ marginTop: 12 }} onClick={copyCreds}>
              一键复制用户名+密码
            </Button>
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 12 }}
              message="关闭本窗口后密码将无法再次查看，请务必先复制保存。"
            />
          </div>
        )}
      </Modal>

      {/* 续费 */}
      <Modal
        title={`给 ${renewFor?.username ?? ''} 续费`}
        open={!!renewFor}
        onCancel={() => setRenewFor(null)}
        onOk={async () => {
          if (!renewFor) return
          let ok = false
          if (renewType === CUSTOM_DAYS) {
            const days = normalizeDays(renewCustomDays)
            if (!days) {
              message.warning('自定义天数需为 1~3650 的整数')
              return Promise.reject()
            }
            ok = await handleOp(renewFor.id, { op: 'renew', days }, '续费成功')
          } else {
            ok = await handleOp(renewFor.id, { op: 'renew', cardType: renewType }, '续费成功')
          }
          if (ok) setRenewFor(null)
          else return Promise.reject()
        }}
        okText="确认续费"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            options={DAY_SELECT_OPTIONS}
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
              placeholder="输入天数（1~3650）"
              addonAfter="天"
              style={{ width: '100%' }}
              size="large"
            />
          )}
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
            未到期的账号在原到期时间上累加；已到期或被停用的账号从今天重新起算并自动恢复启用。
          </Text>
        </Space>
      </Modal>
    </div>
  )
}
