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
        tpl && tpl.fields.length > 0 ? `已创建「${name}」，字段模板已套用` : `已创建「${name}」`,
      )
      setNamingOpen(false)
      setNewName('')
    } catch (e) {
      message.error('创建失败：' + (e as Error).message)
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
      message.success('演示库已就绪！打开 AI 助手，试试对它说「统计每个城市的客户数」', 6)
      finishOnboarding()
    } catch (e) {
      message.error('演示库创建失败：' + (e as Error).message)
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
            message="iPhone/iPad 数据安全提醒"
            description={
              <span>
                iOS 的 Safari 可能会清理长期未打开网站的本地数据。建议开启「设置 → 存储 → 云端模式」，
                或每隔一两周打开本页并使用「导出备份」。
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
            title="👋 新手引导 · 三步上手"
            extra={
              <Button type="text" size="small" onClick={finishOnboarding}>
                跳过
              </Button>
            }
            style={{ marginBottom: 16, border: '1px solid #99F6E4' }}
          >
            <Steps
              size="small"
              current={1}
              items={[{ title: '创建管理库' }, { title: '录入/导入数据' }, { title: '让 AI 帮你查与算' }]}
              style={{ marginBottom: 16 }}
            />
            <Paragraph type="secondary" style={{ marginBottom: 12 }}>
              不想从零开始？一键创建一个带示例数据的「客户管理」演示库，先玩明白再建自己的。
            </Paragraph>
            <Space wrap>
              <Button type="primary" icon={<RocketOutlined />} loading={demoLoading} onClick={handleDemo}>
                一键创建演示库
              </Button>
              <Button icon={<EditOutlined />} onClick={openNaming}>
                从空白开始
              </Button>
            </Space>
          </Card>
        )}

        <Result
          icon={<AppstoreAddOutlined style={{ color: '#0D9488' }} />}
          title={`你好，${account?.username ?? ''}`}
          subTitle={
            libraries.length === 0
              ? '还没有管理库，从创建第一个开始吧'
              : '请从左侧选择一个管理库，或创建新的'
          }
          extra={
            <Button type="primary" size="large" icon={<AppstoreAddOutlined />} onClick={openNaming}>
              创建管理库
            </Button>
          }
        />
        <Paragraph type="secondary" style={{ textAlign: 'center' }}>
          可在「设置」中开启云端存储实现跨设备同步，或配置 AI 助手辅助管理数据。
        </Paragraph>
      </Card>

      <Modal
        title="新建管理库"
        open={namingOpen}
        onOk={handleCreate}
        onCancel={() => setNamingOpen(false)}
        okText="创建"
        confirmLoading={creating}
      >
        <Input
          placeholder="管理库名称，如：联系人管理"
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
          选择行业模板可一键生成字段结构，之后仍可随时修改。
        </Paragraph>
      </Modal>
    </div>
  )
}
