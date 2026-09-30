import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Button, Spin, Tooltip } from 'antd'
import {
  CloseOutlined,
  VerticalLeftOutlined,
  DownOutlined,
  RobotOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import { useAiUiStore, AI_DOCK_MIN, AI_DOCK_MAX } from '@/store/aiUiStore'
import { useI18n } from '@/i18n'

// AI 面板依赖 xlsx / papaparse / react-markdown 等重包，只有真正打开过才下载
const AIPanel = lazy(() => import('@/components/ai/AIPanel'))

const SHEET_H = 0.68 // 手机底部抽屉默认高度（占视口比例）

/**
 * AI 助手的承载外壳。
 *
 * 之前用 antd <Drawer>，而 Drawer 的 mask 默认是 true，一打开就给整页加遮罩，
 * 底下什么都点不了；而且它是盖在内容上的，表格被压住但看不见。
 * 调研（微软 Copilot UX 指南、Wiley《UX for AI》）的结论一致：
 * 常驻助手应该是「把内容推到左边」，而不是盖住内容，另外给一个画中画形态。
 *
 * 所以：
 * - 桌面：右侧停靠列，flex 参与布局，内容区自动变窄，可用
 * - 手机：底部抽屉，只占下半屏，上面的内容还能看能滚
 * - 两者都不带遮罩；收起时是一条 44px 窄边（画中画）
 * - 打开过一次就常驻挂载，关掉只是隐藏，任务继续在后台跑
 */
export default function AIDock({ variant }: { variant: 'dock' | 'sheet' }) {
  const t = useI18n()
  const open = useAiUiStore((s) => s.open)
  const collapsed = useAiUiStore((s) => s.collapsed)
  const mounted = useAiUiStore((s) => s.mounted)
  const running = useAiUiStore((s) => s.running)
  const width = useAiUiStore((s) => s.width)
  const setOpen = useAiUiStore((s) => s.setOpen)
  const setCollapsed = useAiUiStore((s) => s.setCollapsed)
  const setWidth = useAiUiStore((s) => s.setWidth)

  const [sheetFull, setSheetFull] = useState(false)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)

  // 拖拽调宽（桌面）。宽度存到 localStorage，下次还在。
  const onResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      dragRef.current = { startX: e.clientX, startW: width }
      const move = (ev: PointerEvent) => {
        if (!dragRef.current) return
        // 边在左边，往左拖是变宽
        setWidth(dragRef.current.startW + (dragRef.current.startX - ev.clientX))
      }
      const up = () => {
        dragRef.current = null
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [width, setWidth],
  )

  // Esc 收起（桌面）；手机上 Esc 在软键盘里，不劫持
  useEffect(() => {
    if (variant !== 'dock') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useAiUiStore.getState().open) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [variant, setOpen])

  if (!mounted) return null

  const hidden = !open

  if (variant === 'sheet') {
    // ── 手机：底部抽屉 ──────────────────────────────────────────
    const h = sheetFull ? 0.92 : SHEET_H
    return (
      <>
        {collapsed && (
          <button type="button" className="ai-sheet-peek" onClick={() => setCollapsed(false)}>
            <RobotOutlined />
            <span>{t('app.aiAssistant')}</span>
            {running && <LoadingOutlined spin />}
            {running ? <span className="ai-pulse" /> : <span className="ai-peek-open">{t('ai.open')}</span>}
          </button>
        )}
        <section
          className="ai-sheet"
          style={{
            height: `${h * 100}dvh`,
            transform: hidden ? 'translateY(101%)' : 'translateY(0)',
            visibility: hidden ? 'hidden' : 'visible',
          }}
          aria-hidden={hidden}
        >
          <div className="ai-sheet-bar" onClick={() => setSheetFull((v) => !v)}>
            <span className="ai-sheet-grip" />
          </div>
          <DockHeader
            title={t('app.aiAssistant')}
            running={running}
            collapseIcon={<DownOutlined />}
            onCollapse={() => setCollapsed(true)}
            onClose={() => setOpen(false)}
          />
          <div className="ai-dock-body">
            <Suspense fallback={<PanelLoading label={t('ai.loadingPanel')} />}>
              <AIPanel />
            </Suspense>
          </div>
        </section>
      </>
    )
  }

  // ── 桌面：右侧停靠列 ─────────────────────────────────────────
  // 注意：关闭时不能用 `return null` —— 那会把 AIPanel 一起卸载，
  // 正在跑的任务会被连带杀掉，「关掉面板继续在后台跑」就落空了。
  // 这里保持挂载，只用 display:none 移出布局。
  if (collapsed) {
    return (
      <aside className="ai-dock-collapsed" aria-label={t('app.aiAssistant')}>
        <Button type="text" className="tap" onClick={() => setCollapsed(false)} aria-label={t('ai.open')}>
          <RobotOutlined />
        </Button>
        {running && <span className="ai-pulse" title={t('ai.runningInBackground')} />}
        <Button
          type="text"
          className="tap"
          onClick={() => setOpen(false)}
          aria-label={t('common.close')}
        >
          <CloseOutlined />
        </Button>
      </aside>
    )
  }

  return (
    <>
      {!hidden && (
        <div
          className="ai-dock-resizer"
          onPointerDown={onResizeStart}
          role="separator"
          aria-orientation="vertical"
          title={t('ai.resize')}
        />
      )}
      <aside
        className="ai-dock"
        style={hidden ? { display: 'none' } : { width }}
        aria-label={t('app.aiAssistant')}
      >
        <DockHeader
          title={t('app.aiAssistant')}
          running={running}
          onCollapse={() => setCollapsed(true)}
          onClose={() => setOpen(false)}
        />
        <div className="ai-dock-body">
          <Suspense fallback={<PanelLoading label={t('ai.loadingPanel')} />}>
            <AIPanel />
          </Suspense>
        </div>
      </aside>
    </>
  )
}

function DockHeader({
  title,
  running,
  collapseIcon,
  onCollapse,
  onClose,
}: {
  title: string
  running: boolean
  collapseIcon?: React.ReactNode
  onCollapse: () => void
  onClose: () => void
}) {
  const t = useI18n()
  return (
    <header className="ai-dock-head">
      <RobotOutlined className="ai-dock-icon" />
      <span className="ai-dock-title">{title}</span>
      {running && (
        <span className="ai-dock-running" title={t('ai.runningInBackground')}>
          <LoadingOutlined spin />
          <span className="ai-dock-running-text">{t('ai.running')}</span>
        </span>
      )}
      <span style={{ flex: 1 }} />
      <Tooltip title={t('ai.collapse')}>
        <Button type="text" size="small" onClick={onCollapse} aria-label={t('ai.collapse')}>
          {collapseIcon ?? <VerticalLeftOutlined />}
        </Button>
      </Tooltip>
      <Tooltip title={t('common.close')}>
        <Button type="text" size="small" onClick={onClose} aria-label={t('common.close')}>
          <CloseOutlined />
        </Button>
      </Tooltip>
    </header>
  )
}

function PanelLoading({ label }: { label: string }) {
  return (
    <div className="ai-panel-loading">
      <Spin size="small" />
      <span>{label}</span>
    </div>
  )
}

export { AI_DOCK_MAX, AI_DOCK_MIN }
