import { useAppStore } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'
import { syncBidirectional } from '@/db/syncService'

const SYNC_DELAY = 3 * 60 * 1000 // 3分钟
const RETRY_DELAY = 30 * 1000 // 重试间隔30秒
const MAX_RETRIES = 3
const HOOK_MIN_INTERVAL = 60 * 1000 // 页面钩子触发同步的最小间隔（防切标签页风暴，P9）

class AutoSyncManager {
  private syncTimer: ReturnType<typeof setTimeout> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private isSyncing = false
  private hooksInstalled = false
  private lastHookSyncAt = 0

  private canSync(): boolean {
    const { settings } = useAppStore.getState()
    if (settings.storageMode !== 'cloud') return false
    if (!settings.cloud.url || !settings.cloud.anonKey) return false
    return !!useAuthStore.getState().account
  }

  /** 触发防抖同步：每次数据修改时调用，3分钟后无新修改才执行 */
  schedule(): void {
    if (!this.canSync()) return
    this.clearTimers()
    this.syncTimer = setTimeout(() => { void this.doSync() }, SYNC_DELAY)
  }

  /** 立即双向同步（登出等显式动作调用），不重试 */
  async syncNow(): Promise<void> {
    this.clearTimers()
    if (!this.canSync()) return
    const { settings } = useAppStore.getState()
    const acc = useAuthStore.getState().account!
    try {
      await syncBidirectional(acc.id, {
        url: settings.cloud.url,
        anonKey: settings.cloud.anonKey,
      })
      this.lastHookSyncAt = Date.now()
      console.log('[autoSync] 双向同步完成')
    } catch (e) {
      console.error('[autoSync] 同步失败:', e)
    }
  }

  /**
   * 安装全局钩子：切后台/关页时尽力双向同步。
   * 浏览器不保证关闭瞬间请求一定送达（尽力而为），因此另有 3 分钟防抖兜底。
   * 钩子触发做了 60s 节流——此前每次切标签页都会全量上传，放大配额消耗与覆盖窗口（P9）。
   */
  installGlobalHooks(): void {
    if (this.hooksInstalled || typeof window === 'undefined') return
    this.hooksInstalled = true

    const hookSync = () => {
      const now = Date.now()
      if (now - this.lastHookSyncAt < HOOK_MIN_INTERVAL) return
      void this.syncNow()
    }
    window.addEventListener('beforeunload', hookSync)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') hookSync()
    })
  }

  destroy(): void {
    this.clearTimers()
  }

  private async doSync(retryCount = 0): Promise<void> {
    if (this.isSyncing) return
    if (!this.canSync()) return
    const { settings } = useAppStore.getState()
    const acc = useAuthStore.getState().account!

    this.isSyncing = true
    try {
      // 先合并云端再上传：任何路径都不会用陈旧副本盲覆盖云端的新修改（P1）
      await syncBidirectional(acc.id, {
        url: settings.cloud.url,
        anonKey: settings.cloud.anonKey,
      })
      this.lastHookSyncAt = Date.now()
      console.log('[autoSync] 同步完成')
    } catch (e) {
      console.error(`[autoSync] 同步失败 (第${retryCount + 1}次):`, e)
      if (retryCount < MAX_RETRIES - 1) {
        this.retryTimer = setTimeout(() => { void this.doSync(retryCount + 1) }, RETRY_DELAY)
      }
    } finally {
      this.isSyncing = false
    }
  }

  private clearTimers(): void {
    if (this.syncTimer) { clearTimeout(this.syncTimer); this.syncTimer = null }
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null }
  }
}

export const autoSyncManager = new AutoSyncManager()
export const scheduleAutoSync = () => autoSyncManager.schedule()
export const syncNow = () => autoSyncManager.syncNow()
