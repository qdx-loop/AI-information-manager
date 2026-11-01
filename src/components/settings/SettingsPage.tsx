import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { App, Button, Switch, Upload } from 'antd'
import {
  CloudOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DownOutlined,
  DownloadOutlined,
  FileTextOutlined,
  HistoryOutlined,
  IdcardOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  PlusOutlined,
  RobotOutlined,
  RollbackOutlined,
  SwapOutlined,
  SyncOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@/components/common/icons'
import {
  HardDriveRegular,
  LockClosedRegular,
  PersonRegular,
  PhoneDesktopRegular,
  SignOutRegular,
  SparkleRegular,
} from '@fluentui/react-icons'
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
 * 设置页 · v9 Windows 11「设置」原生应用
 *
 * 结构：页头「设置」+ 左侧 208px 设置式分类列表（卡片容器，选中项左侧 3px 强调条）
 *       + 右侧 Win11 设置卡片（组标题 + 设置行：图标 / 标题 14 / 说明 12 / 右侧控件）。
 * 旧的编号索引（INDEX / 01 / ACCOUNT）与英文 kicker 已全部删除。
 *
 * 数据与行为完全保留：改密、存储模式切换与双向/拉取同步、局域网互传、
 * AI 平台/自定义接入与记忆、备份导入导出、快照存取删、退出登录。
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

/** 分类图标（Win11 Settings NavigationView 风格） */
const TAB_ICON: Record<TabKey, React.ComponentType> = {
  account: PersonRegular,
  ai: SparkleRegular,
  backup: HistoryOutlined,
  configsync: PhoneDesktopRegular,
  storage: CloudOutlined,
  support: InfoCircleOutlined,
}

/** 设置卡片：组标题（14 semibold）+ 可选说明 + 内容 */
function SetCard({
  title,
  desc,
  icon,
  action,
  tone,
  children,
}: {
  title?: React.ReactNode
  desc?: React.ReactNode
  icon?: React.ReactNode
  action?: React.ReactNode
  tone?: 'danger'
  children: React.ReactNode
}) {
  return (
    <div className={`w-card${tone === 'danger' ? ' w-set-danger' : ''}`}>
      {(title || desc) && (
        <div className="w-set-group">
          <div className="w-set-group-row">
            {title ? (
              <h3 className="w-set-group-title">
                {icon}
                {title}
              </h3>
            ) : (
              <span />
            )}
            {action}
          </div>
          {desc && <p className="w-set-group-desc">{desc}</p>}
        </div>
      )}
      {children}
    </div>
  )
}

/** Win11 InfoBar：说明类信息不再用彩色大 Alert 块 */
function Notice({
  kind = 'info',
  title,
  children,
}: {
  kind?: 'info' | 'warning' | 'danger'
  title?: string
  children: React.ReactNode
}) {
  const Icon = kind === 'info' ? InfoCircleOutlined : WarningOutlined
  return (
    <div className={`w-set-note${kind === 'info' ? '' : ` w-set-note--${kind}`}`}>
      <span className="w-set-note-icon" aria-hidden>
        <Icon />
      </span>
      <div className="w-set-note-main">
        {title && <div className="w-set-note-title">{title}</div>}
        <div className="w-set-note-body">{children}</div>
      </div>
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
      <div className="w-set-sync">
        <CloudOutlined />
        <span>
          <strong>{t('settings.sync.off')}</strong>
          {' · '}
          {t('settings.sync.offDesc')}
        </span>
      </div>
    )
  }
  if (st.phase === 'error') {
    return (
      <div className="w-set-sync w-set-sync--error">
        <WarningOutlined />
        <span>
          <strong className="w-set-sync-tone">{t('settings.sync.error')}</strong>
          {' · '}
          {t('settings.sync.lastOk')}: {when || '—'}
          {st.message ? ` · ${st.message}` : ''}
        </span>
      </div>
    )
  }
  if (st.phase === 'syncing') {
    return (
      <div className="w-set-sync">
        <SyncOutlined />
        <span>
          {t('settings.sync.syncing')} · {t('settings.sync.syncingDesc')}
        </span>
      </div>
    )
  }
  return (
    <div className="w-set-sync w-set-sync--ok">
      <CloudOutlined />
      <span>
        <span className="w-set-sync-tone">{t('settings.sync.ok')}</span> · {t('settings.sync.lastOk')}:{' '}
        {when || t('settings.sync.never')}
      </span>
    </div>
  )
}

export default function SettingsPage() {
  const t = useI18n()
  const [search] = useSearchParams()

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

  const PaneIcon = TAB_ICON[tab]

  return (
    <div className="w-page w-set">
      <header className="w-page-head">
        <div className="w-head-main">
          <h1 className="w-title">{t('settings.pageTitle')}</h1>
          <p className="w-desc">{t('settings.pageLede')}</p>
        </div>
      </header>

      <div className="w-set-layout">
        {/* 左：设置分类列表（卡片容器 + 选中项左侧 3px 强调条） */}
        <nav className="w-card w-set-nav" aria-label={t('settings.pageTitle')}>
          <div className="w-rows">
            {items.map((it) => {
              const active = it.key === tab
              const Icon = TAB_ICON[it.key as TabKey]
              return (
                <button
                  key={it.key}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  className={`w-set-nav-item${active ? ' is-active' : ''}`}
                  onClick={() => select(it.key as TabKey)}
                >
                  <span className="w-set-nav-icon" aria-hidden>
                    <Icon />
                  </span>
                  <span className="w-set-nav-label">{it.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* 右：Win11 设置卡片 */}
        <section className="w-set-content" aria-label={t(TAB_LABEL[tab])}>
          <div className="w-set-pane-head">
            <span className="w-set-pane-mark" aria-hidden>
              <PaneIcon />
            </span>
            <div className="w-set-pane-main">
              <h2 className="w-set-pane-title">{t(TAB_LABEL[tab])}</h2>
            </div>
          </div>
          {tab === 'support' ? <div className="w-set-stack">{panels[tab]}</div> : panels[tab]}
        </section>
      </div>
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
    <div className="w-set-stack">
      <SetCard
        title={t('settings.account.current').replace(/[:：]\s*$/, '')}
        desc={t('settings.account.freeForeverHint')}
      >
        <div className="w-rows">
          <div className="w-row">
            <span className="w-row-icon" aria-hidden>
              <PersonRegular />
            </span>
            <div className="w-row-main">
              <span className="w-row-title">{account?.username ?? '—'}</span>
              <span className="w-row-desc">
                {t('settings.account.current').replace(/[:：]\s*$/, '')}
              </span>
            </div>
          </div>
          <div className="w-row">
            <span className="w-row-icon w-row-icon--neutral" aria-hidden>
              <IdcardOutlined />
            </span>
            <div className="w-row-main">
              <span className="w-row-title">{account?.contact || '—'}</span>
              <span className="w-row-desc">
                {t('settings.account.contact').replace(/[:：]\s*$/, '')}
              </span>
            </div>
          </div>
        </div>
      </SetCard>

      <SetCard
        title={t('settings.account.pwdInfo.title')}
        icon={<LockClosedRegular />}
        desc={t('settings.account.pwdInfo.body')}
      >
        <div className="w-rows">
          <button
            type="button"
            className="w-row w-row--button"
            aria-expanded={pwdOpen}
            onClick={() => setPwdOpen((v) => !v)}
          >
            <span className="w-row-icon" aria-hidden>
              <KeyOutlined />
            </span>
            <div className="w-row-main">
              <span className="w-row-title">{t('settings.account.changePwd')}</span>
              <span className="w-row-desc">{t('settings.account.pwdOnlyYou')}</span>
            </div>
            <span className="w-row-control">
              <span className={`w-set-row-chev${pwdOpen ? ' is-open' : ''}`}>
                <DownOutlined />
              </span>
            </span>
          </button>
        </div>
        {pwdOpen && (
          <div className="w-set-expander">
            <div className="w-set-expander-grid">
              <label className="w-field">
                <span className="w-label">{t('settings.account.oldPwd')}</span>
                <input
                  type="password"
                  className="w-input"
                  value={oldPwd}
                  onChange={(e) => setOldPwd(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <label className="w-field">
                <span className="w-label">{t('settings.account.newPwdPlaceholder')}</span>
                <input
                  type="password"
                  className="w-input"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
            </div>
            <div className="w-set-actions w-set-actions--top">
              <Button type="primary" loading={pwdLoading} onClick={() => void handleChangePwd()}>
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
          </div>
        )}
      </SetCard>

      <SetCard
        tone="danger"
        title={t('app.signOut')}
        icon={<SignOutRegular />}
        desc={t('settings.account.logoutHint')}
      >
        <div className="w-set-actions">
          <button
            type="button"
            className="w-btn w-btn--danger"
            onClick={async () => {
              // 走统一收口：退出前同步 + 清空库数据（之前这里只清了 token）
              await resetSession()
              navigate('/login')
            }}
          >
            {t('settings.account.logout')}
          </button>
        </div>
      </SetCard>
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

  const cloud = settings.storageMode === 'cloud'

  return (
    <div className="w-set-stack">
      <Notice kind="warning" title={t('settings.storage.advanced')}>
        {t('settings.storage.info.body')}
      </Notice>

      <SetCard>
        <div className="w-rows">
          <div className="w-row">
            <span className="w-row-icon" aria-hidden>
              <HardDriveRegular />
            </span>
            <div className="w-row-main">
              <span className="w-row-title">
                {cloud ? t('settings.storage.mode.cloudOn') : t('settings.storage.mode.localOn')}
              </span>
              <span className="w-row-desc">{t('settings.storage.info.title')}</span>
            </div>
            <div className="w-row-control">
              <Switch checked={cloud} onChange={handleToggle} />
            </div>
          </div>

          <div className="w-row w-set-row--field">
            <span className="w-row-icon w-row-icon--neutral" aria-hidden>
              <DatabaseOutlined />
            </span>
            <div className="w-row-main">
              <span className="w-row-title">{t('settings.storage.url')}</span>
              <span className="w-row-desc">Supabase</span>
            </div>
            <div className="w-row-control">
              <input
                className="w-input"
                placeholder="https://xxxx.supabase.co"
                value={settings.cloud.url}
                onChange={(e) => setCloud({ url: e.target.value })}
                disabled={cloud}
              />
            </div>
          </div>

          <div className="w-row w-set-row--field">
            <span className="w-row-icon w-row-icon--neutral" aria-hidden>
              <KeyOutlined />
            </span>
            <div className="w-row-main">
              <span className="w-row-title">{t('settings.storage.key')}</span>
              <span className="w-row-desc">anon public key</span>
            </div>
            <div className="w-row-control">
              <input
                className="w-input"
                type="password"
                placeholder="eyJhbGci..."
                value={settings.cloud.anonKey}
                onChange={(e) => setCloud({ anonKey: e.target.value })}
                disabled={cloud}
              />
            </div>
          </div>
        </div>

        {/* 建表 SQL 属于一次性技术步骤：默认折叠，避免把设置页撑成文档页 */}
        <details className="w-set-details">
          <summary>
            <FileTextOutlined />
            {t('settings.storage.sqlTitle')}
          </summary>
          <pre className="w-set-code">
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
      </SetCard>

      {settings.cloud.url && settings.cloud.anonKey ? (
        <SetCard title={t('settings.storage.syncTitle')} icon={<SyncOutlined />} desc={t('settings.storage.hint.sync')}>
          <div className="w-rows">
            <div className="w-row">
              <span className="w-row-icon w-row-icon--neutral" aria-hidden>
                <CloudOutlined />
              </span>
              <div className="w-row-main">
                <span className="w-row-title">
                  {t('settings.storage.currentMode')}
                  {cloud ? t('settings.storage.mode.cloud') : t('settings.storage.mode.local')}
                </span>
                <span className="w-row-desc">
                  {account ? t('settings.storage.accountLabel') + account.username : t('settings.storage.warn.login')}
                </span>
              </div>
            </div>
          </div>
          <div className="w-set-actions">
            <Button
              type="primary"
              loading={syncing}
              onClick={() => handleSync('push')}
              disabled={!account}
              icon={<SwapOutlined />}
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
          <p className="w-set-hint w-set-prose">{t('settings.storage.hint.qr')}</p>
        </SetCard>
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
    <div className="w-set-stack">
      <SetCard
        title={t('settings.f2f.card.title')}
        icon={<PhoneDesktopRegular />}
        desc={t('settings.f2f.card.body')}
      >
        <div className="w-set-actions">
          <Button type="primary" icon={<SwapOutlined />} onClick={() => setF2fOpen(true)}>
            {t('settings.f2f.card.btn')}
          </Button>
        </div>
      </SetCard>
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

  const memoryCount = account ? listMemory(account.id).length : 0

  return (
    <div className="w-set-stack">
      <Notice kind="info" title={t('settings.ai.info.title')}>
        {usingPlatform ? t('settings.ai.info.platform') : t('settings.ai.info.custom')}
      </Notice>
      {usingPlatform && (
        <Notice kind="warning" title={t('settings.ai.platform.warn')}>
          {t('settings.ai.radio.platform')}
        </Notice>
      )}

      <SetCard title={t('settings.ai.radio.label')} icon={<SparkleRegular />} desc={t('settings.ai.autosave')}>
        <div className="w-set-form">
          <div className="w-set-seg" role="radiogroup" aria-label={t('settings.ai.radio.label')}>
            <button
              type="button"
              role="radio"
              aria-checked={usingPlatform}
              disabled={platformEnabled !== true}
              className={`w-set-seg-item${usingPlatform ? ' is-active' : ''}`}
              onClick={() => setAI({ usePlatformAI: true })}
            >
              {platformEnabled === true
                ? t('settings.ai.radio.platform')
                : t('settings.ai.radio.platformOff')}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={!usingPlatform}
              className={`w-set-seg-item${!usingPlatform ? ' is-active' : ''}`}
              onClick={() => setAI({ usePlatformAI: false })}
            >
              {t('settings.ai.radio.custom')}
            </button>
          </div>
        </div>
      </SetCard>

      {!usingPlatform && (
        <SetCard title={t('settings.ai.radio.custom')} icon={<RobotOutlined />}>
          <div className="w-rows">
            <div className="w-row w-set-row--field">
              <span className="w-row-icon w-row-icon--neutral" aria-hidden>
                <CloudOutlined />
              </span>
              <div className="w-row-main">
                <span className="w-row-title">{t('settings.ai.baseUrl')}</span>
                <span className="w-row-desc">https://api.example.com/v1</span>
              </div>
              <div className="w-row-control">
                <input
                  className="w-input"
                  placeholder="https://api.你的服务商.com/v1"
                  value={settings.ai.baseUrl}
                  onChange={(e) => setAI({ baseUrl: e.target.value })}
                />
              </div>
            </div>
            <div className="w-row w-set-row--field">
              <span className="w-row-icon w-row-icon--neutral" aria-hidden>
                <KeyOutlined />
              </span>
              <div className="w-row-main">
                <span className="w-row-title">{t('settings.ai.apiKey')}</span>
                <span className="w-row-desc">sk-...</span>
              </div>
              <div className="w-row-control">
                <input
                  className="w-input"
                  type="password"
                  placeholder="sk-..."
                  value={settings.ai.apiKey}
                  onChange={(e) => setAI({ apiKey: e.target.value })}
                />
              </div>
            </div>
            <div className="w-row w-set-row--field">
              <span className="w-row-icon w-row-icon--neutral" aria-hidden>
                <FileTextOutlined />
              </span>
              <div className="w-row-main">
                <span className="w-row-title">{t('settings.ai.model')}</span>
                <span className="w-row-desc">{t('settings.ai.autosave')}</span>
              </div>
              <div className="w-row-control">
                <input
                  className="w-input"
                  placeholder="填写服务商文档中的模型名称"
                  value={settings.ai.model}
                  onChange={(e) => setAI({ model: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="w-set-actions">
            <Button type="primary" icon={<RobotOutlined />} onClick={() => void handleTest()}>
              {t('settings.ai.test')}
            </Button>
          </div>
        </SetCard>
      )}

      <SetCard
        title={t('settings.ai.prompt.label')}
        icon={<FileTextOutlined />}
        desc={t('settings.ai.prompt.help')}
        action={
          <span className="w-set-mono">
            {settings.ai.customPrompt ? t('settings.ai.prompt.custom') : t('settings.ai.prompt.default')}
          </span>
        }
      >
        <div className="w-set-form">
          <textarea
            className="w-input w-textarea"
            rows={6}
            placeholder={SYSTEM_PROMPT}
            value={settings.ai.customPrompt}
            onChange={(e) => setAI({ customPrompt: e.target.value })}
            style={{ fontFamily: 'var(--w-font-mono)', fontSize: 12 }}
          />
        </div>
        <div className="w-set-actions">
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
        </div>
      </SetCard>

      <SetCard
        title={t('settings.ai.memory.label')}
        icon={<DatabaseOutlined />}
        desc={t('settings.ai.memory.help')}
        action={memoryCount > 0 ? <span className="w-set-mono">{t('settings.ai.memory.count', { n: memoryCount })}</span> : null}
      >
        <div className="w-set-form">
          <textarea
            className="w-input w-textarea"
            rows={6}
            placeholder={t('settings.ai.memory.placeholder')}
            value={memoryLines}
            onChange={(e) => handleMemoryChange(e.target.value)}
            style={{ fontFamily: 'var(--w-font-mono)', fontSize: 12 }}
          />
        </div>
        <div className="w-set-actions">
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
          <span className="w-set-hint">{t('settings.ai.memory.localNote')}</span>
        </div>
      </SetCard>
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
    <div className="w-set-stack">
      <SetCard
        title={t('settings.backup.info.title')}
        icon={<HistoryOutlined />}
        desc={t('settings.backup.info.body')}
      >
        <div className="w-rows">
          <SyncStatusBanner />
          <div className="w-row">
            <span className="w-row-icon" aria-hidden>
              <DownloadOutlined />
            </span>
            <div className="w-row-main">
              <span className="w-row-title">{t('settings.backup.export')}</span>
              <span className="w-row-desc">{t('settings.backup.exported')}</span>
            </div>
            <div className="w-row-control">
              <button type="button" className="w-btn" onClick={() => void handleExport()}>
                {t('settings.backup.export')}
              </button>
            </div>
          </div>
          <div className="w-row">
            <span className="w-row-icon w-row-icon--neutral" aria-hidden>
              <UploadOutlined />
            </span>
            <div className="w-row-main">
              <span className="w-row-title">{t('settings.backup.import')}</span>
              <span className="w-row-desc">{t('settings.backup.cloudNote')}</span>
            </div>
            <div className="w-row-control">
              <Upload beforeUpload={handleImport} showUploadList={false} accept=".json">
                <button type="button" className="w-btn">
                  {t('settings.backup.import')}
                </button>
              </Upload>
            </div>
          </div>
        </div>
      </SetCard>

      <SetCard
        title={t('settings.snap.title')}
        icon={<HistoryOutlined />}
        desc={t('settings.snap.hint', { max: MAX_SNAPSHOTS })}
        action={
          <Button size="small" icon={<PlusOutlined />} loading={snapLoading} onClick={() => void handleManualSnapshot()}>
            {t('settings.snap.create')}
          </Button>
        }
      >
        {snapshots.length === 0 ? (
          <p className="w-set-empty">{t('settings.snap.empty')}</p>
        ) : (
          <div className="w-set-list">
            {snapshots.map((s) => (
              <div key={s.id} className="w-set-list-row">
                <div className="w-set-list-main">
                  <span className="w-set-list-title">
                    {dayjs(s.createdAt).format('YYYY-MM-DD HH:mm')}
                  </span>
                  <span className="w-set-list-desc">
                    {triggerLabel(s.trigger)} ·{' '}
                    {t('settings.snap.counts', { libs: s.libraries, items: s.items })}
                  </span>
                </div>
                <div className="w-set-list-control">
                  <Button size="small" icon={<RollbackOutlined />} onClick={() => handleRestoreSnapshot(s)}>
                    {t('settings.snap.restore.btn')}
                  </Button>
                  <button
                    type="button"
                    className="w-iconbtn w-iconbtn--sm w-set-icon-danger"
                    aria-label={t('common.delete')}
                    title={t('common.delete')}
                    onClick={() => handleDeleteSnapshot(s)}
                  >
                    <DeleteOutlined />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SetCard>
    </div>
  )
}
