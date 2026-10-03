import { EditOutlined } from '@ant-design/icons'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/i18n'

/**
 * 全局速记的悬浮按钮。
 *
 * 位置在右下角、AI 按钮上方。手机上也保留 —— 这里和 AI 按钮不同：
 * AI 在手机上有底部标签栏承担导航，所以那个 FAB 被去掉了；
 * 而「记一笔」是一个**动作**不是目的地，没有标签栏能替代它，
 * 而且它是这个产品里最高频的操作，不该藏在任何菜单里。
 */
export default function CaptureFab() {
  const open = useAppStore((s) => s.openQuickCapture)
  const t = useI18n()
  return (
    <button type="button" className="capture-fab" onClick={open} aria-label={t('quickCapture.fab')}>
      <EditOutlined />
      <span className="capture-fab-text">{t('quickCapture.fab')}</span>
    </button>
  )
}
