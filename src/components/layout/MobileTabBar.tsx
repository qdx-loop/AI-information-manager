import { useMemo } from 'react'
import { HomeRegular, GridRegular, SparkleRegular, SettingsRegular } from '@fluentui/react-icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAiUiStore } from '@/store/aiUiStore'
import { useI18n } from '@/i18n'

/**
 * v10 移动端底部标签栏（Fluent token 底栏，56px；不是 OS 任务栏）。
 *
 * 保留原有信息架构：首页 / 管理库 / AI / 设置 四个最高频目的地钉在拇指区；
 * 「管理库」打开库切换面板；回收站、帮助、退出仍在抽屉内。
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
        icon: <HomeRegular fontSize={20} />,
        active: location.pathname === '/',
        onClick: () => { onDismiss?.(); navigate('/') },
      },
      {
        key: 'libs',
        label: t('app.group.libraries'),
        icon: <GridRegular fontSize={20} />,
        active: location.pathname.startsWith('/library/'),
        onClick: () => { onDismiss?.(); onOpenLibraries() },
      },
      {
        key: 'ai',
        label: t('app.aiAssistant'),
        icon: <SparkleRegular fontSize={20} />,
        active: aiOpen,
        onClick: () => { onDismiss?.(); setAiOpen(!aiOpen) },
      },
      {
        key: '/settings',
        label: t('app.settings'),
        icon: <SettingsRegular fontSize={20} />,
        active: location.pathname === '/settings',
        onClick: () => { onDismiss?.(); navigate('/settings') },
      },
    ],
    [navigate, location.pathname, t, aiOpen, setAiOpen, onOpenLibraries, onDismiss],
  )

  return (
    <nav className="w-mobile-tabbar" aria-label={t('mobileTabs.label')}>
      {tabs.map((x) => (
        <button
          key={x.key}
          type="button"
          className={`w-mobile-tab${x.active ? ' is-active' : ''}`}
          onClick={x.onClick}
          aria-current={x.active ? 'page' : undefined}
        >
          {x.icon}
          <span>{x.label}</span>
        </button>
      ))}
    </nav>
  )
}
