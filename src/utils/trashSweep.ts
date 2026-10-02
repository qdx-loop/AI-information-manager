import { getProvider } from '@/db/providerFactory'
import { useAuthStore } from '@/store/authStore'
import { scheduleAutoSync } from '@/utils/autoSync'

const KEY = 'info-mgmt-trash-swept-at'
const DAY_MS = 24 * 3600 * 1000
import { TRASH_RETENTION_DAYS } from '@/utils/retentionDays'

/**
 * 回收站自动清理：软删除超过 30 天的内容被彻底删除。
 * 每个账号每个浏览器每天最多执行一次，失败静默不影响使用。
 */
export async function sweepTrashOncePerDay(): Promise<void> {
  const acc = useAuthStore.getState().account
  if (!acc) return
  // 标记必须按账号分开。原来是一个全局 key，于是：
  //   账号 A 今天清理过 → 用户当天切到账号 B → B 的回收站今天不会被清理，
  //   之后再切回来又要等一天。说明书里承诺「回收站内容 30 天后自动彻底删除」，
  //   而实际执行时间会随账号切换不断往后推。
  const key = `${KEY}:${acc.id}`
  try {
    const last = Number(localStorage.getItem(key) || 0)
    if (Date.now() - last < DAY_MS) return
    await getProvider().purgeExpiredTrash?.(acc.id, TRASH_RETENTION_DAYS)
    // 清理成功之后才写标记。原来是先写标记再干活，于是清理失败时
    // 这一天就白费了（要等满 24 小时才重试），标签页中途关掉更是直接跳过。
    localStorage.setItem(key, String(Date.now()))
    scheduleAutoSync()
  } catch (e) {
    console.warn('[trashSweep] 清理失败:', e)
  }
}
