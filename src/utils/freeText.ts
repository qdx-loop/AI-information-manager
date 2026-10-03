// 「零配置速记」：允许一个管理库在没有任何字段的情况下先记录东西。
//
// 为什么需要：原来的流程是「新建库 → 配置模板字段 → 才能录第一条」。
// 三层概念之后才能存一个东西，而这正是被反复验证为「劝退非技术用户」的
// 记录摩擦（Notion 约 20 分钟、Apple Notes 10–20 分钟 vs 捕获优先产品 2 秒）。
//
// 所以约定：如果一个库还没有任何字段，第一条内容写进保留键 __text，
// 就像 __reminder 一样 —— 模板里不存在该键的 FieldDef，
// 因此不会在表格/编辑器/导出里被当成一列。
//
// 关键性质：以后用户加了字段，__text **不会被丢掉**。
// 它继续跟着这条记录，界面上作为该记录的一个只读补充展示。
// 这样「先记下来，结构以后补」是真的可以，而不是先记的东西后来不见了。
import type { Item, FieldValue } from '@/types'

export const FREE_TEXT_KEY = '__text'

/** 读出速记正文（没有则 null） */
export function getFreeText(item: Pick<Item, 'fields'>): string | null {
  const v = item.fields[FREE_TEXT_KEY]
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

/** 返回写入了速记正文的 fields，不修改原对象；传 null/空则移除该键 */
export function withFreeText(
  fields: Record<string, FieldValue>,
  text: string | null,
): Record<string, FieldValue> {
  const out = { ...fields }
  const t = text?.trim()
  if (t) out[FREE_TEXT_KEY] = t
  else delete out[FREE_TEXT_KEY]
  return out
}

/**
 * 条目的主标识：优先第一个非空的可见字段；一个字段都没有时用速记正文。
 *
 * 与 utils/insights.ts 里的 itemDisplayName 的区别：那个函数遍历 fields 的
 * 所有键（含保留键），所以它本来就能找到 __text；而表格/卡片的主标题是
 * 按模板字段顺序取的，需要显式兜底，否则零字段库里每张卡标题都是「（无内容）」。
 */
export function primaryText(
  item: Pick<Item, 'fields'>,
  visibleKeys: string[],
  render: (key: string, value: FieldValue) => string,
): string | null {
  for (const k of visibleKeys) {
    const v = item.fields[k]
    if (v != null && String(v).trim() !== '') return render(k, v)
  }
  return getFreeText(item)
}