// 首次注册「关于作者 + 赞赏码」欢迎卡（每账号只弹一次）。
//
// 依据：`redesign-brief/05-first-run-support.md` §C（结构与逐字文案）、§D.4（形态）、
//       TOKENS-v3 §6（本轮新增）、§7（禁止项）。
// 契约（Lead 定稿）：**受控组件**，`{ open, accountId, onClose }`；
//   挂载/卸载与「该不该显示」全由宿主（AppShell）决定，本组件不消费 pending、不判断 seen；
//   关闭时先 `markWelcomeSeen(accountId)` 再 `onClose()`，四种关闭方式（× / Esc / 点遮罩 /「开始使用」）
//   全部走同一条 close 路径。android 返回键**不在本组件注册**：按 backButton.ts 的契约，
//   受控弹层的返回键由持有 open 的父级（AppShell）调 useBackButtonLayer 注册，本组件自注册会多压一条历史条目。
// 三条不可退让的底线（§0）：
//   1) 不阻塞：任何一条关闭路径都能立刻进入应用；
//   2) 首屏正文必须可见「不扫，功能和体验完全一样」；
//   3) 主按钮是「开始使用」，二维码只是卡片里的次要内容（不做最大视觉、不在按钮上）。
// 视觉：antd Modal 的白面/12 圆角/shadow-3/遮罩/标题 20/600 已由 Lead 的全局 CSS 统一收编
//      （`src/styles/index.css` 的 `.ant-modal*` 段），本组件不再写卡面样式。
import { Modal, Button } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import { useI18n, type TFunc } from '@/i18n'
import { markWelcomeSeen } from '@/utils/welcome'
import RewardQr from './RewardQr'

/**
 * 一行回退开关（§A.5）：供宿主引用——置 false 即整体降级为「设置页常驻，首进不弹」。
 * 组件本身不做判断（受控契约），因此这个常量只表达「产品级开关」，由 AppShell 决定是否渲染。
 */
export const FIRST_RUN_SUPPORT_ENABLED = true

/** 码区尺寸：240–248（§C.1 / §D.6，低于 240 手机微信难扫） */
const QR_SIZE = 248

/**
 * i18n key 与中文兜底（frontend-analyst 会补 welcome.*；缺 key 时 t() 会原样返回 key，
 * 这里检测到这种情况就用 §C.4 的逐字兜底，保证 key 落地前不露 key、不空白）。
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
    markWelcomeSeen(accountId)
    onClose()
  }

  return (
    <Modal
      open={open}
      onCancel={close}
      centered
      width="min(420px, calc(100vw - 32px))"
      title={
        <div>
          <div className="eyebrow" style={styles.eyebrow}>
            {copy.eyebrow}
          </div>
          <div className="page-title-sm" style={styles.title}>
            {copy.title}
          </div>
        </div>
      }
      footer={null}
      maskClosable
      keyboard
      closable={{ closeIcon: <CloseOutlined />, 'aria-label': copy.closeAria }}
    >
      <p style={styles.body}>{copy.body1}</p>
      <p style={styles.body}>{copy.body2}</p>

      <div style={styles.qrRow}>
        <RewardQr size={QR_SIZE} />
        <div style={styles.notes}>
          <div style={styles.scan}>{copy.scan}</div>
          <div style={styles.note}>{copy.privacy}</div>
        </div>
      </div>

      <div className="welcome-actions" style={styles.actions}>
        {/* 初始焦点放主按钮，不放码上（§D.6） */}
        <Button type="primary" size="large" autoFocus onClick={close} style={styles.startBtn}>
          {copy.start}
        </Button>
      </div>

      <div style={styles.once}>{copy.once}</div>
    </Modal>
  )
}

const styles = {
  eyebrow: {
    marginBottom: 'var(--space-1)',
  },
  title: {
    whiteSpace: 'normal' as const,
  },
  body: {
    margin: '0 0 var(--space-3)',
    fontSize: 'var(--text-sm)',
    lineHeight: 1.65,
    color: 'var(--ink-muted)',
  },
  qrRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'flex-start',
    gap: 'var(--space-4)',
    margin: 'var(--space-4) 0 var(--space-5)',
  },
  notes: {
    flex: '1 1 120px',
    minWidth: 120,
    paddingTop: 4,
  },
  scan: {
    fontSize: 'var(--text-2xs)',
    lineHeight: 1.5,
    fontWeight: 500,
    color: 'var(--ink)',
  },
  note: {
    marginTop: 'var(--space-1)',
    fontSize: 'var(--text-2xs)',
    lineHeight: 1.5,
    color: 'var(--ink-faint)',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  startBtn: {
    minWidth: 128,
    fontWeight: 500,
  },
  once: {
    marginTop: 'var(--space-3)',
    fontSize: 'var(--text-2xs)',
    lineHeight: 1.5,
    color: 'var(--ink-muted)',
  },
} as const
