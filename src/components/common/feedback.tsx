/**
 * 应用级反馈层（v10 · Fluent UI React v9）：全局轻提示（toast）+ 阻塞式确认框。
 *
 * 为什么是「模块级 API + 一个宿主组件」而不是 hook：
 *   - antd 的 `App.useApp()` 把 message/modal 绑在 React 上下文里，于是每个要用提示的文件
 *     都得 `import { App } from 'antd'` 再在组件顶部取一次（21 处样板），而真正需要上下文的
 *     只有 Fluent 的 Toaster 内部；
 *   - 调用点因此仍写成 `message.success('已保存')`，只换 import 来源，业务逻辑一行不动；
 *     非组件代码（路由守卫、事件回调）也能直接提示。
 *
 * 契约（对齐 antd 语义，逐处迁移不改行为）：
 *   message.success(content, duration?)                       默认 3 秒；duration=0 常驻
 *   message.success({ content, key, duration })               同 key 原地改写，不叠卡片
 *   message.loading({ content, key, duration: 0 })            常驻进度，随后用同 key 改成结果
 *   notification.open({ key, message, description, duration }) 标题 + 描述 + 操作区
 *   modal.confirm({ title, content, okText, cancelText,
 *                   okButtonProps: { danger }, onOk, onCancel }) onOk 返回 false 或抛错 → 弹窗不关
 *
 * 产品不变量：AI 写操作必须「确认弹窗 + 可撤回」——本文件的 modal.confirm 是这条底线的统一入口。
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Spinner,
  Toast,
  ToastBody,
  ToastFooter,
  ToastTitle,
  Toaster,
  useToastController,
  type ToastIntent,
} from '@fluentui/react-components'
import { CheckmarkCircleFilled, ErrorCircleFilled, InfoFilled, WarningFilled } from '@fluentui/react-icons'
import { useI18n } from '@/i18n'

const TOASTER_ID = 'app-feedback'
const DEFAULT_DURATION_S = 3

/* ────────────────────────────── 轻提示 ────────────────────────────── */

export interface MessageOptions {
  content?: ReactNode
  /** 同 key 复用同一个 toast（「进度 → 结果」的标准写法） */
  key?: string
  /** 秒；0 = 常驻，需用同 key 改成结果或调用 message.destroy(key) */
  duration?: number
}

interface ToastTransport {
  dispatch: (
    content: ReactNode,
    options: {
      toastId: string
      intent: ToastIntent
      timeout: number
      politeness: 'polite' | 'assertive'
      onStatusChange: (event: unknown, data: { status: string }) => void
    },
  ) => void
  update: (options: { toastId: string; content: ReactNode; intent: ToastIntent; timeout: number }) => void
  dismiss: (toastId: string) => void
}

let transport: ToastTransport | null = null
/** 仍在屏幕上的 toastId；自动消失后由 onStatusChange 摘除 */
const liveToasts = new Set<string>()
let seq = 0

function isMessageOptions(v: ReactNode | MessageOptions): v is MessageOptions {
  return typeof v === 'object' && v !== null && !('$$typeof' in (v as Record<string, unknown>))
}

const ICON_STYLE: Record<ToastIntent, string> = {
  success: 'var(--colorStatusSuccessForeground3)',
  error: 'var(--colorStatusDangerForeground3)',
  warning: 'var(--colorStatusWarningForeground3)',
  info: 'var(--colorBrandForeground1)',
}

const ICON: Record<ToastIntent, JSX.Element> = {
  success: <CheckmarkCircleFilled style={{ color: ICON_STYLE.success }} />,
  error: <ErrorCircleFilled style={{ color: ICON_STYLE.error }} />,
  warning: <WarningFilled style={{ color: ICON_STYLE.warning }} />,
  info: <InfoFilled style={{ color: ICON_STYLE.info }} />,
}

/** 秒 → 毫秒；0 或负数 = 常驻（Fluent 用 -1 表示永不自动关闭） */
function toTimeout(durationS: number | undefined): number {
  if (durationS === undefined) return DEFAULT_DURATION_S * 1000
  return durationS <= 0 ? -1 : durationS * 1000
}

function ToastView({ intent, title, body, footer }: { intent: ToastIntent; title: ReactNode; body?: ReactNode; footer?: ReactNode }) {
  return (
    <Toast>
      <ToastTitle media={ICON[intent]}>{title}</ToastTitle>
      {body ? <ToastBody>{body}</ToastBody> : null}
      {footer ? <ToastFooter>{footer}</ToastFooter> : null}
    </Toast>
  )
}

function announce(toastId: string, node: ReactNode, intent: ToastIntent, timeout: number) {
  if (!transport) return
  if (liveToasts.has(toastId)) {
    transport.update({ toastId, content: node, intent, timeout })
    return
  }
  liveToasts.add(toastId)
  transport.dispatch(node, {
    toastId,
    intent,
    timeout,
    politeness: intent === 'error' ? 'assertive' : 'polite',
    onStatusChange: (_event, data) => {
      if (data.status === 'dismissed' || data.status === 'unmounted') liveToasts.delete(toastId)
    },
  })
}

function show(intent: ToastIntent, arg: ReactNode | MessageOptions, duration?: number): string {
  // 有 key 就把它当作 toastId：同 key 天然复用同一条，也方便 destroy(key)
  if (isMessageOptions(arg)) {
    const toastId = arg.key ?? `${TOASTER_ID}-${++seq}`
    announce(toastId, <ToastView intent={intent} title={arg.content} />, intent, toTimeout(arg.duration ?? duration))
    return toastId
  }
  const toastId = `${TOASTER_ID}-${++seq}`
  announce(toastId, <ToastView intent={intent} title={arg} />, intent, toTimeout(duration))
  return toastId
}

export const message = {
  success(arg: ReactNode | MessageOptions, duration?: number) {
    return show('success', arg, duration)
  },
  error(arg: ReactNode | MessageOptions, duration?: number) {
    return show('error', arg, duration)
  },
  warning(arg: ReactNode | MessageOptions, duration?: number) {
    return show('warning', arg, duration)
  },
  info(arg: ReactNode | MessageOptions, duration?: number) {
    return show('info', arg, duration)
  },
  /** 常驻进度：默认 duration=0，必须用同 key 改成结果（或 destroy）才会消失 */
  loading(arg: ReactNode | MessageOptions, duration?: number) {
    const opts = isMessageOptions(arg) ? arg : { content: arg }
    return show(
      'info',
      {
        key: opts.key,
        duration: opts.duration ?? duration ?? 0,
        content: (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Spinner size="tiny" />
            <span>{opts.content}</span>
          </span>
        ),
      },
      0,
    )
  },
  open(opts: MessageOptions & { type?: ToastIntent }) {
    return show(opts.type ?? 'info', opts)
  },
  /** 关闭：传 show 时的 key，或 show 返回的 toastId */
  destroy(idOrKey?: string) {
    if (!idOrKey) return
    liveToasts.delete(idOrKey)
    transport?.dismiss(idOrKey)
  },
}

/* ─────────────────── 通知（标题 + 描述 + 操作，用于「AI 已完成」） ─────────────────── */

export interface NoticeOptions {
  key?: string
  message: ReactNode
  description?: ReactNode
  duration?: number
  actions?: ReactNode
}

export const notification = {
  open(opts: NoticeOptions) {
    const toastId = opts.key ?? `${TOASTER_ID}-${++seq}`
    announce(
      toastId,
      <ToastView intent="info" title={opts.message} body={opts.description} footer={opts.actions} />,
      'info',
      toTimeout(opts.duration),
    )
    return toastId
  },
  destroy: message.destroy,
}

/* ────────────────────────────── 确认框 ────────────────────────────── */

export interface ConfirmOptions {
  title: ReactNode
  content?: ReactNode
  okText?: string
  cancelText?: string
  /** antd 兼容形状（`okButtonProps: { danger: true }`） */
  okButtonProps?: { danger?: boolean }
  danger?: boolean
  /** 返回 false（或抛错）时弹窗保持打开——「校验不过就别关」 */
  onOk?: () => unknown | Promise<unknown>
  onCancel?: () => void
  /** 确认按钮进行中的文案；默认沿用 okText */
  confirmingText?: string
}

interface ConfirmEntry extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

let confirmQueue: ConfirmEntry[] = []
const confirmListeners = new Set<() => void>()

function emitConfirm() {
  for (const l of confirmListeners) l()
}

function subscribeConfirm(listener: () => void) {
  confirmListeners.add(listener)
  return () => {
    confirmListeners.delete(listener)
  }
}

function settleConfirm(entry: ConfirmEntry, ok: boolean) {
  confirmQueue = confirmQueue.filter((e) => e !== entry)
  emitConfirm()
  entry.resolve(ok)
}

export const modal = {
  /** 阻塞式确认：返回 Promise<boolean>；同时兼容 antd 的 onOk/onCancel 回调写法 */
  confirm(opts: ConfirmOptions): Promise<boolean> {
    // 不用 Promise.withResolvers()：tsconfig 的 lib 是 ES2020，且需兼容较旧的 Android WebView
    return new Promise<boolean>((resolve) => {
      confirmQueue = [...confirmQueue, { ...opts, resolve }]
      emitConfirm()
    })
  },
}

/* ────────────────────────────── 宿主 ────────────────────────────── */

function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(query).matches))
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia(query)
    const onChange = () => setMatch(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return match
}

function ConfirmHost() {
  const t = useI18n()
  const entry = useSyncExternalStore(
    subscribeConfirm,
    () => confirmQueue[0] ?? null,
    () => confirmQueue[0] ?? null,
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setBusy(false)
  }, [entry])

  const cancel = useCallback(() => {
    if (!entry) return
    entry.onCancel?.()
    settleConfirm(entry, false)
  }, [entry])

  const ok = useCallback(async () => {
    if (!entry) return
    setBusy(true)
    try {
      if ((await entry.onOk?.()) === false) {
        setBusy(false)
        return
      }
    } catch (err) {
      console.error('[confirm] onOk failed', err)
      setBusy(false)
      return
    }
    settleConfirm(entry, true)
  }, [entry])

  const danger = entry?.danger ?? entry?.okButtonProps?.danger ?? false

  return (
    <Dialog
      open={!!entry}
      modalType="alert"
      onOpenChange={(_, data) => {
        if (!data.open && !busy) cancel()
      }}
    >
      <DialogSurface style={{ maxWidth: 'min(460px, calc(100vw - 32px))' }}>
        <DialogBody>
          <DialogTitle>{entry?.title}</DialogTitle>
          {entry?.content ? <DialogContent>{entry.content}</DialogContent> : null}
          <DialogActions>
            <Button appearance="secondary" onClick={cancel} disabled={busy}>
              {entry?.cancelText ?? t('common.cancel')}
            </Button>
            <Button
              appearance="primary"
              onClick={ok}
              disabled={busy}
              style={
                danger
                  ? { backgroundColor: 'var(--colorStatusDangerBackground3)', color: 'var(--colorNeutralForegroundOnBrand)' }
                  : undefined
              }
            >
              {busy ? (entry?.confirmingText ?? entry?.okText ?? t('common.confirm')) : (entry?.okText ?? t('common.confirm'))}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

/** 挂在 FluentProvider 内部一次即可；卸载（测试/HMR）时摘掉 transport，调用自动降级为 no-op */
export function FeedbackHost() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const controller = useToastController(TOASTER_ID)
  // 每次渲染都刷新实现，但 transport 只挂一次（见下方空依赖 effect）
  const latest = useRef(controller)
  latest.current = controller

  useEffect(() => {
    transport = {
      dispatch: (content, options) => latest.current.dispatchToast(content, options),
      update: (options) => latest.current.updateToast(options),
      dismiss: (toastId) => latest.current.dismissToast(toastId),
    }
    return () => {
      transport = null
      liveToasts.clear()
    }
  }, [])

  return (
    <>
      {/* 移动端底部有 56px 标签栏，toast 落到顶部避免遮挡 */}
      <Toaster toasterId={TOASTER_ID} position={isMobile ? 'top' : 'bottom-end'} limit={3} pauseOnHover />
      <ConfirmHost />
    </>
  )
}
