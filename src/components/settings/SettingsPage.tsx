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
  Radio,
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
import { pushLocalToCloud, mergeCloudToLocal, syncBidirectional } from '@/db/syncService'
import { friendlyDbError } from '@/utils/dbErrors'
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
            { key: 'configsync', label: '配置同步', children: <ConfigSyncTab /> },
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
      message.success('密码已修改，请牢记新密码（管理员无法帮你找回）')
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
          修改密码
        </Button>
        <Button danger onClick={() => logout()}>
          退出登录
        </Button>
      </Space>

      {pwdOpen && (
        <Card size="small" title="修改密码" style={{ marginBottom: 16, maxWidth: 400 }}>
          <Input.Password
            placeholder="旧密码（首次修改即卖家发放的初始密码）"
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
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            只有你自己能改密码；管理员无法查看、重置或代改。改完请牢记新密码。
          </Text>
        </Card>
      )}

      <Alert
        type="info"
        showIcon
        style={{ maxWidth: 480 }}
        message="密码安全说明"
        description="你可以随时在这里自行修改密码。卖家只持有发放时的初始密码，无法查看你的新密码，也无法替你重置。"
      />
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
      title: direction === 'push' ? '与云端双向同步？' : '从云端合并数据到本地？',
      content:
        direction === 'push'
          ? '先拉取云端修改并按「修改时间较新者胜」合并到本地，再整体上传——任何一端的修改都不会丢失。'
          : '合并规则：本地缺少的记录直接补入；两边都有的条目以修改时间较新的一方为准；云端已删除的管理库会同步删除。不会丢失任何一边的数据。',
      okText: direction === 'push' ? '双向同步' : '合并拉取',
      onOk: async () => {
        setSyncing(true)
        try {
          if (direction === 'push') {
            message.loading({ content: '正在双向同步…', key: 'sync', duration: 0 })
            const r = await syncBidirectional(account.id, settings.cloud)
            message.success({
              content: `同步完成：新增管理库 ${r.addedLibraries} 个、条目 ${r.addedItems} 条，更新条目 ${r.updatedItems} 条`,
              key: 'sync',
              duration: 6,
            })
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
          message.error({ content: '同步失败：' + friendlyDbError(e), key: 'sync' })
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
            // 先合并云端（新者胜），再上传本地——切换动作不会用本机旧副本覆盖云端的较新修改
            message.loading({ content: '正在合并云端数据…', key: 'migrate', duration: 0 })
            const r = await mergeCloudToLocal(account.id, settings.cloud)
            setStorageMode(mode)
            initFromSettings(useAppStore.getState().settings)
            message.loading({ content: '正在上传本地数据…', key: 'migrate', duration: 0 })
            await pushLocalToCloud(account.id, settings.cloud)
            await useLibraryStore.getState().loadLibraries()
            await useLibraryStore.getState().refreshCurrent()
            message.success({
              content: `已开启云端模式：新增管理库 ${r.addedLibraries} 个、条目 ${r.addedItems} 条，更新条目 ${r.updatedItems} 条`,
              key: 'migrate',
              duration: 6,
            })
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
                type="primary"
                ghost
                icon={<SyncOutlined />}
                loading={syncing}
                onClick={() => handleSync('push')}
                disabled={!account}
              >
                双向同步
              </Button>
              <Button
                icon={<DownloadOutlined />}
                loading={syncing}
                onClick={() => handleSync('pull')}
                disabled={!account}
              >
                仅拉取云端
              </Button>
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <SyncOutlined /> 双向同步：先合并（新者胜）再上传，永不丢数据；仅拉取：云端 → 本地合并
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              跨设备二维码迁移请到「配置同步」标签页。
            </Text>
          </Space>
        </Card>
      ) : null}
    </div>
  )
}

// 「配置同步」标签页：跨设备迁移的统一入口，独立于存储设置。
// 同步码内容自适应——开启云端数据库时打包「数据库 + AI」配置，未开启时只打包 AI 配置。
function ConfigSyncTab() {
  const { message, modal } = App.useApp()
  const { settings, setStorageMode, setCloud, setAI } = useAppStore()
  const { account } = useAuthStore()
  const [importOpen, setImportOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')

  const hasCloud = settings.storageMode === 'cloud' && !!settings.cloud.url && !!settings.cloud.anonKey
  const hasAI = !!(settings.ai.baseUrl || settings.ai.apiKey || settings.ai.model)

  // 未开启云端时，云端字段留空（解码端据此跳过数据库配置的导入）
  const syncCodeValue =
    hasCloud || hasAI
      ? encodeSyncCode({
          cloudUrl: hasCloud ? settings.cloud.url : '',
          cloudKey: hasCloud ? settings.cloud.anonKey : '',
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

  // 扫码/粘贴导入后的完整落地流程：填入配置 → 自动开启云端模式 → 双向同步（先拉取、后上传）
  const applyAndSync = async (d: { cloudUrl: string; cloudKey: string }) => {
    if (!account) return
    const key = 'sync-import'
    try {
      message.loading({ content: '正在开启云端模式…', key, duration: 0 })
      setStorageMode('cloud')
      initFromSettings(useAppStore.getState().settings)

      message.loading({ content: '正在从云端拉取数据…', key, duration: 0 })
      const r = await mergeCloudToLocal(account.id, { url: d.cloudUrl, anonKey: d.cloudKey })

      // 反向上传：把本机（离线期间）已有的数据也推上去，保证两端一致
      message.loading({ content: '正在上传本机数据…', key, duration: 0 })
      await pushLocalToCloud(account.id, { url: d.cloudUrl, anonKey: d.cloudKey })

      await useLibraryStore.getState().loadLibraries()
      await useLibraryStore.getState().refreshCurrent()
      message.success({
        content: `同步完成：新增管理库 ${r.addedLibraries} 个、条目 ${r.addedItems} 条，更新条目 ${r.updatedItems} 条`,
        key,
        duration: 6,
      })
    } catch (e) {
      message.error({
        content: `同步失败：${(e as Error).message}（配置已保存，可到「存储」标签页手动重试）`,
        key,
        duration: 8,
      })
    }
  }

  const handleDecodedImport = (d: {
    cloudUrl: string
    cloudKey: string
    aiBaseUrl: string
    aiApiKey: string
    aiModel: string
  }) => {
    const withCloud = !!(d.cloudUrl && d.cloudKey)
    if (withCloud) {
      setCloud({ url: d.cloudUrl, anonKey: d.cloudKey })
    }
    if (d.aiBaseUrl || d.aiApiKey || d.aiModel) {
      setAI({ baseUrl: d.aiBaseUrl, apiKey: d.aiApiKey, model: d.aiModel })
    }
    setImportOpen(false)

    if (!withCloud) {
      message.success('已导入 AI 配置。')
      return
    }
    if (!account) {
      message.warning('配置已导入。请先登录同一账号，再到本页重新扫码完成数据同步。')
      return
    }

    // 已处于云端模式：静默直接同步；否则确认后自动切换并双向同步
    if (settings.storageMode === 'cloud') {
      void applyAndSync(d)
      return
    }
    modal.confirm({
      title: '导入并立即开启云端同步？',
      content:
        '将自动切换到云端模式：先拉取云端数据到本机，再把本机已有数据上传合并，两端保持一致。',
      okText: '开始同步',
      cancelText: '仅导入配置',
      onOk: () => applyAndSync(d),
      onCancel: () => {
        message.success('配置已导入。需要时在「存储」标签页打开「云端存储模式」开关即可启用同步。')
      },
    })
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="什么是配置同步"
        description="把这台设备的配置打包成二维码/同步码，另一台设备登录同一账号后扫码即可带入。开启云端数据库时会一并包含数据库连接；未开启时只包含 AI 配置。"
      />

      {!syncCodeValue ? (
        <Alert
          type="warning"
          showIcon
          message="还没有可同步的内容"
          description={
            <span>
              请先到「AI 配置」填入接口信息；如需连同数据库一起迁移，再到「存储」标签页开启云端模式。配置好后回到本页生成二维码。
            </span>
          }
        />
      ) : (
        <Card size="small" title="我的同步二维码" style={{ marginBottom: 16 }}>
          <Space wrap size={4} style={{ marginBottom: 12 }}>
            <Tag color={hasCloud ? 'green' : 'default'}>
              云端数据库{hasCloud ? '：已包含' : '：未包含'}
            </Tag>
            <Tag color={hasAI ? 'green' : 'default'}>
              AI 配置{hasAI ? '：已包含' : '：未包含'}
            </Tag>
          </Space>
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
                <Input readOnly style={{ width: 'calc(100% - 80px)' }} value={syncCodeValue} />
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
                换新电脑或手机时：先登录账号 → 点上面按钮扫码 → 自动填入配置并完成同步。
              </Text>
            </div>
          </div>
        </Card>
      )}

      <SyncImportModal open={importOpen} onClose={() => setImportOpen(false)} onDecoded={handleDecodedImport} />
    </div>
  )
}

function AITab() {
  const { message } = App.useApp()
  const { settings, setAI } = useAppStore()
  const account = useAuthStore((s) => s.account)
  const [memoryLines, setMemoryLines] = useState('')
  // 平台代管 AI 是否已在服务端配置（GET /api/ai/proxy 仅返回布尔值）
  const [platformEnabled, setPlatformEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/ai/proxy')
      .then((r) => r.json())
      .then((d: { enabled?: boolean }) => setPlatformEnabled(!!d.enabled))
      .catch(() => setPlatformEnabled(false))
  }, [])

  const usingPlatform = !!settings.ai.usePlatformAI && platformEnabled === true

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
    if (usingPlatform) {
      message.success(platformEnabled ? '平台 AI 可用' : '平台 AI 未启用')
      return
    }
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
        message="接入大模型"
        description={
          usingPlatform
            ? '当前使用平台提供的 AI 服务，无需任何配置，直接打开 AI 助手即可使用。'
            : '推荐使用「平台提供」方式——无需注册和密钥，开箱即用。也可以填入你自己的模型服务商接口（Base URL、API Key 与模型名）。'
        }
      />

      <Form layout="vertical">
        <Form.Item label="连接方式">
          <Radio.Group
            value={usingPlatform ? 'platform' : 'custom'}
            onChange={(e) => setAI({ usePlatformAI: e.target.value === 'platform' })}
            optionType="button"
            buttonStyle="solid"
            options={[
              { label: platformEnabled === true ? '平台提供（推荐）' : '平台提供（未开放）', value: 'platform', disabled: platformEnabled !== true },
              { label: '我自己的接口', value: 'custom' },
            ]}
          />
        </Form.Item>
      </Form>

      {!usingPlatform && (
        <>
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
        </>
      )}

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
        description="导出全部管理库、字段模板、条目为 JSON 文件——不依赖云端数据库，可作为不开云端时的手动「换机同步」方式。恢复时将覆盖本机当前账户数据。"
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
