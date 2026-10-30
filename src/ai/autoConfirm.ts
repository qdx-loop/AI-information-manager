import { createContext, useContext } from 'react'

/**
 * AI 写操作的「本会话内不再询问」规则。
 *
 * 历史实现只有 `item` / `lib` / `tpl` 三个粗粒度开关：用户为「新增一条」
 * 勾一次「不再询问」，后续的 **删除条目 / 删除管理库 / 删除字段** 也会被
 * 一并放行（见 `inforation-manage-analysis/03-ai.md` 风险 P0-1）。这里改成
 * 按「动作」分键，并且破坏性动作永不进入自动放行集合。
 *
 * 规则只由用户通过确认弹窗勾选写入，模型无法通过工具打开它——
 * 这是防提示注入静默篡改数据的第一道闸门。
 */
export type AutoConfirmKind = 'item' | 'lib' | 'tpl'

export type AutoConfirmKey =
  | 'item:create'
  | 'item:update'
  | 'item:delete'
  | 'lib:create'
  | 'lib:rename'
  | 'lib:delete'
  | 'lib:setCategory'
  | 'tpl:addField'
  | 'tpl:updateField'
  | 'tpl:deleteField'

/** 已知动作 → 允许的自动放行键；未登记的动作一律视为「必须确认」 */
const KNOWN_KEYS: ReadonlySet<string> = new Set<AutoConfirmKey>([
  'item:create',
  'item:update',
  'item:delete',
  'lib:create',
  'lib:rename',
  'lib:delete',
  'lib:setCategory',
  'tpl:addField',
  'tpl:updateField',
  'tpl:deleteField',
])

/**
 * 破坏性动作：即使被写进放行集合也不生效（双保险）。
 * 删除条目 / 删除管理库都会进回收站、删除字段会改模板，三者都会让用户
 * 「以为数据还在原位，其实已经不在」，必须逐次确认。
 */
const DESTRUCTIVE_KEYS: ReadonlySet<string> = new Set<string>([
  'item:delete',
  'lib:delete',
  'tpl:deleteField',
])

/** 由 kind + 动作名拼出放行键；未登记返回 null（= 必须确认） */
export function autoConfirmKey(kind: AutoConfirmKind, action: string): AutoConfirmKey | null {
  const key = `${kind}:${action}`
  return KNOWN_KEYS.has(key) ? (key as AutoConfirmKey) : null
}

/** 该动作是否属于「永不自动放行」的破坏性操作 */
export function isDestructiveAction(kind: AutoConfirmKind, action: string): boolean {
  return DESTRUCTIVE_KEYS.has(`${kind}:${action}`)
}

/**
 * 判断某个动作是否可以跳过确认：
 * - 破坏性动作：永远 false
 * - 未登记动作：永远 false
 * - 其它：仅当用户在本会话内对「同一个动作」勾过「不再询问」
 */
export function canAutoConfirm(
  alwaysAllowFor: ReadonlySet<string>,
  kind: AutoConfirmKind,
  action: string,
): boolean {
  if (isDestructiveAction(kind, action)) return false
  const key = autoConfirmKey(kind, action)
  return key ? alwaysAllowFor.has(key) : false
}

interface AutoConfirmState {
  /** 本会话内已被用户允许「不再询问」的动作键（只增不减，随面板卸载重置） */
  alwaysAllowFor: ReadonlySet<string>
  setAlwaysAllowFor: (key: AutoConfirmKey) => void
}

export const AutoConfirmContext = createContext<AutoConfirmState>({
  alwaysAllowFor: new Set<string>(),
  setAlwaysAllowFor: () => {},
})

export function useAutoConfirm() {
  return useContext(AutoConfirmContext)
}
