// 首次注册「关于作者 + 赞赏码」欢迎卡（每账号只弹一次）· v10 Fluent Dialog。
//
// 依据：`redesign-brief/05-first-run-support.md` §C（结构与逐字文案）、§D.4（形态，文案/状态机一字不改）。
// 契约（Lead 定稿）：**受控组件**，`{ open, accountId, onClose }`；
//   挂载/卸载与「该不该显示」全由宿主（AppShell）决定，本组件不消费 pending、不判断 seen；
//   关闭时先 `markWelcomeSeen(accountId)` 再 `onClose()`，四种关闭方式（× / Esc / 点遮罩 /「开始使用」）
//   全部走同一条 close 路径。android 返回键由持有 open 的父级（AppShell）注册，本组件不重复注册。
// 三条不可退让的底线（05 §0）：
//   1) 不阻塞：任何一条关闭路径都能立刻进入应用；
//   2) 首屏正文必须可见「不扫，功能和体验完全一样」；
//   3) 主按钮是「开始使用」，二维码只是卡片里的次要内容（不做最大视觉、不在按钮上）。
//
// v10 视觉：真实 Fluent UI React v9 Dialog（DialogSurface / DialogBody / DialogTitle / DialogContent /
// DialogActions + Button/Card/Text），QR 白底 Card；文案逐字不变。
// 兼容说明：既有组件契约测试 `WelcomeModal.test.tsx` 以 `.ant-modal-wrap` 定位遮罩，
//   这里把该 class 挂到 Fluent dialog 的 backdrop slot 上作为**测试钩子**（不影响视觉），
//   点击/按键仍走同一条 close 路径；close 做了幂等保护，避免 Fluent 内部 close 与
//   backdrop 回调叠加导致 onClose 被调用两次。
import { useEffect, useRef } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Text,
} from '@fluentui/react-components'
import { DismissRegular, HeartRegular } from '@fluentui/react-icons'
import { useI18n, type TFunc } from '@/i18n'
import { markWelcomeSeen } from '@/utils/welcome'
import RewardQr from './RewardQr'

/**
 * 一行回退开关（05 §A.5）：供宿主引用——置 false 即整体降级为「设置页常驻，首进不弹」。
 * 组件本身不做判断（受控契约），因此这个常量只表达「产品级开关」，由 AppShell 决定是否渲染。
 */
export const FIRST_RUN_SUPPORT_ENABLED = true

/** 码区尺寸：240–248（05 §C.1 / §D.6，低于 240 手机微信难扫） */
const QR_SIZE = 248

/**
 * i18n key 与中文兜底（frontend-analyst 会补 welcome.*；缺 key 时 t() 会原样返回 key，
 * 这里检测到这种情况就用 05 §C.4 的逐字兜底，保证 key 落地前不露 key、不空白）。
 */
const FALLBACK = {
  eyebrow: '关于作者',
  title: '这个工具是我一个人维护的',
  body1: '你刚注册的这个工具，没有付费版，也没有广告。服务器在免费额度里撑着，主要花的是时间。',
  body2: '下面这个码是自愿的：不扫，功能和体验完全一样。以后想找它，在「设置 → 关于与支持」里，一直都在。',
  scan: '微信扫码 · 金额自定',
  privacy: '我只会看到昵称和留言，看不到你的账号和数据',
  start: '开始使用',
  once: '这个提示只出现一次。',
  closeAria: '关闭，以后可在「设置 → 关于与支持」找到',
} as const

function tx(t: TFunc, key: string, fallback: string): string {
  const v = t(key)
  return v === key ? fallback : v
}

export interface WelcomeModalProps {
  /** 是否打开（宿主持有） */
  open: boolean
  /** 当前账号（写 seen 用，按账号隔离） */
  accountId: string
  /** 关闭回调（宿主持有；组件已先写 seen） */
  onClose: () => void
}

export default function WelcomeModal({ open, accountId, onClose }: WelcomeModalProps) {
  const t = useI18n()
  // close 幂等：Fluent Dialog 的 onOpenChange 与 backdrop 原生回调可能同时触发
  const closingRef = useRef(false)
  useEffect(() => {
    if (open) closingRef.current = false
  }, [open])

  const copy = {
    eyebrow: tx(t, 'welcome.eyebrow', FALLBACK.eyebrow),
    title: tx(t, 'welcome.title', FALLBACK.title),
    body1: tx(t, 'welcome.body1', FALLBACK.body1),
    body2: tx(t, 'welcome.body2', FALLBACK.body2),
    scan: tx(t, 'welcome.scan', FALLBACK.scan),
    privacy: tx(t, 'welcome.privacy', FALLBACK.privacy),
    start: tx(t, 'welcome.start', FALLBACK.start),
    once: tx(t, 'welcome.once', FALLBACK.once),
    closeAria: tx(t, 'welcome.closeAria', FALLBACK.closeAria),
  }

  // × / Esc / 点遮罩 → onCancel；「开始使用」→ 按钮；android 返回由 AppShell 注册的层触发 onClose
  const close = () => {
    if (closingRef.current) return
    closingRef.current = true
    markWelcomeSeen(accountId)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(_, data) => (!data.open ? close() : undefined)}>
      <DialogSurface
        className="pub-dialog"
        backdrop={{
          // 测试钩子：既有契约测试用 .ant-modal-wrap 定位遮罩层（视觉由 Fluent 提供）
          className: 'ant-modal-wrap',
          'aria-hidden': true,
          onClick: close,
          onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Escape') close()
          },
        }}
      >
        <DialogBody>
          <DialogTitle
            action={
              <Button
                appearance="subtle"
                icon={<DismissRegular />}
                aria-label={copy.closeAria}
                onClick={close}
              />
            }
          >
            {copy.title}
          </DialogTitle>
          <DialogContent>
            <div className="pub-dlg-eyebrow">
              <HeartRegular fontSize={14} aria-hidden />
              <Text size={200}>{copy.eyebrow}</Text>
            </div>
            <Text as="p" size={300} className="pub-dlg-body">
              {copy.body1}
            </Text>
            <Text as="p" size={300} className="pub-dlg-body">
              {copy.body2}
            </Text>

            <div className="pub-dlg-qr">
              <RewardQr size={QR_SIZE} />
              <div className="pub-dlg-notes">
                <Text size={300} weight="semibold">
                  {copy.scan}
                </Text>
                <Text size={200} className="w-faint">
                  {copy.privacy}
                </Text>
              </div>
            </div>

            <Text as="p" size={200} className="w-faint pub-dlg-foot">
              {copy.once}
            </Text>
          </DialogContent>
          <DialogActions>
            {/* 初始焦点放主按钮，不放码上（05 §D.6） */}
            <Button appearance="primary" size="large" autoFocus onClick={close} className="pub-dlg-start">
              {copy.start}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
