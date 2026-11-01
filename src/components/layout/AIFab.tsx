import { useAiUiStore } from '@/store/aiUiStore'
import { useI18n } from '@/i18n'

/**
 * 全局 AI 入口。以前只有侧边栏一个「AI 助手」按钮，于是
 * - 回收站、设置、空管理库、条目编辑里全都够不着
 * - 手机上侧边栏在抽屉里，等于没有入口
 *
 * 现在做成常驻悬浮按钮：每个界面都在，⌘/Ctrl+J 也能唤起。
 * 有任务在后台跑时呼吸，红点表示「做完了，你还没看」。
 */
export default function AIFab({ compact }: { compact?: boolean }) {
  const t = useI18n()
  const open = useAiUiStore((s) => s.open)
  const collapsed = useAiUiStore((s) => s.collapsed)
  const running = useAiUiStore((s) => s.running)
  const unseen = useAiUiStore((s) => s.unseen)
  const toggle = useAiUiStore((s) => s.toggle)

  // 面板展开时不占位置（面板本身就是入口），收起或关闭时才出现。
  // 未读红点由 store 在 endRun 时判定（当时用户没在看才点亮），这里不自行清除。
  const visible = !open || collapsed

  if (!visible) return null

  return (
    <button
      type="button"
      className={`ai-fab${compact ? ' ai-fab-compact' : ''}${running ? ' is-running' : ''}`}
      onClick={toggle}
      aria-label={t('ai.open')}
      title={running ? t('ai.runningInBackground') : t('ai.open')}
    >
      {running ? <span className="ai-pulse" /> : <span>AI</span>}
      {!compact && <span className="ai-fab-text">{t('app.aiAssistant')}</span>}
      {unseen && !running && <span className="ai-fab-dot" aria-hidden />}
    </button>
  )
}
