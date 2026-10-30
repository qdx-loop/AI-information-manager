import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Button, Spin, Tooltip } from 'antd'
import {
  CloseOutlined,
  VerticalLeftOutlined,
  DownOutlined,
} from '@ant-design/icons'
import { useAiUiStore, AI_DOCK_MIN, AI_DOCK_MAX } from '@/store/aiUiStore'
import { useI18n } from '@/i18n'
import { useBackButtonLayer } from '@/utils/backButton'

// AI 面板依赖 xlsx / papaparse / react-markdown 等重包，只有真正打开过才下载
const AIPanel = lazy(() => import('@/components/ai/AIPanel'))

const SHEET_RATIO = 0.68 // 手机底部抽屉默认高度（占视口比例）

/**
 * AI 助手的承载外壳。
 *
 * 之前用 antd <Drawer>，而 Drawer 的 mask 默认是 true，一打开就给整页加遮罩，
 * 底下什么都点不了；而且它是盖在内容上的，表格被压住但看不见。
 * 调研（微软 Copilot UX 指南、Wiley《UX for AI》）的结论一致：
 * 常驻助手应该是「把内容推到左边」，而不是盖住内容，另外给一个画中画形态。
 *
 * 关键实现约束：**只渲染一份 DOM**。
 * 之前桌面（右侧停靠列）和手机（底部抽屉）是两个独立的 JSX 分支，
 * 跨越 768px 缩放窗口时分支切换会把 AIPanel 整个卸载重建 ——
 * abortRef 丢失、正在跑的任务被静默中断。现在两种形态共用同一个节点，
 * 只靠 class 切换外观，任务跨形态、跨断点都能存活。
 */
export default function AIDock({ variant }: { variant: 'dock' | 'sheet' }) {
  const t = useI18n()
  const open = useAiUiStore((s) => s.open)
  const collapsed = useAiUiStore((s) => s.collapsed)
  const mounted = useAiUiStore((s) => s.mounted)
  const running = useAiUiStore((s) => s.running)
  const width = useAiUiStore((s) => s.width)
  const unseen = useAiUiStore((s) => s.unseen)
  const setOpen = useAiUiStore((s) => s.setOpen)
  const setCollapsed = useAiUiStore((s) => s.setCollapsed)
  const setWidth = useAiUiStore((s) => s.setWidth)
  const markSeen = useAiUiStore((s) => s.markSeen)

  const [sheetFull, setSheetFull] = useState(false)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)

  // 面板真正可见时清掉未读红点（之前 markSeen 全项目无人调用，红点永远不消）
  useEffect(() => {
    if (open && !collapsed) markSeen()
  }, [open, collapsed, markSeen])

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
      // pointercancel 和 blur 也要清理：指针在窗口外松开、或手势被系统取消（触屏滚动）
      // 时不会触发 pointerup。少了这两个分支，move 监听会永久留在 window 上，
      // 之后每次鼠标移动都写一遍 localStorage，且下次拖拽会再叠一份。
      const end = () => {
        dragRef.current = null
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', end)
        window.removeEventListener('pointercancel', end)
        window.removeEventListener('blur', end)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', end)
      window.addEventListener('pointercancel', end)
      window.addEventListener('blur', end)
    },
    [width, setWidth],
  )

  // 底部抽屉下滑关闭
  const sheetTouch = useRef<{ startY: number } | null>(null)
  const onSheetTouchStart = (e: React.TouchEvent) => {
    sheetTouch.current = { startY: e.touches[0].clientY }
  }
  const onSheetTouchEnd = (e: React.TouchEvent) => {
    const start = sheetTouch.current?.startY
    sheetTouch.current = null
    if (start == null) return
    const dy = e.changedTouches[0].clientY - start
    if (dy > 60) setCollapsed(true) // 往下拖 = 收成小条
    else setSheetFull((v) => !v) // 轻点/上推 = 切换高度
  }

  // 安卓返回键此前关不掉这个抽屉 —— 而 backButton 的注释里「AI 抽屉」正是它要解决的场景，
  // 唯独这里漏了注册。结果 PWA 上按实体返回键会把整个页面换掉，而不是关掉眼前这层。
  // 只在手机抽屉形态注册：桌面是右侧停靠列，返回键应当留给路由导航。
  // 状态（open）在 aiUiStore 里、组件自己读，所以由本组件登记，符合「状态在哪一层谁注册」。
  useBackButtonLayer(variant === 'sheet' && open && !collapsed, () => setOpen(false))

  // Esc 关闭。只在没有模态层时接管，否则在 AI 的确认弹窗里按 Esc
  // 会把弹窗和整个 AI 面板一起关掉，任务虽然在跑但用户失去了上下文。
  useEffect(() => {
    if (variant !== 'dock') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (!useAiUiStore.getState().open) return
      if (document.querySelector('.ant-modal-wrap, .ant-drawer-open')) return
      setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [variant, setOpen])

  if (!mounted) return null

  const hidden = !open
  const isSheet = variant === 'sheet'

  // ── 画中画：一条窄边（桌面）/ 一个药丸（手机） ──
  if (collapsed) {
    return isSheet ? (
      <button type="button" className="ai-sheet-peek" onClick={() => setCollapsed(false)}>
        <span className="ai-dock-title">AI</span>
        <span>{t('ai.clerk')}</span>
        {running ? <span className="ai-pulse" /> : <span className="ai-peek-open">{t('ai.open')}</span>}
      </button>
    ) : (
      <aside className="ai-dock-collapsed" aria-label={t('app.aiAssistant')}>
        <Button
          type="text"
          className="tap"
          onClick={() => setCollapsed(false)}
          aria-label={t('ai.open')}
          title={t('ai.open')}
        >
          <span className="ai-mono-mark">记</span>
        </Button>
        {running && <span className="ai-pulse" title={t('ai.runningInBackground')} />}
        {!running && unseen && <span className="ai-fab-dot" aria-hidden />}
        <Button
          type="text"
          className="tap"
          onClick={() => setOpen(false)}
          aria-label={t('common.close')}
          title={t('common.close')}
        >
          <CloseOutlined />
        </Button>
      </aside>
    )
  }

  // ── 展开态：单一 DOM，靠 class 切形态 ──
  const cls = [
    'ai-host',
    isSheet ? 'ai-host-sheet' : 'ai-host-dock',
    hidden ? 'is-hidden' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      {!isSheet && !hidden && (
        <div
          className="ai-dock-resizer"
          onPointerDown={onResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label={t('ai.resize')}
          aria-valuenow={width}
          aria-valuemin={AI_DOCK_MIN}
          aria-valuemax={AI_DOCK_MAX}
          tabIndex={0}
          onKeyDown={(e) => {
            // 拖拽条也要能用键盘调
            if (e.key === 'ArrowLeft') setWidth(width + 24)
            if (e.key === 'ArrowRight') setWidth(width - 24)
          }}
          title={t('ai.resize')}
        />
      )}
      <aside
        className={cls}
        style={
          isSheet
            ? {
                // 底栏现在浮在抽屉下方（CSS 里 bottom: var(--mobile-tabs-h)），
                // 92dvh 会顶出屏幕，所以按可用高度夹一下，顶部留出抓手/标题的位置
                height: `min(${sheetFull ? 92 : SHEET_RATIO * 100}dvh, calc(100dvh - var(--mobile-tabs-h, 0px) - 76px))`,
              }
            : { width }
        }
        aria-label={t('app.aiAssistant')}
        aria-hidden={hidden}
      >
        {isSheet && (
          <div
            className="ai-sheet-bar"
            onClick={() => setSheetFull((v) => !v)}
            onTouchStart={onSheetTouchStart}
            onTouchEnd={onSheetTouchEnd}
          >
            <span className="ai-sheet-grip" />
          </div>
        )}
        <header className="ai-dock-head">
          <span className="ai-dock-title">{t('ai.clerk')}</span>
          {/^Mac|iP(hone|ad)/.test(navigator.platform) ? <span className="app-foot-kbd">⌘J</span> : null}
          {running && (
            <span className="ai-dock-running" title={t('ai.runningInBackground')}>
              <span className="ai-pulse" />
              <span className="ai-dock-running-text">{t('ai.running')}</span>
            </span>
          )}
          <span style={{ flex: 1 }} />
          <Tooltip title={t('ai.collapse')}>
            <Button
              type="text"
              size="small"
              onClick={() => setCollapsed(true)}
              aria-label={t('ai.collapse')}
            >
              {isSheet ? <DownOutlined /> : <VerticalLeftOutlined />}
            </Button>
          </Tooltip>
          <Tooltip title={t('common.close')}>
            <Button
              type="text"
              size="small"
              onClick={() => setOpen(false)}
              aria-label={t('common.close')}
            >
              <CloseOutlined />
            </Button>
          </Tooltip>
        </header>
        <div className="ai-dock-body">
          <Suspense
            fallback={
              <div className="ai-panel-loading">
                <Spin size="small" />
                <span>{t('ai.loadingPanel')}</span>
              </div>
            }
          >
            <AIPanel />
          </Suspense>
        </div>
      </aside>
    </>
  )
}

export { AI_DOCK_MAX, AI_DOCK_MIN }
