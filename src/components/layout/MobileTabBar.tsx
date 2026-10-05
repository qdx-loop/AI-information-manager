import { useMemo } from 'react'
import { HomeOutlined, AppstoreOutlined, RobotOutlined, SettingOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAiUiStore } from '@/store/aiUiStore'
import { useI18n } from '@/i18n'

/**
 * 移动端底部标签栏。
 *
 * 原来是「汉堡菜单把所有东西收进去」。调研的结论很硬：
 * - NN/g 实测任务成功率：可见导航 86%，汉堡菜单只有 57%
 * - Android 官方设计指南明确说：抽屉模式在紧凑屏幕上不理想，
 *   因为「用户必须伸手去够顶栏」
 * - 触摸目标要落在拇指自然覆盖的屏幕下半部分
 *
 * 而且原来的问题更具体：手机上首页、库、回收站、设置、AI 五个目的地
 * 全在左上角，单手握持要伸到顶部边缘，甚至要把手机横过来。
 *
 * 所以：把 4 个最高频目的地钉在底部（拇指区），汉堡降级为
 * 「完整库树 + 回收站 + 帮助 + 退出」的次级入口 —— 这正是
 * NN/g 说的「可见 + More」的组合：主目的地一个都不许藏。
 *
 * 为什么是这 4 个：按使用频次而非重要性排。
 * 回收站属于「偶尔才用」，按 Android 指南应进 overflow，所以留在抽屉里。
 */
export default function MobileTabBar({
  onOpenLibraries,
  onDismiss,
}: {
  onOpenLibraries: () => void
  /** 任意标签被点时收起库切换面板（面板不再自带遮罩，底栏始终可点） */
  onDismiss?: () => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const t = useI18n()
  const setAiOpen = useAiUiStore((s) => s.setOpen)
  const aiOpen = useAiUiStore((s) => s.open)

  const tabs = useMemo(
    () => [
      {
        key: '/',
        label: t('app.home'),
        icon: <HomeOutlined />,
        active: location.pathname === '/',
        onClick: () => { onDismiss?.(); navigate('/') },
      },
      {
        key: 'libs',
        label: t('app.group.libraries'),
        icon: <AppstoreOutlined />,
        // 任何库页面（含子库）都算「库」选中
        active: location.pathname.startsWith('/library/'),
        // 以前这里是 `if (!pathname.startsWith('/library/')) navigate('/')`：
        // 在首页时正好导航到当前页 → 死按钮；而且在库里时又是 no-op，
        // 于是这个标签**永远无法切库** —— 而切库是它在手机上唯一的职责
        // （完整库树收在汉堡抽屉里）。改为打开库切换面板。
        onClick: () => { onDismiss?.(); onOpenLibraries() },
      },
      {
        key: 'ai',
        label: t('app.aiAssistant'),
        icon: <RobotOutlined />,
        active: aiOpen,
        onClick: () => { onDismiss?.(); setAiOpen(!aiOpen) },
      },
      {
        key: '/settings',
        label: t('app.settings'),
        icon: <SettingOutlined />,
        active: location.pathname === '/settings',
        onClick: () => { onDismiss?.(); navigate('/settings') },
      },
    ],
    [navigate, location.pathname, t, aiOpen, setAiOpen, onOpenLibraries, onDismiss],
  )

  return (
    <nav className="mobile-tabs" aria-label={t('mobileTabs.label')}>
      {tabs.map((x) => (
        <button
          key={x.key}
          type="button"
          className={`mobile-tab${x.active ? ' is-active' : ''}`}
          onClick={x.onClick}
          aria-current={x.active ? 'page' : undefined}
        >
          <span className="mobile-tab-icon">{x.icon}</span>
          <span className="mobile-tab-label">{x.label}</span>
        </button>
      ))}
    </nav>
  )
}
