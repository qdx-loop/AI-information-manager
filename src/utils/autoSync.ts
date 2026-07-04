// 自动同步管理器：修改后3分钟无操作自动同步云端，退出时强制同步
import { useAppStore } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'
import { pushLocalToCloud } from '@/db/providerFactory'

const SYNC_DELAY = 3 * 60 * 1000 // 3分钟
const RETRY_DELAY = 30 * 1000 // 重试间隔30秒
const MAX_RETRIES = 3 // 最多重试3次

let syncTimer: ReturnType<typeof setTimeout> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let isSyncing = false

// 触发防抖同步：每次数据修改时调用，3分钟后无新修改才执行
export function scheduleAutoSync() {
  // 仅云端模式生效
  const { settings } = useAppStore.getState()
  if (settings.storageMode !== 'cloud') return
  if (!settings.cloud.url || !settings.cloud.anonKey) return

  const acc = useAuthStore.getState().account
  if (!acc) return

  // 清除之前的计时（含重试计时），重新开始
  if (syncTimer) clearTimeout(syncTimer)
  if (retryTimer) clearTimeout(retryTimer)

  syncTimer = setTimeout(async () => {
    await doSync()
  }, SYNC_DELAY)
}

// 执行同步（内部），失败后自动重试
async function doSync(retryCount = 0): Promise<void> {
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
    console.error(`[autoSync] 同步失败 (第${retryCount + 1}次):`, e)
    // 自动重试：未达上限则延迟重试
    if (retryCount < MAX_RETRIES - 1) {
      retryTimer = setTimeout(() => {
        void doSync(retryCount + 1)
      }, RETRY_DELAY)
    }
  } finally {
    isSyncing = false
  }
}

// 退出时强制同步（不等3分钟），不重试（退出流程不应被阻塞）
export async function syncNow(): Promise<void> {
  // 取消待执行的防抖计时和重试计时
  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  // 退出时直接同步，失败也不重试（避免阻塞退出流程）
  const { settings } = useAppStore.getState()
  const acc = useAuthStore.getState().account
  if (!acc || settings.storageMode !== 'cloud') return
  try {
    await pushLocalToCloud(acc.id, {
      url: settings.cloud.url,
      anonKey: settings.cloud.anonKey,
    })
    console.log('[autoSync] 退出前同步完成')
  } catch (e) {
    console.error('[autoSync] 退出前同步失败:', e)
  }
}
