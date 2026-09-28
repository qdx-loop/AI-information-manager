import { useCallback, useEffect, useState } from 'react'
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
  SwapOutlined,
  HistoryOutlined,
  RollbackOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'
import { useLibraryStore } from '@/store/libraryStore'
import { pushLocalToCloud, mergeCloudToLocal, syncBidirectional } from '@/db/syncService'
import { friendlyDbError } from '@/utils/dbErrors'
import { initFromSettings } from '@/db/providerFactory'
import { apiChangePassword } from '@/lib/serverApi'
import { exportBackup, importBackup } from '@/db/backup'
import {
  createSnapshot,
  listSnapshots,
  restoreSnapshot,
  deleteSnapshot,
  MAX_SNAPSHOTS,
  type SnapshotSummary,
} from '@/db/snapshotService'
import { SYSTEM_PROMPT } from '@/ai/contextBuilder'
import { importLegacyMemory, listMemory, replaceAllMemory, clearMemory } from '@/ai/memory'
import FaceToFaceSyncModal from '@/components/settings/FaceToFaceSyncModal'
import { useI18n } from '@/i18n'

const { Text } = Typography

export default function SettingsPage() {
  const t = useI18n()
  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
      <Card>
        <Tabs
          items={[
            { key: 'account', label: t('settings.tab.account'), children: <AccountTab /> },
            { key: 'storage', label: t('settings.tab.storage'), children: <StorageTab /> },
            { key: 'configsync', label: t('settings.tab.configsync'), children: <ConfigSyncTab /> },
            { key: 'ai', label: t('settings.tab.ai'), children: <AITab /> },
            { key: 'backup', label: t('settings.tab.backup'), children: <BackupTab /> },
          ]}
        />
      </Card>
    </div>
  )
}

function AccountTab() {
  const { message } = App.useApp()
  const t = useI18n()
  const { account, logout } = useAuthStore()
  const [pwdOpen, setPwdOpen] = useState(false)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)

  const handleChangePwd = async () => {
    if (!oldPwd) {
      message.warning(t('settings.account.warn.old'))
      return
    }
    if (newPwd.length < 6) {
      message.warning(t('settings.account.warn.min6'))
      return
    }
    if (oldPwd === newPwd) {
      message.warning(t('settings.account.warn.same'))
      return
    }
    setPwdLoading(true)
    try {
      await apiChangePassword(oldPwd, newPwd)
      message.success(t('settings.account.pwdChanged'))
      setOldPwd('')
      setNewPwd('')
      setPwdOpen(false)
    } catch (e) {
      message.error(t('settings.account.changeFailed', { msg: (e as Error).message }))
    } finally {
      setPwdLoading(false)
    }
  }

  return (
    <div>
      {account && (
        <Card size="small" style={{ marginBottom: 16, maxWidth: 480 }}>
          <Space direction="vertical" size={4}>
            <span>
              {t('settings.account.current')}<Text strong>{account.username}</Text>
            </span>
            {account.contact && (
              <span>
                {t('settings.account.contact')}
                <Text strong>{account.contact}</Text>
              </span>
            )}
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('settings.account.freeForeverHint')}
            </Text>
          </Space>
        </Card>
      )}

      <Space style={{ marginBottom: 16 }}>
        <Button icon={<UserOutlined />} onClick={() => setPwdOpen(true)} disabled={!account}>
          {t('settings.account.changePwd')}
        </Button>
        <Button danger onClick={() => logout()}>
          {t('settings.account.logout')}
        </Button>
      </Space>

      {pwdOpen && (
        <Card size="small" title={t('settings.account.pwdCard')} style={{ marginBottom: 16, maxWidth: 400 }}>
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
              {t('settings.account.pwdConfirm')}
            </Button>
            <Button onClick={() => { setPwdOpen(false); setOldPwd(''); setNewPwd('') }}>{t('common.cancel')}</Button>
          </Space>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            {t('settings.account.pwdOnlyYou')}
          </Text>
        </Card>
      )}

      <Alert
        type="info"
        showIcon
        style={{ maxWidth: 480 }}
        message={t('settings.account.pwdInfo.title')}
        description={t('settings.account.pwdInfo.body')}
      />
    </div>
  )
}

function StorageTab() {
  const { message, modal } = App.useApp()
  const t = useI18n()
  const { settings, setStorageMode, setCloud } = useAppStore()
  const { account } = useAuthStore()
  const [syncing, setSyncing] = useState(false)

  const handleSync = (direction: 'push' | 'pull') => {
    if (!account) {
      message.warning(t('settings.storage.warn.login'))
      return
    }
    if (!settings.cloud.url || !settings.cloud.anonKey) {
      message.warning(t('settings.storage.warn.creds'))
      return
    }
    modal.confirm({
      title: direction === 'push' ? t('settings.storage.confirm.pushTitle') : t('settings.storage.confirm.pullTitle'),
      content:
        direction === 'push'
          ? t('settings.storage.confirm.pushBody')
          : t('settings.storage.confirm.pullBody'),
      okText: direction === 'push' ? t('settings.storage.confirm.pushOk') : t('settings.storage.confirm.pullOk'),
      onOk: async () => {
        setSyncing(true)
        try {
          if (direction === 'push') {
            message.loading({ content: t('settings.storage.doing.bidir'), key: 'sync', duration: 0 })
            const r = await syncBidirectional(account.id, settings.cloud)
            message.success({
              content: t('settings.storage.done.bidir', { libs: r.addedLibraries, items: r.addedItems, updated: r.updatedItems }),
              key: 'sync',
              duration: 6,
            })
          } else {
            message.loading({ content: t('settings.storage.doing.pull'), key: 'sync', duration: 0 })
            const r = await mergeCloudToLocal(account.id, settings.cloud)
            await useLibraryStore.getState().loadLibraries()
            await useLibraryStore.getState().refreshCurrent()
            useLibraryStore.getState().bumpDataVersion()
            message.success({
              content: t('settings.storage.done.pull', { libs: r.addedLibraries, fields: r.addedFields, items: r.addedItems, updated: r.updatedItems }),
              key: 'sync',
              duration: 6,
            })
          }
        } catch (e) {
          message.error({ content: t('settings.storage.failed', { msg: friendlyDbError(e) }), key: 'sync' })
        } finally {
          setSyncing(false)
        }
      },
    })
  }

  const handleToggle = (checked: boolean) => {
    const mode = checked ? 'cloud' : 'local'
    if (mode === 'cloud' && (!settings.cloud.url || !settings.cloud.anonKey)) {
      message.warning(t('settings.storage.warn.creds'))
      return
    }
    if (!account) {
      message.warning(t('settings.storage.warn.login'))
      return
    }
    modal.confirm({
      title: checked ? t('settings.storage.toggle.cloudTitle') : t('settings.storage.toggle.localTitle'),
      content: checked ? t('settings.storage.toggle.cloudBody') : t('settings.storage.toggle.localBody'),
      okText: t('settings.storage.toggle.ok'),
      onOk: async () => {
        try {
          if (mode === 'cloud') {
            // 先合并云端（新者胜），再上传本地——切换动作不会用本机旧副本覆盖云端的较新修改
            message.loading({ content: t('settings.storage.mergingCloud'), key: 'migrate', duration: 0 })
            const r = await mergeCloudToLocal(account.id, settings.cloud)
            setStorageMode(mode)
            initFromSettings(useAppStore.getState().settings)
            message.loading({ content: t('settings.storage.uploadingLocal'), key: 'migrate', duration: 0 })
            await pushLocalToCloud(account.id, settings.cloud)
            await useLibraryStore.getState().loadLibraries()
            await useLibraryStore.getState().refreshCurrent()
            useLibraryStore.getState().bumpDataVersion()
            message.success({
              content: t('settings.storage.toggleDone.cloud', { libs: r.addedLibraries, items: r.addedItems, updated: r.updatedItems }),
              key: 'migrate',
              duration: 6,
            })
          } else {
            message.loading({ content: t('settings.storage.pullingCloud'), key: 'migrate', duration: 0 })
            const r = await mergeCloudToLocal(account.id, settings.cloud)
            setStorageMode(mode)
            initFromSettings(useAppStore.getState().settings)
            message.success({
              content: t('settings.storage.toggleDone.local', { libs: r.addedLibraries, items: r.addedItems, updated: r.updatedItems }),
              key: 'migrate',
              duration: 6,
            })
          }
          // 刷新 libraryStore 数据，避免 window.location.reload() 整页刷新
          await useLibraryStore.getState().loadLibraries()
          useLibraryStore.getState().bumpDataVersion()
          // 切换存储模式后清空当前库选中状态（数据源已变，旧 fields/items 无意义）
          useLibraryStore.setState({ currentLibraryId: null, fields: [], items: [], trash: [], focusItemId: null })
        } catch (e) {
          message.error({ content: t('settings.storage.toggleFailed', { msg: (e as Error).message }), key: 'migrate' })
        }
      },
    })
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <Space align="center" style={{ marginBottom: 16 }}>
        <Switch checked={settings.storageMode === 'cloud'} onChange={handleToggle} />
        <Text strong>
          {settings.storageMode === 'cloud' ? t('settings.storage.mode.cloudOn') : t('settings.storage.mode.localOn')}
        </Text>
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('settings.storage.info.title')}
        description={t('settings.storage.info.body')}
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

      <Card size="small" title={t('settings.storage.sqlTitle')} style={{ marginTop: 8 }}>
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
  deleted_at bigint,
  parent_id uuid
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
          title={t('settings.storage.syncTitle')}
          style={{ marginTop: 16 }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <CloudOutlined /> {t('settings.storage.currentMode')}{settings.storageMode === 'cloud' ? t('settings.storage.mode.cloud') : t('settings.storage.mode.local')}
              {account ? t('settings.storage.accountLabel') + account.username : ''}
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
                {t('settings.storage.btn.bidirectional')}
              </Button>
              <Button
                icon={<DownloadOutlined />}
                loading={syncing}
                onClick={() => handleSync('pull')}
                disabled={!account}
              >
                {t('settings.storage.btn.pull')}
              </Button>
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <SyncOutlined /> {t('settings.storage.hint.sync')}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('settings.storage.hint.qr')}
            </Text>
          </Space>
        </Card>
      ) : null}
    </div>
  )
}

// 「数据同步」标签页：同一局域网内两台设备登录同一账号、连接同一 Wi-Fi，
// 经 WebRTC 数据通道直连，互传并合并全部数据（库数据 + AI / 云端配置），全程不经过服务器。
function ConfigSyncTab() {
  const t = useI18n()
  const [f2fOpen, setF2fOpen] = useState(false)

  return (
    <div style={{ maxWidth: 560 }}>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <div style={{ minWidth: 220, flex: 1 }}>
            <Text strong style={{ display: 'block' }}>{t('settings.f2f.card.title')}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{t('settings.f2f.card.body')}</Text>
          </div>
          <Button type="primary" icon={<SwapOutlined />} onClick={() => setF2fOpen(true)}>
            {t('settings.f2f.card.btn')}
          </Button>
        </Space>
      </Card>

      <FaceToFaceSyncModal open={f2fOpen} onClose={() => setF2fOpen(false)} />
    </div>
  )
}

function AITab() {
  const { message } = App.useApp()
  const t = useI18n()
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
      message.success(t('settings.ai.test.platformOk'))
      return
    }
    if (!settings.ai.baseUrl || !settings.ai.apiKey || !settings.ai.model) {
      message.warning(t('settings.ai.test.fillAll'))
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
      if (res.ok) message.success(t('settings.ai.test.ok'))
      else message.error(t('settings.ai.test.fail', { status: res.status }))
    } catch (e) {
      message.error(t('settings.ai.test.failMsg', { msg: (e as Error).message }))
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('settings.ai.info.title')}
        description={
          usingPlatform
            ? t('settings.ai.info.platform')
            : t('settings.ai.info.custom')
        }
      />
      {usingPlatform && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('settings.ai.platform.warn')}
        />
      )}

      <Form layout="vertical">
        <Form.Item label={t('settings.ai.radio.label')}>
          <Radio.Group
            value={usingPlatform ? 'platform' : 'custom'}
            onChange={(e) => setAI({ usePlatformAI: e.target.value === 'platform' })}
            optionType="button"
            buttonStyle="solid"
            options={[
              { label: platformEnabled === true ? t('settings.ai.radio.platform') : t('settings.ai.radio.platformOff'), value: 'platform', disabled: platformEnabled !== true },
              { label: t('settings.ai.radio.custom'), value: 'custom' },
            ]}
          />
        </Form.Item>
      </Form>

      {!usingPlatform && (
        <>
      <Form layout="vertical">
        <Form.Item label={t('settings.ai.baseUrl')}>
          <Input
            placeholder="https://api.你的服务商.com/v1"
            value={settings.ai.baseUrl}
            onChange={(e) => setAI({ baseUrl: e.target.value })}
          />
        </Form.Item>
        <Form.Item label={t('settings.ai.apiKey')}>
          <Input.Password
            placeholder="sk-..."
            value={settings.ai.apiKey}
            onChange={(e) => setAI({ apiKey: e.target.value })}
          />
        </Form.Item>
        <Form.Item label={t('settings.ai.model')}>
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
          <Button type="primary" onClick={() => message.success(t('settings.ai.saved'))}>
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
              <Text strong>{t('settings.ai.prompt.label')}</Text>
              <Tag color={settings.ai.customPrompt ? 'green' : 'default'} style={{ fontSize: 11 }}>
                {settings.ai.customPrompt ? t('settings.ai.prompt.custom') : t('settings.ai.prompt.default')}
              </Tag>
            </Space>
          }
          help={t('settings.ai.prompt.help')}
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
              message.success(t('settings.ai.prompt.resetDone'))
            }}
          >
            {t('settings.ai.prompt.reset')}
          </Button>
          <Button
            size="small"
            onClick={() => {
              setAI({ customPrompt: SYSTEM_PROMPT })
              message.success(t('settings.ai.prompt.loadedDefault'))
            }}
          >
            {t('settings.ai.prompt.loadDefault')}
          </Button>
        </Space>
      </Form>

      <Divider />

      <Form layout="vertical">
        <Form.Item
          label={
            <Space>
              <Text strong>{t('settings.ai.memory.label')}</Text>
              {account && listMemory(account.id).length > 0 && (
                <Tag color="green" style={{ fontSize: 11 }}>
                  {t('settings.ai.memory.count', { n: listMemory(account.id).length })}
                </Tag>
              )}
            </Space>
          }
          help={t('settings.ai.memory.help')}
        >
          <Input.TextArea
            rows={6}
            placeholder={t('settings.ai.memory.placeholder')}
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
              message.success(t('settings.ai.memory.cleared'))
            }}
          >
            {t('settings.ai.memory.clear')}
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('settings.ai.memory.localNote')}
          </Text>
        </Space>
      </Form>
    </div>
  )
}

function BackupTab() {
  const { message, modal } = App.useApp()
  const t = useI18n()
  const { account } = useAuthStore()
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([])
  const [snapLoading, setSnapLoading] = useState(false)

  const refreshSnapshots = useCallback(async () => {
    if (!account) return
    try {
      setSnapshots(await listSnapshots(account.id))
    } catch {
      setSnapshots([])
    }
  }, [account])

  useEffect(() => {
    void refreshSnapshots()
  }, [refreshSnapshots])

  const triggerLabel = (tr: SnapshotSummary['trigger']): string => {
    switch (tr) {
      case 'manual': return t('settings.snap.trigger.manual')
      case 'transfer': return t('settings.snap.trigger.transfer')
      case 'import': return t('settings.snap.trigger.import')
      case 'pre-restore': return t('settings.snap.trigger.preRestore')
      default: return tr
    }
  }

  const handleManualSnapshot = async () => {
    if (!account) return
    setSnapLoading(true)
    try {
      await createSnapshot(account.id, 'manual')
      message.success(t('settings.snap.created'))
      await refreshSnapshots()
    } catch (e) {
      message.error(t('settings.snap.createFailed', { msg: (e as Error).message }))
    } finally {
      setSnapLoading(false)
    }
  }

  const handleRestoreSnapshot = (s: SnapshotSummary) => {
    if (!account) return
    modal.confirm({
      title: t('settings.snap.restore.title'),
      content: t('settings.snap.restore.body', { time: dayjs(s.createdAt).format('YYYY-MM-DD HH:mm') }),
      okText: t('settings.snap.restore.ok'),
      okType: 'danger',
      onOk: async () => {
        try {
          await restoreSnapshot(account.id, s.id)
          message.success(t('settings.snap.restore.done'))
          setTimeout(() => window.location.reload(), 1000)
        } catch (e) {
          message.error(t('settings.snap.restore.failed', { msg: (e as Error).message }))
        }
      },
    })
  }

  const handleDeleteSnapshot = (s: SnapshotSummary) => {
    if (!account) return
    modal.confirm({
      title: t('settings.snap.delete.title'),
      content: t('settings.snap.delete.body'),
      okText: t('settings.snap.delete.ok'),
      okType: 'danger',
      onOk: async () => {
        await deleteSnapshot(account.id, s.id)
        await refreshSnapshots()
      },
    })
  }

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
    // TWA/安卓 WebView 中下载是异步启动的：立即 revoke 会导致下载失败/空文件（桌面 Chrome 宽容但移动端不宽容）
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    message.success(t('settings.backup.exported'))
  }

  const handleImport = (file: File) => {
    modal.confirm({
      title: t('settings.backup.confirm.title'),
      content: t('settings.backup.confirm.body'),
      okText: t('settings.backup.confirm.ok'),
      okType: 'danger',
      onOk: async () => {
        try {
          const text = await file.text()
          const blob = JSON.parse(text)
          // 导入前自动拍一张快照，便于回溯（失败不阻断导入）
          try {
            await createSnapshot(account!.id, 'import')
          } catch (e) {
            console.warn('[backup] 导入前快照失败：', e)
          }
          await importBackup(account!.id, blob)
          message.success(t('settings.backup.done'))
          setTimeout(() => window.location.reload(), 1000)
        } catch (e) {
          message.error(t('settings.backup.failed', { msg: (e as Error).message }))
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
        message={t('settings.backup.info.title')}
        description={t('settings.backup.info.body')}
      />
      <Space direction="vertical" style={{ width: '100%' }}>
        <Button icon={<DownloadOutlined />} onClick={handleExport} block>
          {t('settings.backup.export')}
        </Button>
        <Upload beforeUpload={handleImport} showUploadList={false} accept=".json">
          <Button icon={<UploadOutlined />} block>
            {t('settings.backup.import')}
          </Button>
        </Upload>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <DatabaseOutlined /> {t('settings.backup.cloudNote')}
        </Text>
      </Space>

      <Divider style={{ margin: '20px 0 12px' }} />
      <Card size="small" title={<span><HistoryOutlined /> {t('settings.snap.title')}</span>}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('settings.snap.hint', { max: MAX_SNAPSHOTS })}</Text>
          <Button size="small" icon={<PlusOutlined />} loading={snapLoading} onClick={() => void handleManualSnapshot()}>
            {t('settings.snap.create')}
          </Button>
        </Space>

        {snapshots.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>{t('settings.snap.empty')}</Text>
        ) : (
          <div style={{ marginTop: 4 }}>
            {snapshots.map((s) => (
              <div
                key={s.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f0f0', gap: 8 }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Text style={{ fontSize: 13, display: 'block' }}>{dayjs(s.createdAt).format('YYYY-MM-DD HH:mm')}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {triggerLabel(s.trigger)} · {t('settings.snap.counts', { libs: s.libraries, items: s.items })}
                  </Text>
                </div>
                <Space size={4}>
                  <Button size="small" icon={<RollbackOutlined />} onClick={() => handleRestoreSnapshot(s)}>
                    {t('settings.snap.restore.btn')}
                  </Button>
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteSnapshot(s)} />
                </Space>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
