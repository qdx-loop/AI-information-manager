// 「新手任务 4/4 完成」结果卡内部的一行式轻提示（P1）。
//
// 设计依据：`redesign-brief/02-donation-research.md` §C.2（R5/R7/R9）、§D.1、§F.4、§G.1–G.7。
// 硬约束：
// - 这里**没有二维码**、没有按钮、没有「打赏/赞助」字样；视觉重量必须低于上面那行「太棒了」。
// - 不自动聚焦、不加 role="alert"（非紧急、非模态，抢焦点=打断）。
// - R9：成功态渲染完成后、下一次空闲（requestIdleCallback，降级 setTimeout 1200ms）才允许出现。
// - Esc = 本次不显示（记 snoozed 90 天）；「不再提示」才记 muted（永久）。
// - 是否该出现完全由 `canShowNudge` 判定，组件只负责「显示成什么样」。
// - 里程碑写入也由本组件承担：它只会在「新手任务 4/4 完成」分支被挂载，
//   挂载即意味着 M1 达成（R3），宿主只需 `<SupportNudge />` 一行。
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useI18n } from '@/i18n'
import {
  canShowNudge,
  currentAccountId,
  markMilestone,
  markNudgeShown,
  muteNudge,
  snoozeNudge,
} from '@/utils/support'

/** R9：没有 requestIdleCallback 时的降级延迟（与 §C.2 R9 的 1200ms 一致） */
const IDLE_FALLBACK_MS = 1200
const SUPPORT_PATH = '/settings?tab=support'

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

export interface SupportNudgeProps {
  /** 账号 id；不传则从登录态取（宿主可直接 <SupportNudge />） */
  accountId?: string
}

export default function SupportNudge({ accountId }: SupportNudgeProps) {
  const account = useAuthStore((s) => s.account)
  const t = useI18n()
  const navigate = useNavigate()
  // R10：账号优先取 props，其次登录态，最后 localStorage 兜底——三者都按 accountId 分键
  const id = accountId ?? account?.id ?? currentAccountId()
  const [visible, setVisible] = useState(false)
  const shownRef = useRef(false)

  // 挂载 = 新手清单 4/4 完成（R3 的 M1）→ 先写里程碑，再看能不能提示。
  // 与 R9 合并在同一个 effect 里：写里程碑是同步的，空闲回调里读到的就是最新状态。
  useEffect(() => {
    if (!id || shownRef.current) return
    markMilestone(id, 'onboardingDone')
    let cancelled = false
    let idleHandle: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined

    const show = () => {
      if (cancelled || shownRef.current) return
      if (!canShowNudge(id)) return
      // 先记「已出现」再渲染：R4/R5/R9 都靠这一次写入生效
      shownRef.current = true
      markNudgeShown(id)
      setVisible(true)
    }

    const w = window as IdleWindow
    if (typeof w.requestIdleCallback === 'function') {
      idleHandle = w.requestIdleCallback(show, { timeout: IDLE_FALLBACK_MS * 2 })
    } else {
      timer = setTimeout(show, IDLE_FALLBACK_MS)
    }

    return () => {
      cancelled = true
      if (idleHandle != null && typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(idleHandle)
      if (timer != null) clearTimeout(timer)
    }
  }, [id])

  // Esc = 这次不要（记 snoozed 90 天），不是「永久不再提示」
  useEffect(() => {
    if (!visible || !id) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      snoozeNudge(id)
      setVisible(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [visible, id])

  if (!visible || !id) return null

  const open = () => {
    // 点链接 = 这次提示「被看见并使用」；markNudgeShown 同日幂等，不会重复计数
    markNudgeShown(id)
    navigate(SUPPORT_PATH)
  }

  const dismiss = () => {
    muteNudge(id)
    setVisible(false)
  }

  return (
    <div style={styles.row}>
      <span style={styles.text}>{t('support.nudge')}</span>
      <a
        href={SUPPORT_PATH}
        style={styles.link}
        onClick={(e) => {
          e.preventDefault()
          open()
        }}
      >
        {t('support.link')}
      </a>
      <button type="button" style={styles.dismiss} onClick={dismiss}>
        {t('support.dismiss')}
      </button>
    </div>
  )
}

const styles = {
  row: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    gap: '4px 8px',
    marginTop: 12,
    paddingTop: 10,
    borderTop: '1px solid var(--app-border-soft)',
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--app-ink-faint)',
  },
  text: {
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--app-ink-faint)',
  },
  link: {
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--app-ink-soft)',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
    cursor: 'pointer',
  },
  dismiss: {
    marginLeft: 'auto',
    padding: '2px 4px',
    border: 'none',
    background: 'none',
    fontSize: 11,
    lineHeight: 1.4,
    color: 'var(--app-ink-faint)',
    cursor: 'pointer',
  },
} as const
