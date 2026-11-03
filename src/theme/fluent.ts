/**
 * Windows 11 / Fluent UI React v9 主题桥接（v10）
 *
 * 实现迁移到 `src/theme/win11.ts`：真正的 Fluent Theme 在那边定义，
 * 本文件只保留兼容导出，避免旧 import 路径断裂。
 */
export {
  win11FluentLight as fluentWindowsLight,
  win11FluentDark as fluentWindowsDark,
  win11FluentLight,
  win11FluentDark,
  fluentThemeOf,
  applyFluentThemeVars,
  SEGOE,
  SEGOE_DISPLAY,
  CONSOLAS,
} from './win11'
