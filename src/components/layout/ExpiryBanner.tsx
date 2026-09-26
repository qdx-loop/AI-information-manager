import { Alert } from 'antd'
import { useAuthStore } from '@/store/authStore'
import { useLibraryStore } from '@/store/libraryStore'
import { getSubStatus, daysUntil, graceDaysLeft } from '@/utils/subscription'
import { useI18n } from '@/i18n'

// 到期分级提醒 + 只读宽限期横幅：
//   active 且 7 天内到期 → 提示续费（3/1 天升级颜色）
//   grace（到期后 7 天宽限）→ 只读提示 + 数据损失厌恶（库数量）
export default function ExpiryBanner() {
  const { account } = useAuthStore()
  const libraries = useLibraryStore((s) => s.libraries)
  const t = useI18n()

  if (!account?.expiresAt) return null
  const status = getSubStatus(account.expiresAt)

  if (status === 'grace') {
    return (
      <Alert
        banner
        type="error"
        showIcon
        message={t('sub.banner.grace.title')}
        description={t('sub.banner.grace.body', {
          n: graceDaysLeft(account.expiresAt),
          libs: libraries.length,
        })}
      />
    )
  }

  if (status === 'active') {
    const days = daysUntil(account.expiresAt)
    if (days > 7) return null
    const type = days <= 1 ? 'error' : days <= 3 ? 'warning' : 'info'
    return (
      <Alert
        banner
        type={type}
        showIcon
        message={t('sub.banner.soon', { n: Math.max(0, days) })}
      />
    )
  }

  return null
}
