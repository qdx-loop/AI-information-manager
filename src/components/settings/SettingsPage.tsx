import { useEffect, useState } from 'react'
import {
  Card,
  Tabs,
  Form,
  Input,
  Button,
  Switch,
  Space,
  Table,
  Tag,
  Popconfirm,
  App,
  Upload,
  Typography,
  Alert,
  Divider,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  UserOutlined,
  RobotOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  UploadOutlined,
  CloudOutlined,
  SyncOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'
import { useLibraryStore } from '@/store/libraryStore'
import { encodeSyncCode } from '@/utils/syncCode'
import { verifyPassword } from '@/utils/crypto'
import { getProvider } from '@/db/providerFactory'
import { exportBackup, importBackup } from '@/db/backup'
import { SYSTEM_PROMPT } from '@/ai/contextBuilder'
import type { Account } from '@/types'

const { Text } = Typography

export default function SettingsPage() {
  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
      <Card>
        <Tabs
          items={[
            { key: 'account', label: '账户', children: <AccountTab /> },
            { key: 'storage', label: '存储', children: <StorageTab /> },
            { key: 'ai', label: 'AI 配置', children: <AITab /> },
            { key: 'backup', label: '备份恢复', children: <BackupTab /> },
          ]}
        />
      </Card>
    </div>
  )
}

function AccountTab() {
  const { message } = App.useApp()
  const { account, logout } = useAuthStore()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [pwdOpen, setPwdOpen] = useState(false)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)

  const load = async () => {
    setAccounts(await getProvider().listAccounts())
  }
  useEffect(() => {
    load().catch((e) => message.error('加载账户列表失败：' + (e as Error).message))
  }, [])

  const handleChangePwd = async () => {
    if (!account) return
    if (!oldPwd) {
      message.warning('请输入旧密码')
      return
    }
    if (newPwd.length < 6) {
      message.warning('新密码至少 6 位')
      return
    }
    if (oldPwd === newPwd) {
      message.warning('新密码不能与旧密码相同')
      return
    }
    setPwdLoading(true)
    try {
      // 重新拉取账户完整信息（含 passwordHash/salt），避免使用过期数据
      const full = await getProvider().getAccountById(account.id)
      if (!full || !full.passwordHash || !full.salt) {
        message.error('无法验证旧密码：账户信息不完整')
        return
      }
      const ok = await verifyPassword(oldPwd, full.salt, full.passwordHash)
      if (!ok) {
        message.error('旧密码不正确')
        return
      }
      await getProvider().updatePassword(account.id, newPwd)
      message.success('密码已修改')
      setOldPwd('')
      setNewPwd('')
      setPwdOpen(false)
    } catch (e) {
      message.error('修改失败：' + (e as Error).message)
    } finally {
      setPwdLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    await getProvider().deleteAccount(id)
    message.success('已删除账户及其数据')
    if (id === account?.id) {
      logout()
    }
    load().catch((e) => message.error('刷新账户列表失败：' + (e as Error).message))
  }

  const columns: ColumnsType<Account> = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: number) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '状态',
      key: 'current',
      render: (_, r) => (r.id === account?.id ? <Tag color="green">当前登录</Tag> : <Text type="secondary">—</Text>),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, r) => (
        <Popconfirm
          title="删除该账户？"
          description="将永久删除该账户的全部管理库与条目数据，不可恢复。"
          okText="删除"
          okType="danger"
          cancelText="取消"
          onConfirm={() => handleDelete(r.id)}
        >
          <Button size="small" danger>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button
          icon={<UserOutlined />}
          onClick={() => setPwdOpen(true)}
          disabled={!account}
        >
          修改当前账户密码
        </Button>
      </Space>
      <Table<Account>
        rowKey="id"
        columns={columns}
        dataSource={accounts}
        pagination={false}
        size="small"
      />

      {pwdOpen && (
        <Card size="small" title="修改密码" style={{ marginTop: 16, maxWidth: 400 }}>
          <Input.Password
            placeholder="旧密码"
            value={oldPwd}
            onChange={(e) => setOldPwd(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <Input.Password
            placeholder="新密码（至少 6 位）"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <Space>
            <Button type="primary" onClick={handleChangePwd} loading={pwdLoading}>
              确认修改
            </Button>
            <Button onClick={() => { setPwdOpen(false); setOldPwd(''); setNewPwd('') }}>取消</Button>
          </Space>
        </Card>
      )}
    </div>
  )
}

function StorageTab() {
  const { message, modal } = App.useApp()
  const { settings, setStorageMode, setCloud } = useAppStore()
  const { account } = useAuthStore()
  const [syncing, setSyncing] = useState(false)

  const handleSync = (direction: 'push' | 'pull') => {
    if (!account) {
      message.warning('请先登录')
      return
    }
    if (!settings.cloud.url || !settings.cloud.anonKey) {
      message.warning('请先填写云端连接信息')
      return
    }
    modal.confirm({
      title: direction === 'push' ? '上传本地数据到云端？' : '从云端拉取数据到本地？',
      content:
        direction === 'push'
          ? '将当前账户的本地数据上传到云端数据库，覆盖云端同 ID 的记录。'
          : '从云端拉取当前账户的数据到本地，覆盖本地同 ID 的记录。',
      okText: direction === 'push' ? '上传' : '拉取',
      onOk: async () => {
        setSyncing(true)
        try {
          const { pushLocalToCloud, pullCloudToLocal } = await import('@/db/providerFactory')
          if (direction === 'push') {
            message.loading({ content: '正在上传…', key: 'sync', duration: 0 })
            await pushLocalToCloud(account.id, settings.cloud)
            message.success({ content: '本地数据已上传到云端', key: 'sync' })
          } else {
            message.loading({ content: '正在拉取…', key: 'sync', duration: 0 })
            await pullCloudToLocal(account.id, settings.cloud)
            message.success({ content: '云端数据已拉取到本地，正在刷新…', key: 'sync' })
            // 刷新 libraryStore 数据
            await useLibraryStore.getState().loadLibraries()
            await useLibraryStore.getState().refreshCurrent()
          }
        } catch (e) {
          message.error({ content: '同步失败：' + (e as Error).message, key: 'sync' })
        } finally {
          setSyncing(false)
        }
      },
    })
  }

  const handleToggle = (checked: boolean) => {
    const mode = checked ? 'cloud' : 'local'
    if (mode === 'cloud' && (!settings.cloud.url || !settings.cloud.anonKey)) {
      message.warning('请先填写云端连接信息')
      return
    }
    modal.confirm({
      title: `切换到${checked ? '云端' : '本地'}存储模式？`,
      content: checked
        ? '开启后当前浏览器内全部账户与数据将上传到云端数据库，可在其他设备登录同步。'
        : '切换为本地后，仅当前浏览器可访问数据；云端数据不受影响。',
      okText: '确认切换',
      onOk: async () => {
        try {
          if (mode === 'cloud') {
            message.loading({ content: '正在上传数据到云端…', key: 'migrate', duration: 0 })
            const { migrateLocalToCloud } = await import('@/db/providerFactory')
            await migrateLocalToCloud(settings)
            message.success({ content: '已切换到云端模式，数据已上传', key: 'migrate' })
          } else {
            const { migrateCloudToLocal } = await import('@/db/providerFactory')
            await migrateCloudToLocal()
            message.success('已切换到本地模式')
          }
          setStorageMode(mode)
          setTimeout(() => window.location.reload(), 800)
        } catch (e) {
          message.error({ content: '切换失败：' + (e as Error).message, key: 'migrate' })
        }
      },
    })
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <Space align="center" style={{ marginBottom: 16 }}>
        <Switch checked={settings.storageMode === 'cloud'} onChange={handleToggle} />
        <Text strong>
          {settings.storageMode === 'cloud' ? '云端存储模式（已开启）' : '本地存储模式（默认）'}
        </Text>
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="云端存储说明"
        description="采用 Supabase 云数据库直连。请先在 Supabase 项目中执行建表 SQL（见下方），再填写连接信息。开启后账户与数据将同步至云端，支持跨设备登录。"
      />

      <Form layout="vertical">
        <Form.Item label="Supabase Project URL">
          <Input
            placeholder="https://xxxx.supabase.co"
            value={settings.cloud.url}
            onChange={(e) => setCloud({ url: e.target.value })}
            disabled={settings.storageMode === 'cloud'}
          />
        </Form.Item>
        <Form.Item label="anon public key">
          <Input.Password
            placeholder="eyJhbGci..."
            value={settings.cloud.anonKey}
            onChange={(e) => setCloud({ anonKey: e.target.value })}
            disabled={settings.storageMode === 'cloud'}
          />
        </Form.Item>
      </Form>

      {settings.cloud.url && settings.cloud.anonKey && (
        <Card size="small" title="跨设备同步码" style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            在其他设备的登录页粘贴此同步码，可自动填入云端和 AI 配置。
          </Text>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 8, fontSize: 12 }}
            message="同步码含数据库访问凭证，请像密码一样保管，不要公开分享或提交到代码仓库。"
          />
          <Input.Group compact>
            <Input
              readOnly
              style={{ width: 'calc(100% - 80px)' }}
              value={encodeSyncCode({
                cloudUrl: settings.cloud.url,
                cloudKey: settings.cloud.anonKey,
                aiBaseUrl: settings.ai.baseUrl,
                aiApiKey: settings.ai.apiKey,
                aiModel: settings.ai.model,
              })}
            />
            <Button
              style={{ width: 80 }}
              icon={<CopyOutlined />}
              onClick={() => {
                const code = encodeSyncCode({
                  cloudUrl: settings.cloud.url,
                  cloudKey: settings.cloud.anonKey,
                  aiBaseUrl: settings.ai.baseUrl,
                  aiApiKey: settings.ai.apiKey,
                  aiModel: settings.ai.model,
                })
                navigator.clipboard.writeText(code)
                message.success('同步码已复制')
              }}
            >
              复制
            </Button>
          </Input.Group>
        </Card>
      )}

      <Card size="small" title="建表 SQL（复制到 Supabase SQL Editor 执行）" style={{ marginTop: 8 }}>
        <pre style={{ fontSize: 11, maxHeight: 200, overflow: 'auto', margin: 0 }}>
{`create table accounts (
  id uuid primary key,
  username text unique not null,
  password_hash text not null,
  salt text not null,
  created_at bigint not null
);
create table libraries (
  id uuid primary key,
  account_id uuid not null,
  name text not null,
  category text,
  sort_order int,
  deleted_at bigint
);
create table fields (
  id uuid primary key,
  library_id uuid not null,
  key text, label text, type text,
  options jsonb, required bool, visible bool,
  sort_order int
);
create table items (
  id uuid primary key,
  library_id uuid not null,
  account_id uuid not null,
  fields jsonb not null,
  pinned bool, sort_order int,
  created_at bigint, updated_at bigint,
  deleted_at bigint
);
create index on libraries(account_id);
create index on items(library_id);
create index on items(account_id);

-- 禁用 RLS（本应用使用应用层认证，不依赖 Supabase Auth）
alter table accounts disable row level security;
alter table libraries disable row level security;
alter table fields disable row level security;
alter table items disable row level security;`}
        </pre>
      </Card>

      {(settings.cloud.url && settings.cloud.anonKey) ? (
        <Card
          size="small"
          title="数据同步"
          style={{ marginTop: 16 }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <CloudOutlined /> 当前模式：{settings.storageMode === 'cloud' ? '云端' : '本地'}
              {account ? `　|　账户：${account.username}` : ''}
            </Text>
            <Space>
              <Button
                icon={<UploadOutlined />}
                loading={syncing}
                onClick={() => handleSync('push')}
                disabled={!account}
              >
                上传到云端
              </Button>
              <Button
                icon={<DownloadOutlined />}
                loading={syncing}
                onClick={() => handleSync('pull')}
                disabled={!account}
              >
                从云端拉取
              </Button>
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <SyncOutlined /> 上传：本地 → 云端（覆盖同 ID 记录）；拉取：云端 → 本地（覆盖同 ID 记录）
            </Text>
          </Space>
        </Card>
      ) : null}
    </div>
  )
}

function AITab() {
  const { message } = App.useApp()
  const { settings, setAI } = useAppStore()

  const handleTest = async () => {
    if (!settings.ai.baseUrl || !settings.ai.apiKey || !settings.ai.model) {
      message.warning('请填写完整')
      return
    }
    try {
      const res = await fetch(`${settings.ai.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.ai.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.ai.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
        }),
      })
      if (res.ok) message.success('连接正常')
      else message.error(`连接失败 (${res.status})`)
    } catch (e) {
      message.error('连接失败：' + (e as Error).message)
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="支持 OpenAI 兼容格式"
        description="填写服务商的 base URL、API Key 与模型名。兼容 OpenAI、DeepSeek、通义千问、Kimi 等。"
      />
      <Form layout="vertical">
        <Form.Item label="Base URL">
          <Input
            placeholder="https://api.openai.com/v1 或 https://api.deepseek.com/v1"
            value={settings.ai.baseUrl}
            onChange={(e) => setAI({ baseUrl: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="API Key">
          <Input.Password
            placeholder="sk-..."
            value={settings.ai.apiKey}
            onChange={(e) => setAI({ apiKey: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="模型名">
          <Input
            placeholder="gpt-4o-mini / deepseek-chat / qwen-plus"
            value={settings.ai.model}
            onChange={(e) => setAI({ model: e.target.value })}
          />
        </Form.Item>
        <Space>
          <Button icon={<RobotOutlined />} onClick={handleTest}>
            测试连接
          </Button>
          <Button type="primary" onClick={() => message.success('已保存')}>
            保存
          </Button>
        </Space>
      </Form>

      <Divider />

      <Form layout="vertical">
        <Form.Item
          label={
            <Space>
              <Text strong>预设提示词</Text>
              <Tag color={settings.ai.customPrompt ? 'blue' : 'default'} style={{ fontSize: 11 }}>
                {settings.ai.customPrompt ? '自定义' : '默认'}
              </Tag>
            </Space>
          }
          help="自定义 AI 的系统提示词（角色设定与规则）。留空则使用内置默认提示词。"
        >
          <Input.TextArea
            rows={6}
            placeholder={SYSTEM_PROMPT}
            value={settings.ai.customPrompt}
            onChange={(e) => setAI({ customPrompt: e.target.value })}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </Form.Item>
        <Space>
          <Button
            size="small"
            onClick={() => {
              setAI({ customPrompt: '' })
              message.success('已恢复为默认提示词')
            }}
          >
            恢复默认
          </Button>
          <Button
            size="small"
            onClick={() => {
              setAI({ customPrompt: SYSTEM_PROMPT })
              message.success('已填入默认提示词，可在此基础修改')
            }}
          >
            载入默认到编辑框
          </Button>
        </Space>
      </Form>

      <Divider />

      <Form layout="vertical">
        <Form.Item
          label={
            <Space>
              <Text strong>AI 永久记忆</Text>
              {settings.ai.memory && (
                <Tag color="green" style={{ fontSize: 11 }}>已记忆 {settings.ai.memory.length} 字</Tag>
              )}
            </Space>
          }
          help="AI 会记住这些信息并在每次对话中参考。你可以在对话中让 AI 自动记忆，也可以在这里手动编辑。"
        >
          <Input.TextArea
            rows={6}
            placeholder={'例如：\n- 用户偏好用表格形式展示统计结果\n- 常用管理库是「联系人管理」\n- 日期格式偏好 YYYY-MM-DD'}
            value={settings.ai.memory}
            onChange={(e) => setAI({ memory: e.target.value })}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </Form.Item>
        <Space>
          <Button
            size="small"
            danger
            disabled={!settings.ai.memory}
            onClick={() => {
              setAI({ memory: '' })
              message.success('已清空记忆')
            }}
          >
            清空记忆
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            记忆存储在本地浏览器中，跨会话保留。
          </Text>
        </Space>
      </Form>
    </div>
  )
}

function BackupTab() {
  const { message, modal } = App.useApp()
  const { account } = useAuthStore()

  const handleExport = async () => {
    if (!account) return
    const blob = await exportBackup(account.id)
    const json = JSON.stringify(blob, null, 2)
    const file = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = `备份_${dayjs().format('YYYYMMDD_HHmmss')}.json`
    a.click()
    URL.revokeObjectURL(url)
    message.success('已导出备份')
  }

  const handleImport = (file: File) => {
    modal.confirm({
      title: '导入备份将覆盖当前账户的全部数据',
      content: '此操作不可撤销，建议先导出当前数据。',
      okText: '确认覆盖导入',
      okType: 'danger',
      onOk: async () => {
        try {
          const text = await file.text()
          const blob = JSON.parse(text)
          await importBackup(account!.id, blob)
          message.success('已恢复，请刷新页面')
          setTimeout(() => window.location.reload(), 1000)
        } catch (e) {
          message.error('导入失败：' + (e as Error).message)
        }
      },
    })
    return false
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="本地备份与恢复"
        description="导出当前账户的全部管理库、字段模板、条目数据为 JSON 文件。恢复时将覆盖当前账户现有数据。"
      />
      <Space direction="vertical" style={{ width: '100%' }}>
        <Button icon={<DownloadOutlined />} onClick={handleExport} block>
          导出备份
        </Button>
        <Upload beforeUpload={handleImport} showUploadList={false} accept=".json">
          <Button icon={<UploadOutlined />} block>
            选择备份文件恢复
          </Button>
        </Upload>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <DatabaseOutlined /> 仅在本地存储模式下有意义；云端模式的数据由 Supabase 托管。
        </Text>
      </Space>
    </div>
  )
}
