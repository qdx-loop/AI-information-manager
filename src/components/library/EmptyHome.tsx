import { useEffect, useMemo, useState } from 'react'
import { Result, Button, Card, Typography, Alert, Input, Modal, App } from 'antd'
import { AppstoreAddOutlined, WarningOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useLibraryStore } from '@/store/libraryStore'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'

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

  const safariRisk = useMemo(
    () => settings.storageMode === 'local' && isIosSafari(),
    [settings.storageMode],
  )
  const [riskDismissed, setRiskDismissed] = useState(true)
  useEffect(() => {
    setRiskDismissed(localStorage.getItem(RISK_KEY) === '1')
  }, [])

  const openNaming = () => {
    setNewName('')
    setNamingOpen(true)
  }

  const handleCreate = async () => {
    const name = newName.trim() || '未命名管理库'
    setCreating(true)
    try {
      const id = await createLibrary(name)
      await loadLibraries()
      await selectLibrary(id)
      navigate(`/library/${id}`)
      message.success(`已创建「${name}」，下一步请配置字段模板`)
      setNamingOpen(false)
      setNewName('')
    } catch (e) {
      message.error('创建失败：' + (e as Error).message)
    } finally {
      setCreating(false)
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
        <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          创建后可在库内随时配置或修改字段模板。
        </Paragraph>
      </Modal>
    </div>
  )
}
