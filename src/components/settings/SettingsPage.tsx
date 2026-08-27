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
import { useI18n } from '@/i18n'
import QRCode from 'qrcode'

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

  const daysLeft = account?.expiresAt ? Math.floor((account.expiresAt - Date.now()) / 86400000) : null

  return (
    <div>
      {account && (
        <Card size="small" style={{ marginBottom: 16, maxWidth: 480 }}>
          <Space direction="vertical" size={4}>
            <span>
              {t('settings.account.current')}<Text strong>{account.username}</Text>
            </span>
            {account.expiresAt && (
              <span>
                {t('settings.account.validUntil')}
                <Tag color={daysLeft !== null && daysLeft <= 3 ? 'orange' : 'green'}>
                  {dayjs(account.expiresAt).format('YYYY-MM-DD HH:mm')}
                  {daysLeft !== null && daysLeft >= 0 ? t('settings.account.daysLeft', { n: daysLeft }) : ''}
                </Tag>
              </span>
            )}
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('settings.account.expireHint')}
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

// 「配置同步」标签页：跨设备迁移的统一入口，独立于存储设置。
// 同步码内容自适应——开启云端数据库时打包「数据库 + AI」配置，未开启时只打包 AI 配置。
function ConfigSyncTab() {
  const { message, modal } = App.useApp()
  const t = useI18n()
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
      message.loading({ content: t('settings.sync.enabling'), key, duration: 0 })
      setStorageMode('cloud')
      initFromSettings(useAppStore.getState().settings)

      message.loading({ content: t('settings.sync.fetching'), key, duration: 0 })
      const r = await mergeCloudToLocal(account.id, { url: d.cloudUrl, anonKey: d.cloudKey })

      // 反向上传：把本机（离线期间）已有的数据也推上去，保证两端一致
      message.loading({ content: t('settings.sync.uploading'), key, duration: 0 })
      await pushLocalToCloud(account.id, { url: d.cloudUrl, anonKey: d.cloudKey })

      await useLibraryStore.getState().loadLibraries()
      await useLibraryStore.getState().refreshCurrent()
      message.success({
        content: t('settings.sync.done', { libs: r.addedLibraries, items: r.addedItems, updated: r.updatedItems }),
        key,
        duration: 6,
      })
    } catch (e) {
      message.error({
        content: t('settings.sync.failedRetry', { msg: friendlyDbError(e) }),
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
      message.success(t('settings.sync.importedAiOnly'))
      return
    }
    if (!account) {
      message.warning(t('settings.sync.importedNeedLogin'))
      return
    }

    // 已处于云端模式：静默直接同步；否则确认后自动切换并双向同步
    if (settings.storageMode === 'cloud') {
      void applyAndSync(d)
      return
    }
    modal.confirm({
      title: t('settings.sync.importTitle'),
      content:
        t('settings.sync.importBody'),
      okText: t('settings.sync.importOk'),
      cancelText: t('settings.sync.importCancel'),
      onOk: () => applyAndSync(d),
      onCancel: () => {
        message.success(t('settings.sync.importCancelled'))
      },
    })
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('settings.sync.title')}
        description={t('settings.sync.body')}
      />

      {!syncCodeValue ? (
        <Alert
          type="warning"
          showIcon
          message={t('settings.sync.none.title')}
          description={
            <span>
              {t('settings.sync.none.body')}
            </span>
          }
        />
      ) : (
        <Card size="small" title={t('settings.sync.myQr')} style={{ marginBottom: 16 }}>
          <Space wrap size={4} style={{ marginBottom: 12 }}>
            <Tag color={hasCloud ? 'green' : 'default'}>
              {hasCloud ? t('settings.sync.included.cloud') : t('settings.sync.excluded.cloud')}
            </Tag>
            <Tag color={hasAI ? 'green' : 'default'}>
              {hasAI ? t('settings.sync.included.ai') : t('settings.sync.excluded.ai')}
            </Tag>
          </Space>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12, fontSize: 12 }}
            message={t('settings.sync.qrWarning')}
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
                    message.success(t('settings.sync.codeCopied'))
                  }}
                >
                  复制
                </Button>
              </Input.Group>
              <Button block style={{ marginTop: 8 }} onClick={() => setImportOpen(true)}>
                {t('settings.sync.importBtn')}
              </Button>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
                {t('settings.sync.flowHint')}
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
    </div>
  )
}
