import { create } from 'zustand'

/**
 * AI 助手的外壳状态。刻意和 AIPanel 的对话状态分开：
 *
 * 任务一旦发起就不该依赖面板是否可见。以前 loading 锁在 AIPanel 内部，
 * 面板一关，用户既看不到进度也不知道它还在跑，只能干等或以为死了。
 * 这里把「开/关/收起/是否在跑/有没有未读结果」提到全局，
 * 面板则改成「打开过一次就常驻挂载」，于是关掉面板 = 缩到后台继续跑。
 */
interface AiUiState {
  /** 面板是否展开（关闭不等于卸载，任务要继续跑） */
  open: boolean
  /** 画中画：收成一条窄边，只留图标和运行状态 */
  collapsed: boolean
  /** 是否曾经打开过。false 时不挂载 AIPanel，避免首屏就下载 xlsx/papaparse */
  mounted: boolean
  /** 当前是否有任务在跑 */
  running: boolean
  /** 最近一次完成的任务摘要，用于完成提示 */
  lastDone: { text: string; at: number } | null
  /** 完成时用户没在看，之后在入口上打个红点 */
  unseen: boolean
  /** 桌面停靠宽度，可拖拽调整 */
  width: number
  setOpen: (v: boolean) => void
  toggle: () => void
  setCollapsed: (v: boolean) => void
  setWidth: (n: number) => void
  beginRun: () => void
  endRun: (text: string) => void
  markSeen: () => void
}

const MIN_W = 340
const MAX_W = 720
const DEF_W = 380
const W_KEY = 'info-mgmt-ai-dock-width'

function readWidth(): number {
  try {
    const v = Number(localStorage.getItem(W_KEY))
    return Number.isFinite(v) && v >= MIN_W && v <= MAX_W ? v : DEF_W
  } catch {
    return DEF_W
  }
}

export const AI_DOCK_MIN = MIN_W
export const AI_DOCK_MAX = MAX_W

export const useAiUiStore = create<AiUiState>((set, get) => ({
  open: false,
  collapsed: false,
  mounted: false,
  running: false,
  lastDone: null,
  unseen: false,
  width: typeof localStorage === 'undefined' ? DEF_W : readWidth(),

  setOpen: (v) =>
    set({ open: v, mounted: true, collapsed: false, ...(v ? { unseen: false } : {}) }),

  toggle: () => {
    const { open, collapsed } = get()
    // 收起状态下点入口 = 直接展开，而不是先开一个空面板再让你点一次展开
    if (!open || collapsed) set({ open: true, collapsed: false, mounted: true, unseen: false })
    else set({ open: false })
  },

  setCollapsed: (v) => set({ collapsed: v, open: true, mounted: true }),

  setWidth: (n) => {
    const w = Math.min(MAX_W, Math.max(MIN_W, Math.round(n)))
    try {
      localStorage.setItem(W_KEY, String(w))
    } catch {
      /* 隐私模式下写不进去，忽略即可 */
    }
    set({ width: w })
  },

  beginRun: () => set({ running: true }),

  // 任务结束：记下摘要。若此刻用户没在看面板，标记为未读，
  // 入口会有红点，完成提示也只在「没看」时弹，避免和面板里的滚动打架。
  endRun: (text) =>
    set((s) => ({ running: false, lastDone: { text, at: Date.now() }, unseen: !s.open })),

  markSeen: () => set({ unseen: false }),
}))

/** 当前是否真的能看到 AI 面板（打开且没收起）——决定要不要弹完成提示 */
export function aiPanelVisible(s: Pick<AiUiState, 'open' | 'collapsed'>): boolean {
  return s.open && !s.collapsed
}
