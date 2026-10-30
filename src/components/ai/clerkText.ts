/**
 * AI 面板里与「步骤文案」有关的小工具。
 *
 * 旧 i18n 的步骤文案带表情符号前缀，改版后步骤用 01/02/03 等宽编号呈现，
 * 这里在渲染时剥掉 emoji 前缀；i18n 清理完成后本函数即退化为恒等变换。
 * 新增可见文案一律走 `src/i18n`（owner：settings-pages），不在此处另立字典。
 */
export function plainStepLabel(label: string): string {
  return label.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '').trim()
}
