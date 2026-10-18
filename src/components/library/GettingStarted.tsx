import { useEffect, useMemo, useState } from 'react'
import { Card, Button, Space, App, Grid } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useLibraryStore } from '@/store/libraryStore'
import { createDemoLibrary } from '@/utils/demoData'
import { isObStepDone, isObDismissed, dismissOb } from '@/utils/onboarding'
import { useI18n } from '@/i18n'
import TemplateCenter from './TemplateCenter'

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
      { key: 'lib', num: '01', title: t('ob.step.lib'), desc: t('ob.step.lib.desc'), done: hasLib },
      { key: 'item', num: '02', title: t('ob.step.item'), desc: t('ob.step.item.desc'), done: isObStepDone(accId, 'item') },
      { key: 'ai', num: '03', title: t('ob.step.ai'), desc: t('ob.step.ai.desc'), done: isObStepDone(accId, 'ai') },
      { key: 'reminder', num: '04', title: t('ob.step.reminder'), desc: t('ob.step.reminder.desc'), done: isObStepDone(accId, 'reminder') },
    ],
    [accId, hasLib, t],
  )
  const doneCount = steps.filter((s) => s.done).length
  const allDone = doneCount === steps.length
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

  // 每个未完成步骤的快捷操作（文字项，不再挂图标）
  const actionFor = (key: string) => {
    if (key === 'lib')
      return (
        <Space size={4} wrap>
          <Button size="small" type="primary" loading={demoLoading} onClick={handleDemo}>
            {t('ob.act.demo')}
          </Button>
          <Button size="small" type="text" onClick={() => setTplOpen(true)}>
            {t('ob.act.tpl')}
          </Button>
        </Space>
      )
    if (key === 'item' && hasLib)
      return (
        <Button size="small" type="text" onClick={goFirstLib}>
          {t('ob.act.addItem')}
        </Button>
      )
    if (key === 'ai')
      return (
        <Button size="small" type="text" onClick={openAi}>
          {t('ob.act.ai')}
        </Button>
      )
    return null
  }

  return (
    <Card
      size="small"
      style={{ marginBottom: 18, borderColor: 'var(--app-border-soft)' }}
      title={
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {t('ob.title')}
          <span
            style={{
              fontFamily: 'var(--app-mono)',
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--app-ink-faint)',
              marginLeft: 10,
            }}
          >
            {doneCount}/{steps.length}
          </span>
        </span>
      }
      extra={
        <Button type="text" size="small" onClick={dismiss}>
          {t('ob.dismiss')}
        </Button>
      }
    >
      {/* 不用进度条：数字 3/4 已经说明一切，条形图在这里只有装饰价值。
          完成的步骤用编号划线表达，而不是绿色对勾图标（去彩汤）。 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {steps.map((s) => (
          <div key={s.key} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 }}>
            <span
              style={{
                fontFamily: 'var(--app-mono)',
                fontSize: 13,
                lineHeight: '20px',
                flexShrink: 0,
                color: s.done ? 'var(--app-ink-faint)' : 'var(--app-glaze-text)',
                textDecoration: s.done ? 'line-through' : 'none',
                width: 20,
                textAlign: 'right',
              }}
            >
              {s.num}
            </span>
            <div style={{ flex: '1 1 0%', minWidth: 0 }}>
              <span
                style={{
                  fontWeight: s.done ? 400 : 500,
                  textDecoration: s.done ? 'line-through' : 'none',
                  color: s.done ? 'var(--app-ink-faint)' : 'var(--app-ink)',
                  fontSize: 13.5,
                }}
              >
                {s.title}
              </span>
              <div style={{ fontSize: 12, color: 'var(--app-ink-faint)', marginTop: 1 }}>{s.desc}</div>
            </div>
            {!s.done && (
              <div
                style={{
                  flexShrink: 0,
                  // 窄屏：占满整行换到文字下方；宽屏：留在同一行右侧
                  ...(narrow ? { flexBasis: '100%', paddingLeft: 32 } : null),
                }}
              >
                {actionFor(s.key)}
              </div>
            )}
          </div>
        ))}
      </div>

      {allDone && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--app-ink-faint)' }}>
          {t('ob.done.title')} · {t('ob.done.body')}
        </div>
      )}

      <TemplateCenter open={tplOpen} onClose={() => setTplOpen(false)} />
    </Card>
  )
}
