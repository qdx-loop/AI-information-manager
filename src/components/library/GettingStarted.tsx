import { useEffect, useMemo, useState } from 'react'
import { Card, Progress, Button, Tag, Space, Alert, App, Typography, Grid } from 'antd'
import {
  RocketOutlined,
  CheckCircleFilled,
  AppstoreAddOutlined,
  EditOutlined,
  RobotOutlined,
  BellOutlined,
  CloseOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useLibraryStore } from '@/store/libraryStore'
import { createDemoLibrary } from '@/utils/demoData'
import { isObStepDone, isObDismissed, dismissOb } from '@/utils/onboarding'
import { useI18n } from '@/i18n'
import TemplateCenter from './TemplateCenter'

const { Text } = Typography

// 新手任务清单：按真实激活里程碑打勾（建库 / 录数据 / 用 AI / 设提醒），
// 带进度条与快捷操作，全部完成或手动关闭后不再打扰。
export default function GettingStarted() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const t = useI18n()
  const { account } = useAuthStore()
  const { libraries, loadLibraries, selectLibrary } = useLibraryStore()
  const [demoLoading, setDemoLoading] = useState(false)
  const [tplOpen, setTplOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [, force] = useState(0)

  // 其他页面完成步骤时会派发 ob-updated，这里实时刷新打勾状态
  useEffect(() => {
    const refresh = () => force((n) => n + 1)
    window.addEventListener('ob-updated', refresh)
    return () => window.removeEventListener('ob-updated', refresh)
  }, [])

  const accId = account?.id ?? ''
  const hasLib = libraries.length > 0
  const steps = useMemo(
    () => [
      { key: 'lib', icon: <AppstoreOutlined />, title: t('ob.step.lib'), desc: t('ob.step.lib.desc'), done: hasLib },
      { key: 'item', icon: <EditOutlined />, title: t('ob.step.item'), desc: t('ob.step.item.desc'), done: isObStepDone(accId, 'item') },
      { key: 'ai', icon: <RobotOutlined />, title: t('ob.step.ai'), desc: t('ob.step.ai.desc'), done: isObStepDone(accId, 'ai') },
      { key: 'reminder', icon: <BellOutlined />, title: t('ob.step.reminder'), desc: t('ob.step.reminder.desc'), done: isObStepDone(accId, 'reminder') },
    ],
    [accId, hasLib, t],
  )
  const doneCount = steps.filter((s) => s.done).length
  const allDone = doneCount === steps.length
  const pct = Math.round((doneCount / steps.length) * 100)
  // 窄屏时把操作按钮换到下一行：中文在 flex 子项里 min-width:auto 会退化成一个字，
  // 按钮（flexShrink:0）会把文字列挤成 1 字宽、逐字换行，整张卡片被撑到几百像素高。
  const narrow = !Grid.useBreakpoint().md

  if (!account || hidden || isObDismissed(accId)) return null

  const handleDemo = async () => {
    if (!account) return
    setDemoLoading(true)
    try {
      const id = await createDemoLibrary(account.id)
      await loadLibraries()
      await selectLibrary(id)
      navigate(`/library/${id}`)
      message.success(t('home.demo.ready'), 6)
    } catch (e) {
      message.error(t('home.create.failed', { msg: (e as Error).message }))
    } finally {
      setDemoLoading(false)
    }
  }

  const goFirstLib = () => {
    const first = [...libraries].sort((a, b) => a.sortOrder - b.sortOrder)[0]
    if (!first) return
    selectLibrary(first.id)
    navigate(`/library/${first.id}`)
  }

  const openAi = () => window.dispatchEvent(new Event('open-ai-panel'))

  const dismiss = () => {
    dismissOb(accId)
    setHidden(true)
  }

  // 每个未完成步骤的快捷操作
  const actionFor = (key: string) => {
    if (key === 'lib')
      return (
        <Space size={4} wrap>
          <Button size="small" type="primary" loading={demoLoading} icon={<RocketOutlined />} onClick={handleDemo}>
            {t('ob.act.demo')}
          </Button>
          <Button size="small" icon={<AppstoreAddOutlined />} onClick={() => setTplOpen(true)}>
            {t('ob.act.tpl')}
          </Button>
        </Space>
      )
    if (key === 'item' && hasLib)
      return (
        <Button size="small" icon={<EditOutlined />} onClick={goFirstLib}>
          {t('ob.act.addItem')}
        </Button>
      )
    if (key === 'ai')
      return (
        <Button size="small" icon={<RobotOutlined />} onClick={openAi}>
          {t('ob.act.ai')}
        </Button>
      )
    return null
  }

  return (
    <Card
      size="small"
      style={{ marginBottom: 16, border: '1px solid #99F6E4' }}
      title={
        <Space>
          <RocketOutlined style={{ color: '#0D9488' }} />
          <span>{t('ob.title')}</span>
          <Tag color="teal">{doneCount}/{steps.length}</Tag>
        </Space>
      }
      extra={
        <Button type="text" size="small" icon={<CloseOutlined />} onClick={dismiss}>
          {t('ob.dismiss')}
        </Button>
      }
    >
      <Progress percent={pct} size="small" showInfo={false} strokeColor="#0D9488" style={{ marginBottom: 14 }} />

      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {steps.map((s, idx) => (
          <div key={s.key} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 10 }}>
            {s.done ? (
              <CheckCircleFilled style={{ color: '#52c41a', fontSize: 18, marginTop: 2 }} />
            ) : (
              <span
                style={{
                  width: 18, height: 18, borderRadius: '50%', marginTop: 3, flexShrink: 0,
                  border: '1px solid #d9d9d9', color: '#8c8c8c', fontSize: 12,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {idx + 1}
              </span>
            )}
            <div style={{ flex: '1 1 0%', minWidth: 0 }}>
              <Text style={{ fontWeight: 500, textDecoration: s.done ? 'line-through' : 'none' }} type={s.done ? 'secondary' : undefined}>
                {s.title}
              </Text>
              <div style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>{s.desc}</div>
            </div>
            {!s.done && (
              <div
                style={{
                  flexShrink: 0,
                  // 窄屏：占满整行换到文字下方；宽屏：留在同一行右侧
                  ...(narrow ? { flexBasis: '100%', paddingLeft: 28 } : null),
                }}
              >
                {actionFor(s.key)}
              </div>
            )}
          </div>
        ))}
      </Space>

      {allDone && (
        <Alert
          type="success"
          showIcon
          style={{ marginTop: 14 }}
          message={t('ob.done.title')}
          description={t('ob.done.body')}
        />
      )}

      <TemplateCenter open={tplOpen} onClose={() => setTplOpen(false)} />
    </Card>
  )
}
