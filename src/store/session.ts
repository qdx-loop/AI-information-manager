import { useAuthStore } from './authStore'
import { useAiUiStore } from './aiUiStore'
import { syncNow } from '@/utils/autoSync'

/**
 * 统一的「退出会话」入口，负责退登前后的完整收尾。
 *
 * 之前有三处退出登录（侧边栏、设置页、头部头像菜单），只有侧边栏那一处
 * 做了完整清理，另外两处只清了 token 就跳走 —— 于是 libraryStore 里
 * 上一个账号的库/字段/条目还留在内存里。新账号登录后，在侧边栏
 * loadLibraries() 返回之前，能看到并点进上一个账号的库；
 * 更糟的是此时点「新建」会用新账号的 accountId 写进旧账号的 libraryId，
 * 直接污染别人的库。
 *
 * 库数据的清理放在 authStore.logout() 里（通过 libraryStore 注册的回调，
 * 以避开 authStore ↔ libraryStore 的循环依赖），这里只负责：
 * 1) 退出前强制云同步，避免丢掉防抖窗口内的改动
 * 2) 收起 AI 面板并清掉运行态
 */
export async function resetSession(opts: { syncFirst?: boolean } = {}) {
  if (opts.syncFirst !== false) {
    try {
      await syncNow()
    } catch (e) {
      console.error('[session] 退出前同步失败，继续退登:', e)
    }
  }
  // logout() 内部会触发 libraryStore 注册的清理回调
  useAuthStore.getState().logout()
  useAiUiStore.setState({
    open: false,
    collapsed: false,
    mounted: false,
    running: false,
    unseen: false,
    lastDone: null,
  })
}
