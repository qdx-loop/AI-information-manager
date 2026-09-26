// 新手引导（Getting Started / Tour）持久化工具。
// 用 localStorage 按账号记录各激活步骤完成状态与引导是否已看过，纯函数便于测试。
const PREFIX = 'info-mgmt-ob'

export type ObStepKey = 'item' | 'ai' | 'reminder'

export function obKey(accountId: string, step: string): string {
  return `${PREFIX}-${step}-${accountId}`
}

export function markObStep(accountId: string, step: string): void {
  try {
    localStorage.setItem(obKey(accountId, step), '1')
  } catch {
    /* 隐私模式等场景忽略 */
  }
  // 通知页面上的新手清单实时刷新打勾状态
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new Event('ob-updated'))
    } catch {
      /* 忽略 */
    }
  }
}

export function isObStepDone(accountId: string, step: string): boolean {
  try {
    return localStorage.getItem(obKey(accountId, step)) === '1'
  } catch {
    return false
  }
}

export function isObDismissed(accountId: string): boolean {
  try {
    return localStorage.getItem(`${PREFIX}-dismissed-${accountId}`) === '1'
  } catch {
    return false
  }
}

export function dismissOb(accountId: string): void {
  try {
    localStorage.setItem(`${PREFIX}-dismissed-${accountId}`, '1')
  } catch {
    /* 忽略 */
  }
}

export function isTourDone(accountId: string): boolean {
  try {
    return localStorage.getItem(`${PREFIX}-tour-${accountId}`) === '1'
  } catch {
    return false
  }
}

export function markTourDone(accountId: string): void {
  try {
    localStorage.setItem(`${PREFIX}-tour-${accountId}`, '1')
  } catch {
    /* 忽略 */
  }
}
