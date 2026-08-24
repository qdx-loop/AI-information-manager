import { useEffect, useState } from 'react'
import {
  Card,
  Tabs,
  Form,
  Input,
  Button,
  Switch,
  Space,
  Tag,
  App,
  Upload,
  Typography,
  Alert,
  Divider,
} from 'antd'
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
import { pushLocalToCloud, mergeCloudToLocal } from '@/db/syncService'
import { initFromSettings } from '@/db/providerFactory'
import { apiChangePassword } from '@/lib/serverApi'
import { exportBackup, importBackup } from '@/db/backup'
import { SYSTEM_PROMPT } from '@/ai/contextBuilder'
import { importLegacyMemory, listMemory, replaceAllMemory, clearMemory } from '@/ai/memory'
import SyncImportModal from '@/components/settings/SyncImportModal'
import QRCode from 'qrcode'

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
  const [pwdOpen, setPwdOpen] = useState(false)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)

  const handleChangePwd = async () => {
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
      await apiChangePassword(oldPwd, newPwd)
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

  const daysLeft = account?.expiresAt ? Math.floor((account.expiresAt - Date.now()) / 86400000) : null

  return (
    <div>
      {account && (
        <Card size="small" style={{ marginBottom: 16, maxWidth: 480 }}>
          <Space direction="vertical" size={4}>
            <span>
              当前账号：<Text strong>{account.username}</Text>
            </span>
            {account.expiresAt && (
              <span>
                有效期至：
                <Tag color={daysLeft !== null && daysLeft <= 3 ? 'orange' : 'green'}>
                  {dayjs(account.expiresAt).format('YYYY-MM-DD HH:mm')}
                  {daysLeft !== null && daysLeft >= 0 ? `（剩 ${daysLeft} 天）` : ''}
                </Tag>
              </span>
            )}
            <Text type="secondary" style={{ fontSize: 12 }}>
              到期后软件将自动退出并无法登录，续费请联系管理员。
            </Text>
          </Space>
        </Card>
      )}
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<UserOutlined />} onClick={() => setPwdOpen(true)} disabled={!account}>
          修改当前账户密码
        </Button>
        <Button danger onClick={() => logout()}>
          退出登录
        </Button>
      </Space>

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
  const { settings, setStorageMode, setCloud, setAI } = useAppStore()
  const { account } = useAuthStore()
  const [syncing, setSyncing] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')

  // 当前同步码内容（含云端与 AI 配置），生成二维码用
  const syncCodeValue =
    settings.cloud.url && settings.cloud.anonKey
      ? encodeSyncCode({
          cloudUrl: settings.cloud.url,
          cloudKey: settings.cloud.anonKey,
          aiBaseUrl: settings.ai.baseUrl,
          aiApiKey: settings.ai.apiKey,
          aiModel: settings.ai.model,
        })
      : ''

  useEffect(() => {
    if (!syncCodeValue) {
      setQrDataUrl('')
      return
    }
    QRCode.toDataURL(syncCodeValue, { width: 220, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''))
  }, [syncCodeValue])

  const handleDecodedImport = (d: {
    cloudUrl: string
    cloudKey: string
    aiBaseUrl: string
    aiApiKey: string
    aiModel: string
  }) => {
    setCloud({ url: d.cloudUrl, anonKey: d.cloudKey })
    if (d.aiBaseUrl || d.aiApiKey || d.aiModel) {
      setAI({ baseUrl: d.aiBaseUrl, apiKey: d.aiApiKey, model: d.aiModel })
    }
    setImportOpen(false)

    // 已配置好且处于云端模式 → 直接合并拉取，一步到位（换设备场景）
    if (settings.storageMode === 'cloud' && account) {
      void (async () => {
        try {
          const r = await mergeCloudToLocal(account.id, { url: d.cloudUrl, anonKey: d.cloudKey })
          await useLibraryStore.getState().loadLibraries()
          await useLibraryStore.getState().refreshCurrent()
          message.success(
            `配置已导入并拉取云端数据：新增管理库 ${r.addedLibraries} 个、条目 ${r.addedItems} 条，更新条目 ${r.updatedItems} 条`,
            6,
          )
        } catch (e) {
          message.warning(`配置已导入，但拉取云端数据失败：${(e as Error).message}`)
        }
      })()
    } else {
      message.success('配置已导入。打开上方「云端存储模式」开关即可启用同步。')
    }
  }

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
      title: direction === 'push' ? '上传本地数据到云端？' : '从云端合并数据到本地？',
      content:
        direction === 'push'
          ? '将当前账户的本地数据上传到云端数据库（按 ID 覆盖同条记录）。'
          : '合并规则：本地缺少的记录直接补入；两边都有的条目以修改时间较新的一方为准；云端已删除的管理库会同步删除。不会丢失任何一边的数据。',
      okText: direction === 'push' ? '上传' : '合并拉取',
      onOk: async () => {
        setSyncing(true)
        try {
          if (direction === 'push') {
            message.loading({ content: '正在上传…', key: 'sync', duration: 0 })
            await pushLocalToCloud(account.id, settings.cloud)
            message.success({ content: '本地数据已上传到云端', key: 'sync' })
          } else {
            message.loading({ content: '正在合并拉取…', key: 'sync', duration: 0 })
            const r = await mergeCloudToLocal(account.id, settings.cloud)
            await useLibraryStore.getState().loadLibraries()
            await useLibraryStore.getState().refreshCurrent()
            message.success({
              content: `合并完成：新增管理库 ${r.addedLibraries} 个、字段模板 ${r.addedFields} 个、条目 ${r.addedItems} 条；更新条目 ${r.updatedItems} 条`,
              key: 'sync',
              duration: 6,
            })
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
    if (!account) {
      message.warning('请先登录')
      return
    }
    modal.confirm({
      title: `切换到${checked ? '云端' : '本地'}存储模式？`,
      content: checked
        ? '开启后当前本地数据将合并上传到云端数据库，可在其他设备登录同步。'
        : '切换为本地后，仅当前浏览器可访问数据；云端数据不受影响。',
      okText: '确认切换',
      onOk: async () => {
        try {
          if (mode === 'cloud') {
            message.loading({ content: '正在上传数据到云端…', key: 'migrate', duration: 0 })
            await pushLocalToCloud(account.id, settings.cloud)
            setStorageMode(mode)
            initFromSettings(useAppStore.getState().settings)
            message.success({ content: '已切换到云端模式，数据已上传', key: 'migrate' })
          } else {
            message.loading({ content: '正在拉取云端数据…', key: 'migrate', duration: 0 })
            const r = await mergeCloudToLocal(account.id, settings.cloud)
            setStorageMode(mode)
            initFromSettings(useAppStore.getState().settings)
            message.success({
              content: `已切换到本地模式：新增管理库 ${r.addedLibraries} 个、条目 ${r.addedItems} 条，更新条目 ${r.updatedItems} 条`,
              key: 'migrate',
              duration: 6,
            })
          }
          // 刷新 libraryStore 数据，避免 window.location.reload() 整页刷新
          await useLibraryStore.getState().loadLibraries()
          // 切换存储模式后清空当前库选中状态（数据源已变，旧 fields/items 无意义）
          useLibraryStore.setState({ currentLibraryId: null, fields: [], items: [], trash: [], focusItemId: null })
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
        <Card size="small" title="跨设备同步" style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            在其他设备登录后，打开「设置 → 存储 → 扫码导入」，扫描下面的二维码，即可一键带入云端数据库和 AI 配置。
          </Text>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12, fontSize: 12 }}
            message="二维码与同步码含数据库访问凭证和 AI 密钥，请像密码一样保管，不要公开分享。"
          />
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="同步二维码"
                width={180}
                height={180}
                style={{ borderRadius: 8, border: '1px solid #eee' }}
              />
            )}
            <div style={{ flex: 1, minWidth: 220 }}>
              <Input.Group compact>
                <Input
                  readOnly
                  style={{ width: 'calc(100% - 80px)' }}
                  value={syncCodeValue}
                />
                <Button
                  style={{ width: 80 }}
                  icon={<CopyOutlined />}
                  onClick={() => {
                    navigator.clipboard.writeText(syncCodeValue)
                    message.success('同步码已复制')
                  }}
                >
                  复制
                </Button>
              </Input.Group>
              <Button block style={{ marginTop: 8 }} onClick={() => setImportOpen(true)}>
                从其他设备导入配置（扫码 / 粘贴）
              </Button>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
                换新电脑或手机时：先登录账号 → 点上面按钮扫码 → 自动填入配置并拉取云端数据。
              </Text>
            </div>
          </div>
        </Card>
      )}

      <SyncImportModal open={importOpen} onClose={() => setImportOpen(false)} onDecoded={handleDecodedImport} />

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
  const account = useAuthStore((s) => s.account)
  const [memoryLines, setMemoryLines] = useState('')

  // 加载结构化记忆（旧版纯文本自动迁移）
  useEffect(() => {
    if (!account) return
    importLegacyMemory(account.id, settings.ai.memory)
    setMemoryLines(listMemory(account.id).map((e) => `- ${e.text}`).join('\n'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id])

  const handleMemoryChange = (val: string) => {
    setMemoryLines(val)
    if (!account) return
    replaceAllMemory(
      account.id,
      val.split('\n').map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim()).filter(Boolean),
    )
  }

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
        message="接入通用大模型接口"
        description="填写模型服务商提供的接口地址（Base URL）、API Key 与模型名即可。本应用支持业界通用的 chat/completions 接口格式，国内外主流服务商均可使用，具体以你的服务商文档为准。"
      />
      <Form layout="vertical">
        <Form.Item label="Base URL">
          <Input
            placeholder="https://api.你的服务商.com/v1"
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
            placeholder="填写服务商文档中的模型名称"
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
              <Tag color={settings.ai.customPrompt ? 'green' : 'default'} style={{ fontSize: 11 }}>
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
              {account && listMemory(account.id).length > 0 && (
                <Tag color="green" style={{ fontSize: 11 }}>
                  已记忆 {listMemory(account.id).length} 条
                </Tag>
              )}
            </Space>
          }
          help="AI 会记住这些信息并在每次对话中参考（每行一条）。AI 也可在对话中自动增删改单条记忆。"
        >
          <Input.TextArea
            rows={6}
            placeholder={'例如：\n- 用户偏好用表格形式展示统计结果\n- 常用管理库是「联系人管理」\n- 日期格式偏好 YYYY-MM-DD'}
            value={memoryLines}
            onChange={(e) => handleMemoryChange(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </Form.Item>
        <Space>
          <Button
            size="small"
            danger
            disabled={!memoryLines}
            onClick={() => {
              if (account) clearMemory(account.id)
              setMemoryLines('')
              message.success('已清空记忆')
            }}
          >
            清空记忆
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            记忆按账号存储在本地浏览器中，跨会话保留。
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
