// 自动同步管理器：修改后3分钟无操作自动同步云端，退出时强制同步
import { useAppStore } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'
import { pushLocalToCloud } from '@/db/providerFactory'

const SYNC_DELAY = 3 * 60 * 1000 // 3分钟
let syncTimer: ReturnType<typeof setTimeout> | null = null
let isSyncing = false

// 触发防抖同步：每次数据修改时调用，3分钟后无新修改才执行
export function scheduleAutoSync() {
  // 仅云端模式生效
  const { settings } = useAppStore.getState()
  if (settings.storageMode !== 'cloud') return
  if (!settings.cloud.url || !settings.cloud.anonKey) return

  const acc = useAuthStore.getState().account
  if (!acc) return

  // 清除之前的计时，重新开始
  if (syncTimer) clearTimeout(syncTimer)

  syncTimer = setTimeout(async () => {
    await doSync()
  }, SYNC_DELAY)
}

// 执行同步（内部）
async function doSync() {
  if (isSyncing) return
  const { settings } = useAppStore.getState()
  const acc = useAuthStore.getState().account
  if (!acc || settings.storageMode !== 'cloud') return

  isSyncing = true
  try {
    await pushLocalToCloud(acc.id, {
      url: settings.cloud.url,
      anonKey: settings.cloud.anonKey,
    })
    console.log('[autoSync] 同步完成')
  } catch (e) {
    console.error('[autoSync] 同步失败:', e)
  } finally {
    isSyncing = false
  }
}

// 退出时强制同步（不等3分钟）
export async function syncNow(): Promise<void> {
  // 取消待执行的防抖计时
  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
  await doSync()
}
