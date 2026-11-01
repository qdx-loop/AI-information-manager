// 首次注册「关于作者 + 赞赏码」欢迎卡（每账号只弹一次）。
//
// 依据：`redesign-brief/05-first-run-support.md` §C（结构与逐字文案）、§D.4（形态，文案/状态机一字不改）、
//       `redesign-brief/06-v4-signal-press.md` §8.9（v4 视觉：头部 ink 条 + Outfit 800 标题 + Work Sans 15 正文
//       + QR 白色卡面 2px ink 边 + lime 唯一 CTA + mono 页脚）。
// 契约（Lead 定稿）：**受控组件**，`{ open, accountId, onClose }`；
//   挂载/卸载与「该不该显示」全由宿主（AppShell）决定，本组件不消费 pending、不判断 seen；
//   关闭时先 `markWelcomeSeen(accountId)` 再 `onClose()`，四种关闭方式（× / Esc / 点遮罩 /「开始使用」）
//   全部走同一条 close 路径。android 返回键由持有 open 的父级（AppShell）注册，本组件不重复注册。
// 三条不可退让的底线（05 §0）：
//   1) 不阻塞：任何一条关闭路径都能立刻进入应用；
//   2) 首屏正文必须可见「不扫，功能和体验完全一样」；
//   3) 主按钮是「开始使用」，二维码只是卡片里的次要内容（不做最大视觉、不在按钮上）。
// 视觉：弹窗外壳（sheet 面 / 2px ink / 0 圆角 / shadow-3 / 遮罩 / 关闭键）由 Lead 的全局 CSS 统一收编。
import { Modal, Button } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
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
      width="min(440px, calc(100vw - 32px))"
      title={
        <div style={styles.head}>
          <div className="page-kicker" style={styles.kicker}>
            {/* 「ABOUT / 关于作者」：拉丁 kicker + 中文说明；两段分开放，读屏与测试都能单独命中 */}
            <span>ABOUT</span>
            <span style={styles.kickerSep}>/</span>
            <span style={styles.kickerZh}>{copy.eyebrow}</span>
          </div>
          <div className="page-title-sm" style={styles.title}>
            {copy.title}
          </div>
        </div>
      }
      footer={null}
      maskClosable
      keyboard
      closable={{ closeIcon: <CloseOutlined style={{ color: 'var(--on-ink)' }} />, 'aria-label': copy.closeAria }}
      styles={{
        header: styles.modalHeader,
      }}
    >
      <p style={styles.body}>{copy.body1}</p>
      <p style={styles.body}>{copy.body2}</p>

      <div style={styles.qrRow}>
        <RewardQr size={QR_SIZE} />
        <div style={styles.notes}>
          <div className="mono" style={styles.scan}>
            {copy.scan}
          </div>
          <div className="mono" style={styles.note}>
            {copy.privacy}
          </div>
        </div>
      </div>

      <div className="welcome-actions">
        {/* 初始焦点放主按钮，不放码上（05 §D.6） */}
        <Button type="primary" size="large" autoFocus onClick={close} style={styles.startBtn}>
          {copy.start}
        </Button>
      </div>

      <div className="mono" style={styles.once}>
        {copy.once}
      </div>
    </Modal>
  )
}

const styles = {
  // 头部 ink 条（v4 §8.9）：mono kicker + lime 方块 + Outfit 800 标题；右侧留出关闭键位置
  modalHeader: {
    background: 'var(--ink)',
    borderBottom: 'var(--bw) solid var(--line)',
    padding: '14px 56px 14px 20px',
    margin: 0,
  },
  head: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--s2)',
  },
  kicker: {
    // .page-kicker 默认 ink-faint，在 ink 底上要反白
    color: 'var(--on-ink)',
  },
  kickerSep: {
    color: 'var(--on-ink)',
    opacity: 0.5,
    margin: '0 2px',
  },
  kickerZh: {
    // 中文不进等宽：正文族 + 正常字距
    fontFamily: 'var(--font-body)',
    letterSpacing: 0,
    textTransform: 'none' as const,
    fontWeight: 600,
  },
  title: {
    color: 'var(--on-ink)',
    letterSpacing: '-0.02em',
    whiteSpace: 'normal' as const,
  },
  body: {
    margin: '0 0 var(--s3)',
    fontSize: 'var(--t-base)',
    lineHeight: 1.65,
    color: 'var(--ink-soft)',
  },
  qrRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'flex-start',
    gap: 'var(--s4)',
    margin: 'var(--s4) 0 var(--s5)',
  },
  notes: {
    flex: '1 1 120px',
    minWidth: 120,
    paddingTop: 'var(--s1)',
  },
  scan: {
    fontSize: 'var(--t-xs)',
    lineHeight: 1.4,
    fontWeight: 600,
    color: 'var(--ink)',
  },
  note: {
    marginTop: 'var(--s2)',
    fontSize: 'var(--t-xs)',
    lineHeight: 1.4,
    color: 'var(--ink-soft)',
  },
  startBtn: {
    minWidth: 128,
  },
  once: {
    marginTop: 'var(--s4)',
    fontSize: 'var(--t-2xs)',
    lineHeight: 1.3,
    letterSpacing: '0.04em',
    color: 'var(--ink-faint)',
  },
} as const
