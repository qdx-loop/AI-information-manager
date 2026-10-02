import type { FieldValue } from '@/types'

/**
 * 字段值是否算「空」。
 *
 * 之前各处判断空值各写各的：有的只判 null/undefined，
 * 有的用 `!v`（于是数字 0 和布尔 false 都被当成空），
 * 有的只判 `=== ''`（于是 null 又漏了）。
 * 结果是必填校验在弹窗里生效、在表格内联里失效。
 */
export function isBlankFieldValue(v: FieldValue | undefined): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (typeof v === 'number') return Number.isNaN(v)
  return false // false 是有效值，不算空
}
