// 把底层 Supabase/Postgres/网络错误翻译成买家能看懂、知道下一步做什么的中文提示。
// 原始报错保留在括号内，便于卖家截图排查。
const RULES: Array<[RegExp, string]> = [
  [/JWT expired|invalid JWT|token has expired|apikey/i, '云端连接凭证无效或已过期，请核对「存储」页填写的 anon key'],
  [/Failed to fetch|NetworkError|network|load failed/i, '网络连接失败，请检查网络后重试'],
  [/relation .* does not exist|schema cache/i, '云端数据库尚未建表：请在 Supabase SQL Editor 执行「设置 → 存储」页提供的建表 SQL'],
  [/duplicate key|unique constraint/i, '存在重复记录，请刷新后重试；若反复出现请联系管理员'],
  [/row-level security|permission denied/i, '云端权限校验失败：请确认已按说明执行建表 SQL（含禁用 RLS 语句）'],
  [/timeout|aborted|fetch failed/i, '请求超时，请稍后重试'],
]

export function friendlyDbError(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : String(raw ?? '')
  for (const [re, tip] of RULES) {
    if (re.test(msg)) return `${tip}（原始信息：${msg.slice(0, 80)}）`
  }
  return msg
}
