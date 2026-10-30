import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Form, Input, Button, Switch, Space, App, Upload, Radio, Grid, Tabs } from 'antd'
import {
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
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { resetSession } from '@/store/session'
import { useAppStore } from '@/store/appStore'
import { useLibraryStore } from '@/store/libraryStore'
import { pushLocalToCloud, mergeCloudToLocal, syncBidirectional } from '@/db/syncService'
import { friendlyDbError } from '@/utils/dbErrors'
import { initFromSettings } from '@/db/providerFactory'
import { apiChangePassword } from '@/lib/serverApi'
import { exportBackup, importBackup, validateBackupBlob } from '@/db/backup'
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
import RewardCard from '@/components/reward/RewardCard'
import { noteBackupExported } from '@/utils/support'
import { autoSyncManager } from '@/utils/autoSync'
import { useI18n } from '@/i18n'
import { downloadBlob } from '@/utils/csv'

/**
 * 设置页 ·『官纸账簿』
 *
 * 桌面：左侧 180px 垂直目录（6 项，选中 = 2px 朱砂左线 + 墨字），右侧单列表单 max-width 640，
 *        组间 32px + 1px 账线。移动端回退为 Tabs（保留，因为窄屏目录会占掉半屏）。
 * 第 6 项「关于与支持」支持 `?tab=support` 直达（帮助页/落地页的文末链接指向这里）。
 *
 * 视觉原则：不用 Card 包裹、不用彩色 Alert 色块、不用 Tag 胶囊；
 * 说明类信息一律「文字 + 左侧朱砂/赭色细线」，危险操作放底部。
 */

type TabKey = 'account' | 'ai' | 'backup' | 'configsync' | 'storage' | 'support'

const TAB_LABEL: Record<TabKey, string> = {
  account: 'settings.tab.account',
  ai: 'settings.tab.ai',
  backup: 'settings.tab.backup',
  configsync: 'settings.tab.configsync',
  storage: 'settings.tab.storage',
  support: 'settings.tab.about',
}

const TAB_ORDER: TabKey[] = ['account', 'ai', 'backup', 'configsync', 'storage', 'support']

/** 说明块：2px 左线 + 一行文字，替代彩色 Alert 色块（不只靠颜色，也不加盒子阴影） */
function Notice({
  kind = 'info',
  title,
  children,
}: {
  kind?: 'info' | 'warning' | 'danger'
  title?: string
  children: React.ReactNode
}) {
  const color =
    kind === 'warning'
      ? 'var(--app-warning)'
      : kind === 'danger'
        ? 'var(--app-danger)'
        : 'var(--app-border-strong)'
  return (
    <div
      style={{
        borderLeft: `2px solid ${color}`,
        paddingLeft: 12,
        marginBottom: 20,
        fontSize: 13,
        lineHeight: 1.7,
        color: 'var(--app-ink-soft)',
      }}
    >
      {title && (
        <div style={{ fontWeight: 600, color: 'var(--app-ink)', marginBottom: 2 }}>{title}</div>
      )}
      {children}
    </div>
  )
}

/** 组标题：20 衬线 + 一行说明 */
function GroupTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 className="serif" style={{ fontSize: 20, fontWeight: 600, margin: 0, color: 'var(--app-ink)' }}>
        {title}
      </h2>
      {desc && (
        <p className="muted" style={{ fontSize: 13, margin: '4px 0 0', lineHeight: 1.6 }}>
          {desc}
        </p>
      )}
    </div>
  )
}

/**
 * 同步此前只往 console 写，界面上毫无反馈：
 * 用户改完数据切到别的设备，发现数据没过去，
 * 唯一能得出的结论是「云同步坏了」，而其实可能只是还没到 3 分钟。
 * 这里把「未启用 / 空闲 / 正在同步 / 上次成功于何时 / 失败原因」摊开成一行状态文字。
 */
function SyncStatusBanner() {
  const t = useI18n()
  const st = useSyncExternalStore(autoSyncManager.subscribe, autoSyncManager.getStatus)

  useEffect(() => {
    autoSyncManager.refreshEnabled()
  }, [])

  const when = st.at ? new Date(st.at).toLocaleString() : ''
  if (st.phase === 'off') {
    return (
      <div style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--app-ink-faint)' }}>
        <span style={{ color: 'var(--app-ink-soft)' }}>{t('settings.sync.off')}</span>
        {' · '}
        {t('settings.sync.offDesc')}
      </div>
    )
  }
  if (st.phase === 'error') {
    return (
      <div
        style={{
          borderLeft: '2px solid var(--app-danger)',
          paddingLeft: 10,
          fontSize: 12.5,
          lineHeight: 1.7,
          color: 'var(--app-ink-soft)',
        }}
      >
        <span style={{ color: 'var(--app-danger)', fontWeight: 500 }}>{t('settings.sync.error')}</span>
        {' · '}
        {t('settings.sync.lastOk')}: {when || '—'}
        {st.message ? ` · ${st.message}` : ''}
      </div>
    )
  }
  if (st.phase === 'syncing') {
    return (
      <div style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--app-ink-soft)' }}>
        <SyncOutlined style={{ marginRight: 6, fontSize: 12 }} />
        {t('settings.sync.syncing')} · {t('settings.sync.syncingDesc')}
      </div>
    )
  }
  return (
    <div style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--app-ink-faint)' }}>
      <CloudOutlined style={{ marginRight: 6, fontSize: 12 }} />
      {t('settings.sync.ok')} · {t('settings.sync.lastOk')}: {when || t('settings.sync.never')}
    </div>
  )
}

export default function SettingsPage() {
  const t = useI18n()
  const [search] = useSearchParams()
  const screens = Grid.useBreakpoint()
  const wide = !!screens.lg

  const fromUrl = search.get('tab') as TabKey | null
  const [tab, setTab] = useState<TabKey>(
    fromUrl && TAB_ORDER.includes(fromUrl) ? fromUrl : 'account',
  )

  const select = (k: TabKey) => {
    setTab(k)
    // 刷新/分享后仍停在同一个分区（用 replaceState，不产生历史记录）
    const u = new URL(window.location.href)
    u.searchParams.set('tab', k)
    window.history.replaceState(null, '', u.toString())
  }

  const items = TAB_ORDER.map((k) => ({ key: k, label: t(TAB_LABEL[k]) }))

  const panels: Record<TabKey, React.ReactNode> = {
    account: <AccountTab />,
    ai: <AITab />,
    backup: <BackupTab />,
    configsync: <ConfigSyncTab />,
    storage: <StorageTab />,
    support: <RewardCard />,
  }

  return (
    <div style={{ padding: wide ? '24px 32px 48px' : 16, height: '100%', overflow: 'auto' }}>
      <header style={{ marginBottom: 28 }}>
        <h1 className="serif page-title" style={{ margin: 0 }}>
          {t('settings.pageTitle')}
        </h1>
        <div style={{ marginTop: 8 }}>
          <SyncStatusBanner />
        </div>
      </header>

      {wide ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '180px minmax(0, 1fr)',
            gap: 48,
            alignItems: 'start',
          }}
        >
          <nav aria-label={t('settings.pageTitle')}>
            {items.map((it) => {
              const active = it.key === tab
              return (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => select(it.key as TabKey)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    borderLeft: active
                      ? '2px solid var(--app-accent)'
                      : '2px solid transparent',
                    padding: '7px 0 7px 10px',
                    marginBottom: 2,
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: 13,
                    color: active ? 'var(--app-ink)' : 'var(--app-ink-soft)',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {it.label}
                </button>
              )
            })}
          </nav>
          <div style={{ maxWidth: 640 }}>{panels[tab]}</div>
        </div>
      ) : (
        <div style={{ maxWidth: 640 }}>
          <Tabs
            activeKey={tab}
            onChange={(k) => select(k as TabKey)}
            items={items.map((it) => ({
              key: it.key,
              label: it.label,
              children: it.key === tab ? panels[tab] : null,
            }))}
          />
        </div>
      )}
    </div>
  )
}

function AccountTab() {
  const { message } = App.useApp()
  const t = useI18n()
  const navigate = useNavigate()
  const { account } = useAuthStore()
  const [pwdOpen, setPwdOpen] = useState(false)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)

  const handleChangePwd = async () => {
    if (!oldPwd) {
      message.warning(t('settings.account.warn.old'))
      return
    }
    // 与注册一致：改密下限统一 8 位（原来前后端/注册与改密各写一套 6/8）
    if (newPwd.length < 8) {
      message.warning(t('settings.account.warn.min8'))
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
      <GroupTitle title={t('settings.tab.account')} desc={t('settings.account.freeForeverHint')} />

      {account && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13 }}>
            <span className="faint">{t('settings.account.current')}</span>
            <span style={{ fontWeight: 600, color: 'var(--app-ink)' }}>{account.username}</span>
          </div>
          {account.contact && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13, marginTop: 4 }}>
              <span className="faint">{t('settings.account.contact')}</span>
              <span style={{ color: 'var(--app-ink)' }}>{account.contact}</span>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button onClick={() => setPwdOpen((v) => !v)} disabled={!account}>
          {t('settings.account.changePwd')}
        </Button>
      </div>

      {pwdOpen && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--app-rule)' }}>
          <h3 className="serif" style={{ fontSize: 20, fontWeight: 600, margin: '0 0 12px' }}>
            {t('settings.account.pwdCard')}
          </h3>
          <Input.Password
            placeholder={t('settings.account.oldPwdPlaceholder')}
            value={oldPwd}
            onChange={(e) => setOldPwd(e.target.value)}
            autoComplete="current-password"
            style={{ marginBottom: 8 }}
          />
          <Input.Password
            placeholder={t('settings.account.newPwdPlaceholder')}
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            autoComplete="new-password"
            style={{ marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" onClick={handleChangePwd} loading={pwdLoading}>
              {t('settings.account.pwdConfirm')}
            </Button>
            <Button
              onClick={() => {
                setPwdOpen(false)
                setOldPwd('')
                setNewPwd('')
              }}
            >
              {t('common.cancel')}
            </Button>
          </div>
          <p className="faint" style={{ fontSize: 12, margin: '8px 0 0', lineHeight: 1.7 }}>
            {t('settings.account.pwdOnlyYou')}
          </p>
        </div>
      )}

      <p
        className="muted"
        style={{ fontSize: 13, lineHeight: 1.7, margin: '24px 0 0', maxWidth: 480 }}
      >
        <span style={{ fontWeight: 600, color: 'var(--app-ink)' }}>
          {t('settings.account.pwdInfo.title')}
        </span>
        {' · '}
        {t('settings.account.pwdInfo.body')}
      </p>

      {/* 危险区放最底部：退出登录会清空本机会话数据 */}
      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--app-rule)' }}>
        <h3 className="serif" style={{ fontSize: 20, fontWeight: 600, margin: '0 0 12px' }}>
          {t('app.signOut')}
        </h3>
        <Button
          danger
          onClick={async () => {
            // 走统一收口：退出前同步 + 清空库数据（之前这里只清了 token）
            await resetSession()
            navigate('/login')
          }}
        >
          {t('settings.account.logout')}
        </Button>
      </div>
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
      title:
        direction === 'push'
          ? t('settings.storage.confirm.pushTitle')
          : t('settings.storage.confirm.pullTitle'),
      content:
        direction === 'push'
          ? t('settings.storage.confirm.pushBody')
          : t('settings.storage.confirm.pullBody'),
      okText:
        direction === 'push'
          ? t('settings.storage.confirm.pushOk')
          : t('settings.storage.confirm.pullOk'),
      onOk: async () => {
        setSyncing(true)
        try {
          if (direction === 'push') {
            message.loading({ content: t('settings.storage.doing.bidir'), key: 'sync', duration: 0 })
            const r = await syncBidirectional(account.id, settings.cloud)
            message.success({
              content: t('settings.storage.done.bidir', {
                libs: r.addedLibraries,
                items: r.addedItems,
                updated: r.updatedItems,
              }),
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
              content: t('settings.storage.done.pull', {
                libs: r.addedLibraries,
                fields: r.addedFields,
                items: r.addedItems,
                updated: r.updatedItems,
              }),
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
              content: t('settings.storage.toggleDone.cloud', {
                libs: r.addedLibraries,
                items: r.addedItems,
                updated: r.updatedItems,
              }),
              key: 'migrate',
              duration: 6,
            })
          } else {
            message.loading({ content: t('settings.storage.pullingCloud'), key: 'migrate', duration: 0 })
            const r = await mergeCloudToLocal(account.id, settings.cloud)
            setStorageMode(mode)
            initFromSettings(useAppStore.getState().settings)
            message.success({
              content: t('settings.storage.toggleDone.local', {
                libs: r.addedLibraries,
                items: r.addedItems,
                updated: r.updatedItems,
              }),
              key: 'migrate',
              duration: 6,
            })
          }
          // 刷新 libraryStore 数据，避免 window.location.reload() 整页刷新
          await useLibraryStore.getState().loadLibraries()
          useLibraryStore.getState().bumpDataVersion()
          // 切换存储模式后清空当前库选中状态（数据源已变，旧 fields/items 无意义）
          useLibraryStore.setState({
            currentLibraryId: null,
            fields: [],
            items: [],
            trash: [],
            focusItemId: null,
            libsReady: false,
          })
        } catch (e) {
          message.error({ content: t('settings.storage.toggleFailed', { msg: (e as Error).message }), key: 'migrate' })
        }
      },
    })
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <GroupTitle title={t('settings.tab.storage')} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Switch checked={settings.storageMode === 'cloud'} onChange={handleToggle} />
        <span style={{ fontSize: 13, color: 'var(--app-ink)' }}>
          {settings.storageMode === 'cloud'
            ? t('settings.storage.mode.cloudOn')
            : t('settings.storage.mode.localOn')}
        </span>
      </div>

      <Notice kind="warning" title={t('settings.storage.advanced')}>
        {t('settings.storage.info.body')}
      </Notice>

      <Form layout="vertical">
        <Form.Item label={t('settings.storage.url')}>
          <Input
            placeholder="https://xxxx.supabase.co"
            value={settings.cloud.url}
            onChange={(e) => setCloud({ url: e.target.value })}
            disabled={settings.storageMode === 'cloud'}
          />
        </Form.Item>
        <Form.Item label={t('settings.storage.key')}>
          <Input.Password
            placeholder="eyJhbGci..."
            value={settings.cloud.anonKey}
            onChange={(e) => setCloud({ anonKey: e.target.value })}
            disabled={settings.storageMode === 'cloud'}
          />
        </Form.Item>
      </Form>

      {/* 建表 SQL 属于一次性技术步骤：默认折叠，避免把设置页撑成文档页 */}
      <details style={{ margin: '8px 0 24px' }}>
        <summary
          className="mono"
          style={{ cursor: 'pointer', fontSize: 12, color: 'var(--app-ink-soft)', padding: '4px 0' }}
        >
          {t('settings.storage.sqlTitle')}
        </summary>
        <pre
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            maxHeight: 240,
            overflow: 'auto',
            margin: '8px 0 0',
            padding: 12,
            background: 'var(--app-surface-sunken)',
            borderRadius: 2,
            color: 'var(--app-ink)',
          }}
        >
{`-- 已经建过表的话，在 Supabase SQL Editor 里再跑一次这三句补列
alter table libraries add column if not exists updated_at bigint default 0;
alter table fields   add column if not exists updated_at bigint default 0;
alter table fields   add column if not exists deleted_at bigint;

create table accounts (
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
  parent_id uuid,
  updated_at bigint default 0   -- 多设备合并靠它裁决改名/分类/排序
);
create table fields (
  id uuid primary key,
  library_id uuid not null,
  key text, label text, type text,
  options jsonb, required bool, visible bool,
  sort_order int,
  updated_at bigint default 0,  -- 同上
  deleted_at bigint             -- 字段删除的墓碑；没有它删掉的列会在别的设备上复活
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
      </details>

      {settings.cloud.url && settings.cloud.anonKey ? (
        <div style={{ paddingTop: 16, borderTop: '1px solid var(--app-rule)' }}>
          <h3 className="serif" style={{ fontSize: 20, fontWeight: 600, margin: '0 0 12px' }}>
            {t('settings.storage.syncTitle')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="faint" style={{ fontSize: 12 }}>
              {t('settings.storage.currentMode')}
              {settings.storageMode === 'cloud'
                ? t('settings.storage.mode.cloud')
                : t('settings.storage.mode.local')}
              {account ? t('settings.storage.accountLabel') + account.username : ''}
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button
                type="primary"
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
            </div>
            <span className="faint" style={{ fontSize: 12, lineHeight: 1.7 }}>
              {t('settings.storage.hint.sync')}
              <br />
              {t('settings.storage.hint.qr')}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// 「数据同步」分区：同一局域网内两台设备登录同一账号、连接同一 Wi-Fi，
// 经 WebRTC 数据通道直连，互传并合并全部数据（库数据 + AI / 云端配置），全程不经过服务器。
function ConfigSyncTab() {
  const t = useI18n()
  const [f2fOpen, setF2fOpen] = useState(false)

  return (
    <div style={{ maxWidth: 560 }}>
      <GroupTitle title={t('settings.tab.configsync')} desc={t('settings.f2f.card.body')} />
      <Button type="primary" icon={<SwapOutlined />} onClick={() => setF2fOpen(true)}>
        {t('settings.f2f.card.btn')}
      </Button>
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
      val
        .split('\n')
        .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
        .filter(Boolean),
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
      <GroupTitle title={t('settings.tab.ai')} />
      <Notice kind="info" title={t('settings.ai.info.title')}>
        {usingPlatform ? t('settings.ai.info.platform') : t('settings.ai.info.custom')}
      </Notice>
      {usingPlatform && (
        <Notice kind="warning" title={t('settings.ai.platform.warn')}>
          {t('settings.ai.radio.platform')}
        </Notice>
      )}

      <Form layout="vertical">
        <Form.Item label={t('settings.ai.radio.label')}>
          <Radio.Group
            value={usingPlatform ? 'platform' : 'custom'}
            onChange={(e) => setAI({ usePlatformAI: e.target.value === 'platform' })}
            optionType="button"
            buttonStyle="solid"
            options={[
              {
                label:
                  platformEnabled === true
                    ? t('settings.ai.radio.platform')
                    : t('settings.ai.radio.platformOff'),
                value: 'platform',
                disabled: platformEnabled !== true,
              },
              { label: t('settings.ai.radio.custom'), value: 'custom' },
            ]}
          />
        </Form.Item>
      </Form>

      {!usingPlatform && (
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
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button type="primary" icon={<RobotOutlined />} onClick={handleTest}>
              {t('settings.ai.test')}
            </Button>
            <span className="faint" style={{ fontSize: 12 }}>
              {t('settings.ai.autosave')}
            </span>
          </div>
        </Form>
      )}

      <div style={{ margin: '24px 0 16px', borderTop: '1px solid var(--app-rule)' }} />

      <Form layout="vertical">
        <Form.Item
          label={
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>{t('settings.ai.prompt.label')}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--app-ink-faint)' }}>
                {settings.ai.customPrompt ? t('settings.ai.prompt.custom') : t('settings.ai.prompt.default')}
              </span>
            </span>
          }
          help={t('settings.ai.prompt.help')}
        >
          <Input.TextArea
            rows={6}
            placeholder={SYSTEM_PROMPT}
            value={settings.ai.customPrompt}
            onChange={(e) => setAI({ customPrompt: e.target.value })}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
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

      <div style={{ margin: '24px 0 16px', borderTop: '1px solid var(--app-rule)' }} />

      <Form layout="vertical">
        <Form.Item
          label={
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>{t('settings.ai.memory.label')}</span>
              {account && listMemory(account.id).length > 0 && (
                <span className="mono" style={{ fontSize: 11, color: 'var(--app-ink-faint)' }}>
                  {t('settings.ai.memory.count', { n: listMemory(account.id).length })}
                </span>
              )}
            </span>
          }
          help={t('settings.ai.memory.help')}
        >
          <Input.TextArea
            rows={6}
            placeholder={t('settings.ai.memory.placeholder')}
            value={memoryLines}
            onChange={(e) => handleMemoryChange(e.target.value)}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
          />
        </Form.Item>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
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
          <span className="faint" style={{ fontSize: 12 }}>
            {t('settings.ai.memory.localNote')}
          </span>
        </div>
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
      case 'manual':
        return t('settings.snap.trigger.manual')
      case 'transfer':
        return t('settings.snap.trigger.transfer')
      case 'import':
        return t('settings.snap.trigger.import')
      case 'pre-restore':
        return t('settings.snap.trigger.preRestore')
      default:
        return tr
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
      okButtonProps: { danger: true },
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
      okButtonProps: { danger: true },
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
    // 统一走 downloadBlob：a 必须先挂到文档里再 click，且 revoke 必须延后
    // （TWA/安卓 WebView 里下载是异步启动的，立即 revoke 会得到空文件）。
    downloadBlob(`备份_${dayjs().format('YYYYMMDD_HHmmss')}.json`, file)
    message.success(t('settings.backup.exported'))
    // 价值时刻（R3/M2）：记录「首次成功导出备份」里程碑（support.ts 内部 markMilestone）
    noteBackupExported(account.id)
  }

  const handleImport = (file: File) => {
    modal.confirm({
      title: t('settings.backup.confirm.title'),
      content: t('settings.backup.confirm.body'),
      okText: t('settings.backup.confirm.ok'),
      okButtonProps: { danger: true },
      onOk: async () => {
        const acc = account
        if (!acc) {
          message.error(t('common.sessionExpired'))
          return
        }
        try {
          const text = await file.text()
          const blob = JSON.parse(text)
          // 结构校验必须在任何删除之前（importBackup 内部第一件事就是校验）。
          // 结构不对的 json 会让 provider 先删光账户数据、再什么都不写，
          // 而且不会抛错 —— 用户看到的是「导入成功」。
          validateBackupBlob(blob)
          // 导入前自动拍快照作为回退点。快照失败必须中止：
          // 恢复快照那条路径的既定策略就是「破坏性操作必须确保有回退点」
          // （snapshotService.restoreSnapshot 里写明），这里之前却只打了一条
          // console.warn 就继续删数据。而快照失败最常见的原因恰恰是浏览器
          // 存储配额已满 —— 正是用户最需要回退点的场景。
          try {
            await createSnapshot(acc.id, 'import')
          } catch (e) {
            message.error(t('settings.backup.noSnapshot', { msg: (e as Error).message }))
            return
          }
          await importBackup(acc.id, blob)
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
      <GroupTitle title={t('settings.tab.backup')} desc={t('settings.backup.info.body')} />
      <Notice kind="info" title={t('settings.backup.info.title')}>
        {t('settings.backup.cloudNote')}
      </Notice>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          {t('settings.backup.export')}
        </Button>
        <Upload beforeUpload={handleImport} showUploadList={false} accept=".json">
          <Button icon={<UploadOutlined />}>{t('settings.backup.import')}</Button>
        </Upload>
      </div>

      <div style={{ margin: '28px 0 16px', borderTop: '1px solid var(--app-rule)' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h3 className="serif" style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          <HistoryOutlined style={{ fontSize: 15, marginRight: 6 }} />
          {t('settings.snap.title')}
        </h3>
        <Button size="small" icon={<PlusOutlined />} loading={snapLoading} onClick={() => void handleManualSnapshot()}>
          {t('settings.snap.create')}
        </Button>
      </div>
      <p className="faint" style={{ fontSize: 12, margin: '0 0 8px', lineHeight: 1.7 }}>
        {t('settings.snap.hint', { max: MAX_SNAPSHOTS })}
      </p>

      {snapshots.length === 0 ? (
        <p className="faint" style={{ fontSize: 12, margin: 0 }}>
          {t('settings.snap.empty')}
        </p>
      ) : (
        <div>
          {snapshots.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid var(--app-rule)',
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <span className="mono" style={{ fontSize: 12, color: 'var(--app-ink)', display: 'block' }}>
                  {dayjs(s.createdAt).format('YYYY-MM-DD HH:mm')}
                </span>
                <span className="faint" style={{ fontSize: 12 }}>
                  {triggerLabel(s.trigger)} · {t('settings.snap.counts', { libs: s.libraries, items: s.items })}
                </span>
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

      <p className="faint" style={{ fontSize: 12, margin: '20px 0 0' }}>
        <DatabaseOutlined style={{ marginRight: 6 }} />
        {t('settings.backup.cloudNote')}
      </p>
    </div>
  )
}
