// 首次注册「欢迎 + 赞赏码」的一次性状态（纯本地，无网络、无埋点）。
//
// 设计依据：`redesign-brief/05-first-run-support.md` §D.1 / §D.2 / TOKENS-v3 §6。
// 核心设计：把「一次性」交给**一次性口令 pending**（sessionStorage），而不是交给「看过标记」：
//   - 只有注册成功路径会写 pending → 老账号登录天然没有；
//   - pending 只在 sessionStorage，随标签页销毁 → 注册后立刻关掉标签页就永远不会事后补弹；
//   - 首次显示时立即读后即删（读+删同一个同步任务内完成）→ StrictMode 双挂载也只会消费一次；
//   - 另一层 localStorage 的 seen（按 accountId）是兜底：即使 pending 因奇怪原因残留，也不会二次弹。
//
// 所有读写都包 try/catch（隐私模式 / 存储被禁用时会抛错，范式同 `utils/onboarding.ts`）。
// 本模块只存「弹没弹过」两个布尔标记，不含任何支付信息。

const PENDING_KEY = 'info-mgmt-welcome-pending'
const SEEN_PREFIX = 'info-mgmt-ob-welcome'

/** 注册成功后调用（必须在 navigate('/') 之前）：写一次性口令。 */
export function markWelcomePending(): void {
  try {
    sessionStorage.setItem(PENDING_KEY, '1')
  } catch {
    // 隐私模式：口令写不进去 → 本次不弹（宁可不显示，也不要事后补弹）
  }
}

/**
 * 读并删除一次性口令。返回 true 表示「本次该显示欢迎卡」。
 * 幂等：同一个口令只可能返回一次 true（第二个调用者拿到 false）。
 * 读与删之间没有 await，天然是同一个同步任务，StrictMode 双挂载不会闪两次。
 */
export function consumeWelcomePending(): boolean {
  try {
    const has = sessionStorage.getItem(PENDING_KEY) !== null
    if (has) sessionStorage.removeItem(PENDING_KEY)
    return has
  } catch {
    return false
  }
}

/** seen 的 localStorage 键：`info-mgmt-ob-welcome-${accountId}`（按账号隔离，R10 保留）。 */
export function welcomeSeenKey(accountId: string): string {
  return `${SEEN_PREFIX}-${accountId}`
}

/** 该账号是否已经看过欢迎卡（兜底：防止 pending 残留导致二次显示）。 */
export function isWelcomeSeen(accountId: string): boolean {
  if (!accountId) return false
  try {
    return localStorage.getItem(welcomeSeenKey(accountId)) === '1'
  } catch {
    return false
  }
}

/** 欢迎卡关闭时调用：主按钮 / × / Esc / 点遮罩 / 安卓返回 五条路径都要走到这里。 */
export function markWelcomeSeen(accountId: string): void {
  if (!accountId) return
  try {
    localStorage.setItem(welcomeSeenKey(accountId), '1')
  } catch {
    // 写不进去只会导致「下次可能再弹一次」，不影响任何功能
  }
}

/** 测试用：清掉一次性口令与所有账号的 seen 记录。生产代码不要调用。 */
export function resetWelcomeForTests(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    /* 忽略 */
  }
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(`${SEEN_PREFIX}-`)) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* 忽略 */
  }
}
