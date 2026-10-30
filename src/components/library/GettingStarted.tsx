import { useEffect, useMemo, useState } from 'react'
import { Button, App, Grid } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useLibraryStore } from '@/store/libraryStore'
import { createDemoLibrary } from '@/utils/demoData'
import { isObStepDone, isObDismissed, dismissOb } from '@/utils/onboarding'
import { useI18n } from '@/i18n'
import SupportNudge from '@/components/reward/SupportNudge'
import TemplateCenter from './TemplateCenter'

// 新手任务清单：按真实激活里程碑打勾（建库 / 录数据 / 用 AI / 设提醒），
// 带进度与快捷操作，全部完成或手动关闭后不再打扰。
//
// 视觉：一张「账目清单」——mono 编号 + 一行一项 + 完成划线，
// 没有卡片、没有对勾图标、没有进度条。数字 3/4 已经说明进度，
// 条形图在这里只有装饰价值（01-ui-research §F5 同款判断）。
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <Button size="small" type="primary" loading={demoLoading} onClick={handleDemo}>
            {t('ob.act.demo')}
          </Button>
          <Button size="small" type="text" onClick={() => setTplOpen(true)}>
            {t('ob.act.tpl')}
          </Button>
        </div>
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
    <section aria-labelledby="ob-title" style={{ marginBottom: 32 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          minHeight: 40,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h2 id="ob-title" className="page-title-sm">{t('ob.title')}</h2>
          {/* 进度用等宽数字，不做进度条 */}
          <span className="mono num faint" style={{ fontSize: 'var(--text-xs)' }}>
            {doneCount}/{steps.length}
          </span>
        </div>
        <Button type="text" size="small" onClick={dismiss}>
          {t('ob.dismiss')}
        </Button>
      </div>
      <div className="rule" />

      <div>
        {steps.map((s) => (
          <div
            key={s.key}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '10px 0',
              borderBottom: '1px solid var(--app-rule)',
              flexWrap: 'wrap',
            }}
          >
            <span
              className="mono num"
              style={{
                fontSize: 'var(--text-xs)',
                lineHeight: '20px',
                flexShrink: 0,
                width: 24,
                textAlign: 'right',
                color: s.done ? 'var(--app-ink-faint)' : 'var(--app-accent-text)',
                textDecoration: s.done ? 'line-through' : 'none',
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
                  fontSize: 'var(--text-base)',
                }}
              >
                {s.title}
              </span>
              <div className="faint" style={{ fontSize: 'var(--text-xs)', marginTop: 2 }}>{s.desc}</div>
            </div>
            {!s.done && (
              <div
                style={{
                  flexShrink: 0,
                  // 窄屏：占满整行换到文字下方；宽屏：留在同一行右侧
                  ...(narrow ? { flexBasis: '100%', paddingLeft: 36 } : null),
                }}
              >
                {actionFor(s.key)}
              </div>
            )}
          </div>
        ))}
      </div>

      {allDone && (
        <div style={{ marginTop: 12 }}>
          <div className="faint" style={{ fontSize: 'var(--text-xs)' }}>
            {t('ob.done.title')} · {t('ob.done.body')}
          </div>
          {/*
            赞赏提示只挂在「4/4 完成」这一个结果位置。
            它自己判断展示条件（时间/会话/里程碑/冷却/静音……），
            未满足时返回 null；这里只负责挂载，不实现任何赞赏逻辑。
          */}
          <SupportNudge />
        </div>
      )}

      <TemplateCenter open={tplOpen} onClose={() => setTplOpen(false)} />
    </section>
  )
}
