/**
 * 设计系统 · 主题层 v3『石墨信号 Graphite Signal』
 *
 * 方向（用户选定）：现代产品感 —— Linear / Notion / Figma / Arc 那一类成熟商业产品。
 * 核心结构：白卡浮在浅灰画布上 + 1px 精致描边 + 三级阴影 + 一个鲜亮强调色（电靛蓝）
 * + 墨黑主按钮 + 全站无衬线 + 500 字重基线 + 8–12px 圆角 + 三档动效。
 *
 * v1（青瓷 SaaS）与 v2（官纸账簿：暖纸/墨/朱砂/衬线）均已弃用，原因见
 * redesign-brief/03-ui-research-v2.md：v2 的画布与表面明度只差 0.02，导致「表面消失」、
 * 整屏一张米色纸；零强调色让眼睛找不到落点；中文衬线在 UI 里显旧。v3 用用户已被
 * 训练过的「高级产品」视觉共识重建层级，而不是再换一个配色隐喻。
 *
 * 命名与结构沿用三层 token：primitive → semantic → component，业务只消费 CSS 变量
 * （由 main.tsx 注入 <html>）与 antd 主题，不直接引用本文件的常量。
 */

import { theme, type ThemeConfig } from 'antd'

export type ThemeMode = 'light' | 'dark'

// ══════════════════════════════════════════════════════════════
// 第 1 层 · Primitive
// ══════════════════════════════════════════════════════════════

const LIGHT = {
  canvas: '#FAFAF9',
  surface: '#FFFFFF',
  sunken: '#F2F3F5',
  raised: '#FFFFFF',
  overlay: 'rgba(16, 18, 22, 0.40)',
  ink: '#18191C',
  inkMuted: '#5B616E',
  inkFaint: '#6B7280',
  border: '#E4E6EA',
  borderStrong: '#C9CED8',
  borderRule: '#EDEFF2',
  accent: '#3D5AFE',
  accentHover: '#2F49D6',
  accentWash: '#EEF1FF',
  accentRing: 'rgba(61, 90, 254, 0.28)',
  action: '#1B1D22',
  actionHover: '#2C2F36',
  danger: '#C0303E',
  dangerWash: '#FDECEE',
  success: '#1E7F4F',
  successWash: '#E9F6EF',
  warning: '#9A5B00',
  warningWash: '#FBF1E2',
} as const

const DARK = {
  canvas: '#0B0C0E',
  surface: '#141619',
  sunken: '#1A1D22',
  raised: '#21242A',
  overlay: 'rgba(0, 0, 0, 0.62)',
  ink: '#EDEEF1',
  inkMuted: '#A9AFBA',
  inkFaint: '#7B828E',
  border: '#2A2E35',
  borderStrong: '#3A3F48',
  borderRule: '#23262C',
  accent: '#7C8CFF',
  accentHover: '#9AA6FF',
  accentWash: '#1B2140',
  accentRing: 'rgba(124, 140, 255, 0.30)',
  /** 暗色主按钮反相为亮底深字 */
  action: '#EDEEF1',
  actionHover: '#FFFFFF',
  danger: '#F27A85',
  dangerWash: '#3A2124',
  success: '#5FBF8F',
  successWash: '#13291F',
  warning: '#E0A03A',
  warningWash: '#2E2413',
} as const

/**
 * 图表分类色：沿用上一轮已验证的 Okabe-Ito/Wong 色盲安全 5 色子集
 * （Wong 2011, Nat Methods；Machado 2009 矩阵实测正常/绿色盲/红色盲无危险色对）。
 * 数据产品里这部分不要为了配合 UI 配色而改。
 */
const SERIES_L = ['#0072B2', '#009E73', '#D55E00', '#CC79A7', '#404040'] as const
const SERIES_D = ['#4C9BD6', '#4FBF8F', '#E07340', '#D98BC4', '#B4BCC6'] as const

// ══════════════════════════════════════════════════════════════
// 第 2 层 · Semantic
// ══════════════════════════════════════════════════════════════

const SEMANTIC_L = {
  canvas: LIGHT.canvas,
  surface: LIGHT.surface,
  sunken: LIGHT.sunken,
  raised: LIGHT.raised,
  overlay: LIGHT.overlay,

  ink: LIGHT.ink,
  inkMuted: LIGHT.inkMuted,
  inkFaint: LIGHT.inkFaint,

  border: LIGHT.border,
  borderStrong: LIGHT.borderStrong,
  borderRule: LIGHT.borderRule,

  accent: LIGHT.accent,
  accentHover: LIGHT.accentHover,
  accentWash: LIGHT.accentWash,
  accentRing: LIGHT.accentRing,
  action: LIGHT.action,
  actionHover: LIGHT.actionHover,
  focus: LIGHT.accent,

  danger: LIGHT.danger,
  dangerWash: LIGHT.dangerWash,
  success: LIGHT.success,
  successWash: LIGHT.successWash,
  warning: LIGHT.warning,
  warningWash: LIGHT.warningWash,

  series: SERIES_L,
} as const

const SEMANTIC_D = {
  canvas: DARK.canvas,
  surface: DARK.surface,
  sunken: DARK.sunken,
  raised: DARK.raised,
  overlay: DARK.overlay,

  ink: DARK.ink,
  inkMuted: DARK.inkMuted,
  inkFaint: DARK.inkFaint,

  border: DARK.border,
  borderStrong: DARK.borderStrong,
  borderRule: DARK.borderRule,

  accent: DARK.accent,
  accentHover: DARK.accentHover,
  accentWash: DARK.accentWash,
  accentRing: DARK.accentRing,
  action: DARK.action,
  actionHover: DARK.actionHover,
  focus: DARK.accent,

  danger: DARK.danger,
  dangerWash: DARK.dangerWash,
  success: DARK.success,
  successWash: DARK.successWash,
  warning: DARK.warning,
  warningWash: DARK.warningWash,

  series: SERIES_D,
} as const

export type Semantic = typeof SEMANTIC_L

// ══════════════════════════════════════════════════════════════
// 第 3 层 · 字体与 antd token
// ══════════════════════════════════════════════════════════════

/**
 * Inter 自托管（public/fonts/inter-var.woff2，OFL，latin 子集，约 48KB）。
 * 中文不引入网络字体，走系统黑体链。禁止 Google Fonts/CDN（目标市场被墙）。
 */
const FONT_STACK =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif"

/** 等宽：数字/日期/ID/快捷键。中文正文绝不进等宽。 */
export const MONO_STACK =
  "ui-monospace, 'SF Mono', 'Cascadia Mono', 'Roboto Mono', 'Noto Sans Mono CJK SC', Menlo, Consolas, monospace"

/** 兼容导出：v3 已全站去衬线，serif 栈直接回退到无衬线（旧代码引用不会消失）。 */
export const SERIF_STACK = FONT_STACK

const BASE = {
  borderRadius: 8,
  borderRadiusLG: 12,
  borderRadiusSM: 4,
  borderRadiusXS: 4,
  fontFamily: FONT_STACK,
  fontFamilyCode: MONO_STACK,
  fontSize: 14,
  fontSizeSM: 13,
  fontSizeLG: 16,
  fontSizeHeading1: 32,
  fontSizeHeading2: 24,
  fontSizeHeading3: 20,
  fontSizeHeading4: 16,
  fontSizeHeading5: 14,
  lineHeight: 1.55,
  lineHeightHeading1: 1.2,
  lineHeightHeading2: 1.3,
  lineHeightHeading3: 1.35,
  wireframe: false,
  controlHeight: 36,
  controlHeightSM: 32,
  controlHeightLG: 40,
  motionDurationFast: '0.08s',
  motionDurationMid: '0.14s',
  motionDurationSlow: '0.2s',
  motionEaseInOut: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
  boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)',
  boxShadowSecondary: '0 1px 2px rgba(16, 24, 40, 0.04), 0 4px 12px rgba(16, 24, 40, 0.08)',
  boxShadowTertiary: '0 12px 32px rgba(16, 24, 40, 0.14), 0 2px 6px rgba(16, 24, 40, 0.06)',
} as const

const TOKEN_LIGHT: ThemeConfig['token'] = {
  ...BASE,
  colorPrimary: SEMANTIC_L.accent,
  colorInfo: SEMANTIC_L.accent,
  colorLink: SEMANTIC_L.accent,
  colorLinkHover: SEMANTIC_L.accentHover,
  colorLinkActive: SEMANTIC_L.accentHover,
  colorSuccess: SEMANTIC_L.success,
  colorWarning: SEMANTIC_L.warning,
  colorError: SEMANTIC_L.danger,
  colorBgLayout: SEMANTIC_L.canvas,
  colorBgContainer: SEMANTIC_L.surface,
  colorBgElevated: SEMANTIC_L.raised,
  colorBgSpotlight: SEMANTIC_L.action,
  colorText: SEMANTIC_L.ink,
  colorTextSecondary: SEMANTIC_L.inkMuted,
  colorTextTertiary: SEMANTIC_L.inkFaint,
  colorTextDescription: SEMANTIC_L.inkMuted,
  colorTextPlaceholder: SEMANTIC_L.inkFaint,
  colorTextLightSolid: '#FFFFFF',
  colorBorder: SEMANTIC_L.border,
  colorBorderSecondary: SEMANTIC_L.borderRule,
  colorSplit: SEMANTIC_L.borderRule,
  colorFillQuaternary: 'rgba(16, 18, 22, 0.03)',
  colorFillTertiary: 'rgba(16, 18, 22, 0.05)',
  colorFillSecondary: 'rgba(16, 18, 22, 0.07)',
}

const TOKEN_DARK: ThemeConfig['token'] = {
  ...BASE,
  colorPrimary: SEMANTIC_D.accent,
  colorInfo: SEMANTIC_D.accent,
  colorLink: SEMANTIC_D.accent,
  colorLinkHover: SEMANTIC_D.accentHover,
  colorLinkActive: SEMANTIC_D.accentHover,
  colorSuccess: SEMANTIC_D.success,
  colorWarning: SEMANTIC_D.warning,
  colorError: SEMANTIC_D.danger,
  colorBgLayout: SEMANTIC_D.canvas,
  colorBgContainer: SEMANTIC_D.surface,
  colorBgElevated: SEMANTIC_D.raised,
  colorBgSpotlight: '#2C2F36',
  colorText: SEMANTIC_D.ink,
  colorTextSecondary: SEMANTIC_D.inkMuted,
  colorTextTertiary: SEMANTIC_D.inkFaint,
  colorTextDescription: SEMANTIC_D.inkMuted,
  colorTextPlaceholder: SEMANTIC_D.inkFaint,
  colorTextLightSolid: '#0B0C0E',
  colorBorder: SEMANTIC_D.border,
  colorBorderSecondary: SEMANTIC_D.borderRule,
  colorSplit: SEMANTIC_D.borderRule,
  colorFillQuaternary: 'rgba(255, 255, 255, 0.03)',
  colorFillTertiary: 'rgba(255, 255, 255, 0.05)',
  colorFillSecondary: 'rgba(255, 255, 255, 0.07)',
}

const COMPONENTS_COMMON: NonNullable<ThemeConfig['components']> = {
  Layout: {
    headerHeight: 52,
    headerPadding: '0 16px',
    bodyBg: 'transparent',
    triggerBg: 'transparent',
  },
  Card: {
    boxShadow: 'none',
    headerBg: 'transparent',
    headerFontSize: 16,
    bodyPadding: 20,
    borderRadiusLG: 10,
  },
  Table: {
    headerBg: SEMANTIC_L.sunken,
    headerColor: SEMANTIC_L.inkFaint,
    headerSplitColor: 'transparent',
    headerBorderRadius: 0,
    rowHoverBg: '#F6F7F9',
    cellPaddingBlock: 8,
    cellPaddingInline: 12,
    borderColor: SEMANTIC_L.borderRule,
    footerBg: 'transparent',
    stickyScrollBarBg: SEMANTIC_L.borderStrong,
  },
  Menu: {
    itemHeight: 36,
    itemMarginInline: 0,
    itemMarginBlock: 2,
    itemBorderRadius: 8,
    itemSelectedBg: SEMANTIC_L.accentWash,
    itemSelectedColor: SEMANTIC_L.ink,
    itemHoverBg: SEMANTIC_L.sunken,
    itemHoverColor: SEMANTIC_L.ink,
    itemColor: SEMANTIC_L.inkMuted,
    iconSize: 16,
    activeBarWidth: 3,
    activeBarBorderWidth: 0,
    subMenuItemBg: 'transparent',
  },
  Button: {
    fontWeight: 500,
    primaryShadow: '0 1px 2px rgba(16, 24, 40, 0.12)',
    defaultShadow: 'none',
    dangerShadow: '0 1px 2px rgba(192, 48, 62, 0.16)',
    defaultBg: SEMANTIC_L.surface,
    defaultColor: SEMANTIC_L.ink,
    defaultBorderColor: SEMANTIC_L.borderStrong,
    defaultHoverBg: SEMANTIC_L.sunken,
    defaultHoverBorderColor: SEMANTIC_L.inkFaint,
    defaultHoverColor: SEMANTIC_L.ink,
    textHoverBg: SEMANTIC_L.sunken,
    paddingInline: 16,
    paddingInlineSM: 12,
  },
  Input: {
    paddingBlock: 6,
    paddingInline: 12,
    borderRadius: 8,
    activeBg: SEMANTIC_L.surface,
    hoverBg: SEMANTIC_L.surface,
    activeBorderColor: SEMANTIC_L.accent,
    hoverBorderColor: SEMANTIC_L.borderStrong,
    activeShadow: '0 0 0 3px rgba(61, 90, 254, 0.18)',
  },
  InputNumber: {
    borderRadius: 8,
    activeBorderColor: SEMANTIC_L.accent,
    hoverBorderColor: SEMANTIC_L.borderStrong,
    activeShadow: '0 0 0 3px rgba(61, 90, 254, 0.18)',
  },
  Select: {
    borderRadius: 8,
    optionSelectedBg: SEMANTIC_L.accentWash,
    optionSelectedColor: SEMANTIC_L.accent,
    optionActiveBg: SEMANTIC_L.sunken,
    optionHeight: 34,
    activeBorderColor: SEMANTIC_L.accent,
    hoverBorderColor: SEMANTIC_L.borderStrong,
    activeOutlineColor: 'transparent',
  },
  DatePicker: {
    borderRadius: 8,
    activeBorderColor: SEMANTIC_L.accent,
    hoverBorderColor: SEMANTIC_L.borderStrong,
    activeShadow: '0 0 0 3px rgba(61, 90, 254, 0.18)',
  },
  Tabs: {
    inkBarColor: SEMANTIC_L.accent,
    itemColor: SEMANTIC_L.inkMuted,
    itemSelectedColor: SEMANTIC_L.ink,
    itemHoverColor: SEMANTIC_L.ink,
    horizontalItemPadding: '10px 0',
    titleFontSize: 14,
  },
  Segmented: {
    itemSelectedBg: SEMANTIC_L.surface,
    trackBg: SEMANTIC_L.sunken,
    borderRadius: 8,
    itemSelectedColor: SEMANTIC_L.ink,
  },
  Modal: {
    titleFontSize: 20,
    contentBg: SEMANTIC_L.surface,
    headerBg: 'transparent',
    footerBg: 'transparent',
    borderRadiusLG: 12,
  },
  Drawer: {
    colorBgElevated: SEMANTIC_L.surface,
    paddingLG: 24,
  },
  Tag: {
    defaultBg: SEMANTIC_L.sunken,
    defaultColor: SEMANTIC_L.inkMuted,
    borderRadiusSM: 4,
  },
  Alert: {
    defaultPadding: '10px 14px',
    withDescriptionPadding: '14px 16px',
    borderRadiusLG: 8,
  },
  Tooltip: {
    borderRadius: 6,
    colorBgSpotlight: SEMANTIC_L.action,
  },
  Dropdown: {
    borderRadiusLG: 10,
    controlItemBgHover: SEMANTIC_L.sunken,
  },
  Popover: {
    borderRadiusLG: 10,
  },
  Progress: {
    defaultColor: SEMANTIC_L.accent,
    remainingColor: SEMANTIC_L.sunken,
  },
  Checkbox: {
    borderRadiusSM: 4,
  },
  Radio: {
    borderRadiusSM: 4,
  },
  Switch: {
    handleShadow: '0 1px 2px rgba(16, 24, 40, 0.14)',
  },
  Notification: {
    borderRadiusLG: 12,
  },
  Message: {
    borderRadiusLG: 8,
    contentBg: SEMANTIC_L.surface,
  },
  Empty: {
    colorTextDescription: SEMANTIC_L.inkFaint,
  },
  Statistic: {
    contentFontSize: 24,
    fontFamily: FONT_STACK,
  },
  Descriptions: {
    labelBg: SEMANTIC_L.sunken,
    titleMarginBottom: 12,
  },
  Divider: {
    colorSplit: SEMANTIC_L.borderRule,
    marginLG: 24,
  },
  Pagination: {
    borderRadius: 6,
    itemActiveBg: SEMANTIC_L.surface,
    colorPrimary: SEMANTIC_L.ink,
  },
  Upload: {
    borderRadiusLG: 8,
  },
}

const COMPONENTS_LIGHT: ThemeConfig['components'] = {
  ...COMPONENTS_COMMON,
  Layout: { ...COMPONENTS_COMMON.Layout, headerBg: LIGHT.surface, siderBg: LIGHT.surface },
}

const COMPONENTS_DARK: ThemeConfig['components'] = {
  ...COMPONENTS_COMMON,
  Layout: { ...COMPONENTS_COMMON.Layout, headerBg: DARK.surface, siderBg: DARK.surface },
  Table: {
    ...COMPONENTS_COMMON.Table,
    headerBg: DARK.sunken,
    headerColor: DARK.inkFaint,
    rowHoverBg: '#1D2026',
    borderColor: DARK.borderRule,
  },
  Menu: {
    ...COMPONENTS_COMMON.Menu,
    itemSelectedBg: DARK.accentWash,
    itemSelectedColor: DARK.ink,
    itemHoverBg: DARK.sunken,
    itemHoverColor: DARK.ink,
    itemColor: DARK.inkMuted,
  },
  Button: {
    ...COMPONENTS_COMMON.Button,
    primaryShadow: 'none',
    defaultBg: DARK.surface,
    defaultColor: DARK.ink,
    defaultBorderColor: DARK.borderStrong,
    defaultHoverBg: DARK.sunken,
    defaultHoverBorderColor: DARK.inkFaint,
    defaultHoverColor: DARK.ink,
    textHoverBg: DARK.sunken,
  },
  Input: {
    ...COMPONENTS_COMMON.Input,
    activeBg: DARK.raised,
    hoverBg: DARK.raised,
    activeBorderColor: DARK.accent,
    hoverBorderColor: DARK.borderStrong,
    activeShadow: '0 0 0 3px rgba(124, 140, 255, 0.20)',
  },
  InputNumber: {
    ...COMPONENTS_COMMON.InputNumber,
    activeBorderColor: DARK.accent,
    hoverBorderColor: DARK.borderStrong,
    activeShadow: '0 0 0 3px rgba(124, 140, 255, 0.20)',
  },
  Select: {
    ...COMPONENTS_COMMON.Select,
    optionSelectedBg: DARK.accentWash,
    optionSelectedColor: DARK.accent,
    optionActiveBg: DARK.sunken,
    activeBorderColor: DARK.accent,
  },
  DatePicker: {
    ...COMPONENTS_COMMON.DatePicker,
    activeBorderColor: DARK.accent,
    activeShadow: '0 0 0 3px rgba(124, 140, 255, 0.20)',
  },
  Tabs: {
    ...COMPONENTS_COMMON.Tabs,
    inkBarColor: DARK.accent,
    itemColor: DARK.inkMuted,
    itemSelectedColor: DARK.ink,
    itemHoverColor: DARK.ink,
  },
  Modal: { ...COMPONENTS_COMMON.Modal, contentBg: DARK.surface },
  Drawer: { ...COMPONENTS_COMMON.Drawer, colorBgElevated: DARK.surface },
  Segmented: {
    ...COMPONENTS_COMMON.Segmented,
    itemSelectedBg: DARK.raised,
    trackBg: DARK.sunken,
  },
  Tag: { ...COMPONENTS_COMMON.Tag, defaultBg: DARK.sunken, defaultColor: DARK.inkMuted },
  Tooltip: { ...COMPONENTS_COMMON.Tooltip, colorBgSpotlight: '#2C2F36' },
  Descriptions: { ...COMPONENTS_COMMON.Descriptions, labelBg: DARK.sunken },
  Message: { ...COMPONENTS_COMMON.Message, contentBg: DARK.surface },
  Statistic: { ...COMPONENTS_COMMON.Statistic, fontFamily: FONT_STACK },
}

export function buildTheme(mode: ThemeMode): ThemeConfig {
  const dark = mode === 'dark'
  return {
    cssVar: true,
    hashed: false,
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: dark ? TOKEN_DARK : TOKEN_LIGHT,
    components: dark ? COMPONENTS_DARK : COMPONENTS_LIGHT,
  }
}

export function semanticOf(mode: ThemeMode): Semantic {
  return (mode === 'dark' ? SEMANTIC_D : SEMANTIC_L) as Semantic
}

export { LIGHT, DARK, FONT_STACK }
export const BRAND = {
  accent: { light: LIGHT.accent, dark: DARK.accent },
  action: { light: LIGHT.action, dark: DARK.action },
  fontStack: FONT_STACK,
  monoStack: MONO_STACK,
}
