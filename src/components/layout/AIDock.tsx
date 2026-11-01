import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Spin, Tooltip } from 'antd'
import {
  DismissRegular,
  PanelRightContractRegular,
  ChevronDownRegular,
  SparkleRegular,
} from '@fluentui/react-icons'
import { useAiUiStore, AI_DOCK_MIN, AI_DOCK_MAX } from '@/store/aiUiStore'
import { useI18n } from '@/i18n'
import { useBackButtonLayer } from '@/utils/backButton'

// AI 面板依赖 xlsx / papaparse / react-markdown 等重包，只有真正打开过才下载
const AIPanel = lazy(() => import('@/components/ai/AIPanel'))

const SHEET_RATIO = 0.68 // 手机底部抽屉默认高度（占视口比例）

/**
 * AI 助手的承载外壳 v9（Windows 11 Copilot 式侧栏）。
 *
 * 关键约束保持不变：**只渲染一份 DOM** —— 桌面右侧停靠列与手机底部抽屉
 * 共用同一节点，只靠 class 切换外观；跨断点缩放不会中断正在执行的任务。
 * 唯一改动是外观：Acrylic 侧栏 / Win11 头部 / 输入区（输入区由 AIPanel 渲染）。
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

  // 面板真正可见时清掉未读红点
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
        setWidth(dragRef.current.startW + (dragRef.current.startX - ev.clientX))
      }
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
    if (dy > 60) setCollapsed(true)
    else setSheetFull((v) => !v)
  }

  // 安卓返回键：只在手机抽屉形态注册
  useBackButtonLayer(variant === 'sheet' && open && !collapsed, () => setOpen(false))

  // Esc 关闭（仅桌面侧栏，且没有其它模态层时）
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

  // ── 画中画（收起态）：桌面窄条 / 手机药丸 ──
  if (collapsed) {
    return isSheet ? (
      <button type="button" className="ai-sheet-peek" onClick={() => setCollapsed(false)}>
        <SparkleRegular fontSize={16} />
        <span>{t('app.aiAssistant')}</span>
        {running ? <span className="ai-pulse" /> : <span className="ai-peek-open">{t('ai.open')}</span>}
      </button>
    ) : (
      <aside className="ai-dock-collapsed" aria-label={t('app.aiAssistant')}>
        <button
          type="button"
          className="w-iconbtn"
          onClick={() => setCollapsed(false)}
          aria-label={t('ai.open')}
          title={t('ai.open')}
        >
          <SparkleRegular fontSize={18} />
        </button>
        {running && <span className="ai-pulse" title={t('ai.runningInBackground')} />}
        {!running && unseen && <span className="ai-fab-dot" aria-hidden />}
        <button
          type="button"
          className="w-iconbtn"
          onClick={() => setOpen(false)}
          aria-label={t('common.close')}
          title={t('common.close')}
        >
          <DismissRegular fontSize={16} />
        </button>
      </aside>
    )
  }

  // ── 展开态：单一 DOM，靠 class 切形态 ──
  const cls = ['ai-host', isSheet ? 'ai-host-sheet' : 'ai-host-dock', hidden ? 'is-hidden' : '']
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
          <span className="ai-dock-mark" aria-hidden>
            <SparkleRegular fontSize={16} />
          </span>
          <span className="ai-dock-title">{t('app.aiAssistant')}</span>
          <span className={`ai-dock-status${running ? '' : ' is-idle'}`} aria-hidden />
          <span className="ai-dock-head-spacer" />
          <Tooltip title={t('ai.collapse')}>
            <button
              type="button"
              className="w-iconbtn w-iconbtn--sm"
              onClick={() => setCollapsed(true)}
              aria-label={t('ai.collapse')}
            >
              {isSheet ? <ChevronDownRegular fontSize={16} /> : <PanelRightContractRegular fontSize={16} />}
            </button>
          </Tooltip>
          <Tooltip title={t('common.close')}>
            <button
              type="button"
              className="w-iconbtn w-iconbtn--sm"
              onClick={() => setOpen(false)}
              aria-label={t('common.close')}
            >
              <DismissRegular fontSize={16} />
            </button>
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
