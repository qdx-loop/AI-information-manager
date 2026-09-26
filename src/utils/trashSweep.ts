import { getProvider } from '@/db/providerFactory'
import { useAuthStore } from '@/store/authStore'
import { scheduleAutoSync } from '@/utils/autoSync'
import { getSubStatus } from '@/utils/subscription'

const KEY = 'info-mgmt-trash-swept-at'
const DAY_MS = 24 * 3600 * 1000
const TRASH_RETENTION_DAYS = 30

/**
 * 回收站自动清理：软删除超过 30 天的内容被彻底删除。
 * 每个浏览器每天最多执行一次（登录后进入主界面时触发），失败静默不影响使用。
 */
export async function sweepTrashOncePerDay(): Promise<void> {
  try {
    const last = Number(localStorage.getItem(KEY) || 0)
    if (Date.now() - last < DAY_MS) return
    localStorage.setItem(KEY, String(Date.now()))
    const acc = useAuthStore.getState().account
    if (!acc) return
    // 只读宽限期内跳过自动清理：用户正在保全数据，不做任何删除动作
    if (acc.expiresAt != null && getSubStatus(acc.expiresAt) === 'grace') return
    await getProvider().purgeExpiredTrash?.(acc.id, TRASH_RETENTION_DAYS)
    scheduleAutoSync()
  } catch (e) {
    console.warn('[trashSweep] 清理失败:', e)
  }
}
