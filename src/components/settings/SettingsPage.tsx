import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { App, Upload } from 'antd'
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Badge,
  Button,
  Card,
  CardHeader,
  Divider,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Switch,
  Tab,
  TabList,
  Text,
  Textarea,
} from '@fluentui/react-components'
import {
  AddRegular,
  ArrowCounterclockwiseRegular,
  ArrowDownloadRegular,
  ArrowUploadRegular,
  BotRegular,
  CloudRegular,
  DatabaseRegular,
  DeleteRegular,
  DocumentTextRegular,
  GlobeRegular,
  HardDriveRegular,
  HistoryRegular,
  InfoRegular,
  KeyRegular,
  LockClosedRegular,
  PersonRegular,
  PhoneDesktopRegular,
  SignOutRegular,
  SparkleRegular,
  WarningRegular,
  type FluentIcon,
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
 * 设置页 · v10 Fluent UI 2（Windows 11 应用，不是操作系统）
 *
 * 唯一设计系统 = @fluentui/react-components：
 *   TabList(vertical) 分类导航 + Card/CardHeader 设置卡 + Divider + 设置行
 *   （图标 + Text + 右侧 Switch/Dropdown/Button/Input/Accordion）+ MessageBar 说明。
 * 页面不含自绘按钮/卡片/输入框；颜色/圆角/阴影全部来自 Fluent token。
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

const TAB_ICON: Record<TabKey, FluentIcon> = {
  account: PersonRegular,
  ai: SparkleRegular,
  backup: HistoryRegular,
  configsync: PhoneDesktopRegular,
  storage: CloudRegular,
  support: InfoRegular,
}

/** 窄屏（≤900px）时导航由左侧竖排切为顶部横排；用 matchMedia 替代 antd Grid */
function useNarrowLayout() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

/** Fluent 设置卡：Card + CardHeader + Divider + 内容 */
function SettingCard({
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
  action?: React.ReactElement
  tone?: 'danger'
  children: React.ReactNode
}) {
  return (
    <Card appearance="filled" className={`w-set-card${tone === 'danger' ? ' w-set-card--danger' : ''}`}>
      {(title || desc) && (
        <>
          <CardHeader
            image={
              icon ? (
                <span className="w-set-card-icon" aria-hidden>
                  {icon}
                </span>
              ) : undefined
            }
            header={
              title ? (
                <Text size={300} weight="semibold" className={tone === 'danger' ? 'w-danger-text' : 'w-card-heading'}>
                  {title}
                </Text>
              ) : undefined
            }
            description={
              desc ? (
                <Text size={200} className="w-muted">
                  {desc}
                </Text>
              ) : undefined
            }
            action={action}
          />
          <Divider />
        </>
      )}
      {children}
    </Card>
  )
}

/** 设置行（静态）：图标 + 标题/说明 + 右侧 Fluent 控件 */
function SettingRow({
  icon,
  title,
  desc,
  control,
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  desc?: React.ReactNode
  control?: React.ReactNode
}) {
  return (
    <div className="w-set-row">
      {icon && (
        <span className="w-set-row-icon" aria-hidden>
          {icon}
        </span>
      )}
      <span className="w-set-row-main">
        <Text size={300} className="w-set-row-title">
          {title}
        </Text>
        {desc && (
          <Text size={200} className="w-set-row-desc">
            {desc}
          </Text>
        )}
      </span>
      {control && <span className="w-set-row-control">{control}</span>}
    </div>
  )
}

/** Win11 InfoBar → Fluent MessageBar（说明/警告） */
function Notice({
  kind = 'info',
  children,
}: {
  kind?: 'info' | 'warning' | 'danger'
  children: React.ReactNode
}) {
  return (
    <MessageBar intent={kind === 'info' ? 'info' : kind === 'warning' ? 'warning' : 'error'}>
      <MessageBarBody>{children}</MessageBarBody>
    </MessageBar>
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
      <div className="w-set-status">
        <CloudRegular />
        <Text size={200} className="w-muted">
          <Text weight="semibold" size={200}>
            {t('settings.sync.off')}
          </Text>
          {' · '}
          {t('settings.sync.offDesc')}
        </Text>
      </div>
    )
  }
  if (st.phase === 'error') {
    return (
      <div className="w-set-status w-set-status--danger">
        <WarningRegular />
        <Text size={200} className="w-muted">
          <Text weight="semibold" size={200} className="w-danger-text">
            {t('settings.sync.error')}
          </Text>
          {' · '}
          {t('settings.sync.lastOk')}: {when || '—'}
          {st.message ? ` · ${st.message}` : ''}
        </Text>
      </div>
    )
  }
  if (st.phase === 'syncing') {
    return (
      <div className="w-set-status">
        <Spinner size="tiny" />
        <Text size={200} className="w-muted">
          {t('settings.sync.syncing')} · {t('settings.sync.syncingDesc')}
        </Text>
      </div>
    )
  }
  return (
    <div className="w-set-status">
      <CloudRegular />
      <Text size={200} className="w-muted">
        <Text weight="semibold" size={200}>
          {t('settings.sync.ok')}
        </Text>{' '}
        · {t('settings.sync.lastOk')}: {when || t('settings.sync.never')}
      </Text>
    </div>
  )
}

export default function SettingsPage() {
  const t = useI18n()
  const [search] = useSearchParams()
  const narrow = useNarrowLayout()

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
          <Text as="h1" size={700} weight="semibold" className="w-set-page-title">
            {t('settings.pageTitle')}
          </Text>
          <Text size={300} className="w-muted">
            {t('settings.pageLede')}
          </Text>
        </div>
      </header>

      <div className="w-set-layout">
        {/* 左：Fluent TabList 分类导航（窄屏横向） */}
        <TabList
          vertical={!narrow}
          selectedValue={tab}
          onTabSelect={(_, data) => select(data.value as TabKey)}
          className="w-set-nav"
          aria-label={t('settings.pageTitle')}
        >
          {TAB_ORDER.map((k) => {
            const Icon = TAB_ICON[k]
            return (
              <Tab key={k} value={k} icon={<Icon />}>
                {t(TAB_LABEL[k])}
              </Tab>
            )
          })}
        </TabList>

        {/* 右：Fluent Card 设置卡 */}
        <section className="w-set-content" aria-label={t(TAB_LABEL[tab])}>
          <div className="w-set-pane-head">
            <span className="w-set-pane-icon" aria-hidden>
              <PaneIcon />
            </span>
            <Text as="h2" size={500} weight="semibold" className="w-set-pane-title">
              {t(TAB_LABEL[tab])}
            </Text>
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
      <SettingCard
        title={t('settings.account.current').replace(/[:：]\s*$/, '')}
        icon={<PersonRegular />}
        desc={t('settings.account.freeForeverHint')}
      >
        <div className="w-set-rows">
          <SettingRow
            icon={<PersonRegular />}
            title={account?.username ?? '—'}
            desc={t('settings.account.current').replace(/[:：]\s*$/, '')}
          />
          <SettingRow
            icon={<PersonRegular />}
            title={account?.contact || '—'}
            desc={t('settings.account.contact').replace(/[:：]\s*$/, '')}
          />
        </div>
      </SettingCard>

      <SettingCard
        title={t('settings.account.pwdInfo.title')}
        icon={<LockClosedRegular />}
        desc={t('settings.account.pwdOnlyYou')}
      >
        <Accordion
          collapsible
          openItems={pwdOpen ? ['password'] : []}
          onToggle={(_, data) => setPwdOpen(data.openItems.length > 0)}
        >
          <AccordionItem value="password">
            <AccordionHeader>
              <span className="w-set-row-main">
                <Text size={300} className="w-set-row-title">
                  {t('settings.account.pwdCard')}
                </Text>
                <Text size={200} className="w-set-row-desc">
                  {t('settings.account.newPwdPlaceholder')}
                </Text>
              </span>
            </AccordionHeader>
            <AccordionPanel>
              <div className="w-set-expander">
                <div className="w-set-expander-grid">
                  <Field label={t('settings.account.oldPwd')}>
                    <Input
                      type="password"
                      value={oldPwd}
                      onChange={(_, data) => setOldPwd(data.value)}
                      autoComplete="current-password"
                    />
                  </Field>
                  <Field label={t('settings.account.newPwdPlaceholder')}>
                    <Input
                      type="password"
                      value={newPwd}
                      onChange={(_, data) => setNewPwd(data.value)}
                      autoComplete="new-password"
                    />
                  </Field>
                </div>
                <div className="w-set-actions">
                  <Button
                    appearance="primary"
                    disabled={pwdLoading}
                    icon={pwdLoading ? <Spinner size="tiny" /> : undefined}
                    onClick={() => void handleChangePwd()}
                  >
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
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </SettingCard>

      <SettingCard
        title={t('app.signOut')}
        icon={<SignOutRegular />}
        desc={t('settings.account.logoutHint')}
        tone="danger"
      >
        <div className="w-set-actions">
          <Button
            className="w-danger-action"
            onClick={async () => {
              // 走统一收口：退出前同步 + 清空库数据（之前这里只清了 token）
              await resetSession()
              navigate('/login')
            }}
          >
            {t('settings.account.logout')}
          </Button>
        </div>
      </SettingCard>
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
      <Notice kind="warning">
        <Text weight="semibold" size={200}>
          {t('settings.storage.advanced')}
        </Text>{' '}
        {t('settings.storage.info.body')}
      </Notice>

      <SettingCard>
        <div className="w-set-rows">
          <SettingRow
            icon={<HardDriveRegular />}
            title={cloud ? t('settings.storage.mode.cloudOn') : t('settings.storage.mode.localOn')}
            desc={t('settings.storage.info.title')}
            control={
              <Switch
                checked={cloud}
                onChange={(_, data) => handleToggle(data.checked)}
                aria-label={t('settings.tab.storage')}
              />
            }
          />
          <div className="w-set-row w-set-row--field">
            <span className="w-set-row-icon" aria-hidden>
              <DatabaseRegular />
            </span>
            <span className="w-set-row-main">
              <Text size={300} className="w-set-row-title">
                {t('settings.storage.url')}
              </Text>
              <Text size={200} className="w-set-row-desc">
                Supabase
              </Text>
            </span>
            <span className="w-set-row-control">
              <Input
                className="w-set-input"
                placeholder="https://xxxx.supabase.co"
                value={settings.cloud.url}
                disabled={cloud}
                onChange={(_, data) => setCloud({ url: data.value })}
              />
            </span>
          </div>
          <div className="w-set-row w-set-row--field">
            <span className="w-set-row-icon" aria-hidden>
              <KeyRegular />
            </span>
            <span className="w-set-row-main">
              <Text size={300} className="w-set-row-title">
                {t('settings.storage.key')}
              </Text>
              <Text size={200} className="w-set-row-desc">
                anon public key
              </Text>
            </span>
            <span className="w-set-row-control">
              <Input
                className="w-set-input"
                type="password"
                placeholder="eyJhbGci..."
                value={settings.cloud.anonKey}
                disabled={cloud}
                onChange={(_, data) => setCloud({ anonKey: data.value })}
              />
            </span>
          </div>
        </div>

        {/* 建表 SQL 属于一次性技术步骤：默认折叠，避免把设置页撑成文档页 */}
        <Accordion collapsible className="w-set-accordion">
          <AccordionItem value="sql">
            <AccordionHeader>
              <Text size={200} className="w-muted">
                {t('settings.storage.sqlTitle')}
              </Text>
            </AccordionHeader>
            <AccordionPanel>
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
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </SettingCard>

      {settings.cloud.url && settings.cloud.anonKey ? (
        <SettingCard title={t('settings.storage.syncTitle')} icon={<CloudRegular />} desc={t('settings.storage.hint.sync')}>
          <div className="w-set-rows">
            <SettingRow
              icon={<CloudRegular />}
              title={`${t('settings.storage.currentMode')}${
                cloud ? t('settings.storage.mode.cloud') : t('settings.storage.mode.local')
              }`}
              desc={
                account
                  ? t('settings.storage.accountLabel') + account.username
                  : t('settings.storage.warn.login')
              }
            />
          </div>
          <div className="w-set-actions">
            <Button
              appearance="primary"
              disabled={!account || syncing}
              icon={syncing ? <Spinner size="tiny" /> : undefined}
              onClick={() => handleSync('push')}
            >
              {t('settings.storage.btn.bidirectional')}
            </Button>
            <Button
              icon={syncing ? <Spinner size="tiny" /> : <ArrowDownloadRegular />}
              disabled={!account || syncing}
              onClick={() => handleSync('pull')}
            >
              {t('settings.storage.btn.pull')}
            </Button>
          </div>
          <div className="w-set-pad">
            <Text size={200} className="w-muted">
              {t('settings.storage.hint.qr')}
            </Text>
          </div>
        </SettingCard>
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
      <SettingCard title={t('settings.f2f.card.title')} icon={<PhoneDesktopRegular />} desc={t('settings.f2f.card.body')}>
        <div className="w-set-actions">
          <Button appearance="primary" icon={<PhoneDesktopRegular />} onClick={() => setF2fOpen(true)}>
            {t('settings.f2f.card.btn')}
          </Button>
        </div>
      </SettingCard>
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
      <Notice kind="info">
        <Text weight="semibold" size={200}>
          {t('settings.ai.info.title')}
        </Text>{' '}
        {usingPlatform ? t('settings.ai.info.platform') : t('settings.ai.info.custom')}
      </Notice>
      {usingPlatform && (
        <Notice kind="warning">
          <Text weight="semibold" size={200}>
            {t('settings.ai.platform.warn')}
          </Text>
        </Notice>
      )}

      <SettingCard title={t('settings.ai.radio.label')} icon={<SparkleRegular />} desc={t('settings.ai.autosave')}>
        <div className="w-set-rows">
          <SettingRow
            icon={<BotRegular />}
            title={usingPlatform ? t('settings.ai.radio.platform') : t('settings.ai.radio.custom')}
            desc={t('settings.ai.autosave')}
            control={
              <Dropdown
                className="w-set-dropdown"
                value={usingPlatform ? t('settings.ai.radio.platform') : t('settings.ai.radio.custom')}
                selectedOptions={[usingPlatform ? 'platform' : 'custom']}
                onOptionSelect={(_, data) => {
                  if (data.optionValue) setAI({ usePlatformAI: data.optionValue === 'platform' })
                }}
                aria-label={t('settings.ai.radio.label')}
              >
                <Option value="platform" disabled={platformEnabled !== true}>
                  {platformEnabled === true
                    ? t('settings.ai.radio.platform')
                    : t('settings.ai.radio.platformOff')}
                </Option>
                <Option value="custom">{t('settings.ai.radio.custom')}</Option>
              </Dropdown>
            }
          />
        </div>
      </SettingCard>

      {!usingPlatform && (
        <SettingCard title={t('settings.ai.radio.custom')} icon={<BotRegular />}>
          <div className="w-set-rows">
            <div className="w-set-row w-set-row--field">
              <span className="w-set-row-icon" aria-hidden>
                <GlobeRegular />
              </span>
              <span className="w-set-row-main">
                <Text size={300} className="w-set-row-title">
                  {t('settings.ai.baseUrl')}
                </Text>
                <Text size={200} className="w-set-row-desc">
                  https://api.example.com/v1
                </Text>
              </span>
              <span className="w-set-row-control">
                <Input
                  className="w-set-input"
                  placeholder="https://api.你的服务商.com/v1"
                  value={settings.ai.baseUrl}
                  onChange={(_, data) => setAI({ baseUrl: data.value })}
                />
              </span>
            </div>
            <div className="w-set-row w-set-row--field">
              <span className="w-set-row-icon" aria-hidden>
                <KeyRegular />
              </span>
              <span className="w-set-row-main">
                <Text size={300} className="w-set-row-title">
                  {t('settings.ai.apiKey')}
                </Text>
                <Text size={200} className="w-set-row-desc">
                  sk-...
                </Text>
              </span>
              <span className="w-set-row-control">
                <Input
                  className="w-set-input"
                  type="password"
                  placeholder="sk-..."
                  value={settings.ai.apiKey}
                  onChange={(_, data) => setAI({ apiKey: data.value })}
                />
              </span>
            </div>
            <div className="w-set-row w-set-row--field">
              <span className="w-set-row-icon" aria-hidden>
                <DocumentTextRegular />
              </span>
              <span className="w-set-row-main">
                <Text size={300} className="w-set-row-title">
                  {t('settings.ai.model')}
                </Text>
                <Text size={200} className="w-set-row-desc">
                  {t('settings.ai.autosave')}
                </Text>
              </span>
              <span className="w-set-row-control">
                <Input
                  className="w-set-input"
                  placeholder="填写服务商文档中的模型名称"
                  value={settings.ai.model}
                  onChange={(_, data) => setAI({ model: data.value })}
                />
              </span>
            </div>
          </div>
          <div className="w-set-actions">
            <Button appearance="primary" icon={<BotRegular />} onClick={() => void handleTest()}>
              {t('settings.ai.test')}
            </Button>
          </div>
        </SettingCard>
      )}

      <SettingCard
        title={t('settings.ai.prompt.label')}
        icon={<DocumentTextRegular />}
        desc={t('settings.ai.prompt.help')}
        action={
          <Badge appearance="tint" color="informative" size="medium">
            {settings.ai.customPrompt ? t('settings.ai.prompt.custom') : t('settings.ai.prompt.default')}
          </Badge>
        }
      >
        <div className="w-set-form">
          <Textarea
            className="w-set-textarea"
            rows={6}
            resize="vertical"
            placeholder={SYSTEM_PROMPT}
            value={settings.ai.customPrompt}
            onChange={(_, data) => setAI({ customPrompt: data.value })}
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
      </SettingCard>

      <SettingCard
        title={t('settings.ai.memory.label')}
        icon={<DatabaseRegular />}
        desc={t('settings.ai.memory.help')}
        action={
          memoryCount > 0 ? (
            <Badge appearance="tint" color="informative" size="medium">
              {t('settings.ai.memory.count', { n: memoryCount })}
            </Badge>
          ) : undefined
        }
      >
        <div className="w-set-form">
          <Textarea
            className="w-set-textarea"
            rows={6}
            resize="vertical"
            placeholder={t('settings.ai.memory.placeholder')}
            value={memoryLines}
            onChange={(_, data) => handleMemoryChange(data.value)}
          />
        </div>
        <div className="w-set-actions">
          <Button
            size="small"
            className="w-danger-action"
            disabled={!memoryLines}
            onClick={() => {
              if (account) clearMemory(account.id)
              setMemoryLines('')
              message.success(t('settings.ai.memory.cleared'))
            }}
          >
            {t('settings.ai.memory.clear')}
          </Button>
          <Text size={200} className="w-muted">
            {t('settings.ai.memory.localNote')}
          </Text>
        </div>
      </SettingCard>
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
      <SettingCard title={t('settings.backup.info.title')} icon={<HistoryRegular />} desc={t('settings.backup.info.body')}>
        <div className="w-set-rows">
          <SyncStatusBanner />
          <SettingRow
            icon={<ArrowDownloadRegular />}
            title={t('settings.backup.export')}
            desc={t('settings.backup.exported')}
            control={
              <Button appearance="secondary" icon={<ArrowDownloadRegular />} onClick={() => void handleExport()}>
                {t('settings.backup.export')}
              </Button>
            }
          />
          <SettingRow
            icon={<ArrowUploadRegular />}
            title={t('settings.backup.import')}
            desc={t('settings.backup.cloudNote')}
            control={
              <Upload beforeUpload={handleImport} showUploadList={false} accept=".json">
                <Button appearance="secondary" icon={<ArrowUploadRegular />}>
                  {t('settings.backup.import')}
                </Button>
              </Upload>
            }
          />
        </div>
      </SettingCard>

      <SettingCard
        title={t('settings.snap.title')}
        icon={<HistoryRegular />}
        desc={t('settings.snap.hint', { max: MAX_SNAPSHOTS })}
        action={
          <Button
            size="small"
            icon={snapLoading ? <Spinner size="tiny" /> : <AddRegular />}
            disabled={snapLoading}
            onClick={() => void handleManualSnapshot()}
          >
            {t('settings.snap.create')}
          </Button>
        }
      >
        {snapshots.length === 0 ? (
          <div className="w-set-pad">
            <Text size={200} className="w-muted">
              {t('settings.snap.empty')}
            </Text>
          </div>
        ) : (
          <div className="w-set-rows">
            {snapshots.map((s) => (
              <SettingRow
                key={s.id}
                icon={<HistoryRegular />}
                title={dayjs(s.createdAt).format('YYYY-MM-DD HH:mm')}
                desc={`${triggerLabel(s.trigger)} · ${t('settings.snap.counts', {
                  libs: s.libraries,
                  items: s.items,
                })}`}
                control={
                  <>
                    <Button
                      size="small"
                      icon={<ArrowCounterclockwiseRegular />}
                      onClick={() => handleRestoreSnapshot(s)}
                    >
                      {t('settings.snap.restore.btn')}
                    </Button>
                    <Button
                      size="small"
                      appearance="subtle"
                      className="w-danger-action"
                      icon={<DeleteRegular />}
                      aria-label={t('common.delete')}
                      title={t('common.delete')}
                      onClick={() => handleDeleteSnapshot(s)}
                    />
                  </>
                }
              />
            ))}
          </div>
        )}
      </SettingCard>
    </div>
  )
}
