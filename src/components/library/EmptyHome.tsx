import { useEffect, useMemo, useState } from 'react'
import { Result, Button, Card, Typography, Alert, Input, Modal, App, Space, Steps, Select } from 'antd'
import {
  AppstoreAddOutlined,
  WarningOutlined,
  RocketOutlined,
  EditOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useLibraryStore } from '@/store/libraryStore'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'
import { createDemoLibrary } from '@/utils/demoData'
import { useI18n } from '@/i18n'
import { LIB_TEMPLATES, applyTemplate } from '@/utils/libraryTemplates'

const { Paragraph } = Typography

// iOS Safari 会对"7 天未使用"的网站清除本地存储（含 IndexedDB）。
// 本地模式下数据只存在浏览器里，必须提醒买家开启云同步或定期导出备份（红队报告 P6）。
function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document)
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|EdgiOS|FxiOS|Opt/.test(ua)
  const standalone =
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  return isIOS && isSafari && !standalone
}

const RISK_KEY = 'info-mgmt-safari-risk-dismissed'
const onboardKey = (accountId: string) => `info-mgmt-onboarded-${accountId}`

export default function EmptyHome() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const t = useI18n()
  const { account } = useAuthStore()
  const { settings } = useAppStore()
  const { libraries, createLibrary, selectLibrary, loadLibraries } = useLibraryStore()

  // 建库命名弹窗（替代原先一键创建"未命名管理库"的草率路径）
  const [namingOpen, setNamingOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [tplKey, setTplKey] = useState('blank')
  const [demoLoading, setDemoLoading] = useState(false)

  // 新手引导：仅对"还没有任何库且未完成引导"的账号展示
  const [onboardDone, setOnboardDone] = useState(true)
  useEffect(() => {
    if (account) setOnboardDone(localStorage.getItem(onboardKey(account.id)) === '1')
    else setOnboardDone(true)
  }, [account?.id])
  const finishOnboarding = () => {
    if (account) localStorage.setItem(onboardKey(account.id), '1')
    setOnboardDone(true)
  }
  const showOnboarding = libraries.length === 0 && !onboardDone

  const safariRisk = useMemo(
    () => settings.storageMode === 'local' && isIosSafari(),
    [settings.storageMode],
  )
  const [riskDismissed, setRiskDismissed] = useState(true)
  useEffect(() => {
    setRiskDismissed(localStorage.getItem(RISK_KEY) === '1')
  }, [])

  const openNaming = () => {
    finishOnboarding()
    setNewName('')
    setNamingOpen(true)
  }

  const handleCreate = async () => {
    const name = newName.trim() || '未命名管理库'
    setCreating(true)
    try {
      const id = await createLibrary(name)
      const tpl = LIB_TEMPLATES.find((x) => x.key === tplKey)
      if (tpl) await applyTemplate(id, tpl)
      await loadLibraries()
      await selectLibrary(id)
      navigate(`/library/${id}`)
      message.success(
        tpl && tpl.fields.length > 0
          ? t('home.create.doneTpl', { name })
          : t('home.create.done', { name }),
      )
      setNamingOpen(false)
      setNewName('')
    } catch (e) {
      message.error(t('home.create.failed', { msg: (e as Error).message }))
    } finally {
      setCreating(false)
    }
  }

  const handleDemo = async () => {
    if (!account) return
    setDemoLoading(true)
    try {
      const id = await createDemoLibrary(account.id)
      await loadLibraries()
      await selectLibrary(id)
      navigate(`/library/${id}`)
      message.success(t('home.demo.ready'), 6)
      finishOnboarding()
    } catch (e) {
      message.error(t('home.create.failed', { msg: (e as Error).message }))
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, height: '100%' }}>
      <Card>
        {safariRisk && !riskDismissed && (
          <Alert
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            style={{ marginBottom: 16 }}
            message={t('home.safari.title')}
            description={
              <span>
                {t('home.safari.body')}
              </span>
            }
            closable
            onClose={() => {
              localStorage.setItem(RISK_KEY, '1')
              setRiskDismissed(true)
            }}
          />
        )}

        {showOnboarding && (
          <Card
            size="small"
            title={t('home.onboard.title')}
            extra={
              <Button type="text" size="small" onClick={finishOnboarding}>
                {t('home.onboard.skip')}
              </Button>
            }
            style={{ marginBottom: 16, border: '1px solid #99F6E4' }}
          >
            <Steps
              size="small"
              current={1}
              items={[{ title: t('home.onboard.step1') }, { title: t('home.onboard.step2') }, { title: t('home.onboard.step3') }]}
              style={{ marginBottom: 16 }}
            />
            <Paragraph type="secondary" style={{ marginBottom: 12 }}>
              {t('home.onboard.intro')}
            </Paragraph>
            <Space wrap>
              <Button type="primary" icon={<RocketOutlined />} loading={demoLoading} onClick={handleDemo}>
                {t('home.onboard.demoBtn')}
              </Button>
              <Button icon={<EditOutlined />} onClick={openNaming}>
                {t('home.onboard.blankBtn')}
              </Button>
            </Space>
          </Card>
        )}

        <Result
          icon={<AppstoreAddOutlined style={{ color: '#0D9488' }} />}
          title={t('home.greeting', { name: account?.username ?? '' })}
          subTitle={
            libraries.length === 0
              ? t('home.empty')
              : t('home.pick')
          }
          extra={
            <Button type="primary" size="large" icon={<AppstoreAddOutlined />} onClick={openNaming}>
              {t('home.createFirst')}
            </Button>
          }
        />
        <Paragraph type="secondary" style={{ textAlign: 'center' }}>
          {t('home.tip')}
        </Paragraph>
      </Card>

      <Modal
        title={t('home.create.modalTitle')}
        open={namingOpen}
        onOk={handleCreate}
        onCancel={() => setNamingOpen(false)}
        okText={t('home.create.ok')}
        confirmLoading={creating}
      >
        <Input
          placeholder={t('home.create.placeholder')}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onPressEnter={handleCreate}
          autoFocus
          style={{ marginTop: 8 }}
        />
        <Select
          value={tplKey}
          onChange={setTplKey}
          style={{ width: '100%', marginTop: 12 }}
          options={LIB_TEMPLATES.map((t) => ({
            label: `${t.name} · ${t.desc}`,
            value: t.key,
          }))}
          listHeight={260}
        />
        <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          {t('home.create.tplHint')}
        </Paragraph>
      </Modal>
    </div>
  )
}
