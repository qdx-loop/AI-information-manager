/**
 * 设计系统 · 主题层 v5『流光玻璃 LUMINOUS GLASS』
 *
 * 用户指令（2026-11-01）：v4 硬边方向被否——「还是不行，要那种商业高级感，毛玻璃那种。」
 * 本轮视觉语言：极光渐变底 + 多层磨砂玻璃 + 柔和光影 + 精致排版；与 v2/v3/v4 完全切割。
 *
 * skill 依据：ui-ux-pro-max → design-system/luminous-glass/MASTER.md
 *   Style = Liquid Glass（translucency / lensing / layered depth / vibrant background）
 *   项目覆盖（配色/字体/圆角/极光）见 redesign-brief/07-v5-luminous-glass.md §10。
 *
 * 气质：Apple visionOS / Stripe / Arc / Raycast 一类的「贵而克制」；禁止平底白卡、硬边、
 * 荧光黄绿、0 圆角、硬投影。
 */

import { theme, type ThemeConfig } from 'antd'

export type ThemeMode = 'light' | 'dark'

// ══════════════════════════════════════════════════════════════
// 第 1 层 · Primitive（WCAG 实测，勿随意改）
// ══════════════════════════════════════════════════════════════

const LIGHT = {
  bg: '#F0F0F0',
  surface: 'rgba(255, 255, 255, 0.55)',
  surfaceSolid: '#FBFBFB',
  surface2: 'rgba(0, 0, 0, 0.035)',
  glassBorder: 'rgba(255, 255, 255, 0.55)',
  border: 'rgba(0, 0, 0, 0.07)',
  borderStrong: 'rgba(0, 0, 0, 0.12)',
  text: '#1F1F1F',
  textSecondary: '#4F4F4F',
  textMuted: '#7A7A7A',
  accent: '#0067C0',
  accentHover: '#005A9E',
  accentSoft: 'rgba(0, 103, 192, 0.10)',
  accent2: '#00B7C3',
  accentGradient: '#0067C0',
  danger: '#C42B1C',
  dangerSoft: '#FDE7E9',
  success: '#0F7B0F',
  successSoft: '#DFF6DD',
  warning: '#9D5D00',
  warningSoft: '#FFF4CE',
  onAccent: '#08131A',
  onDark: '#F3F3F3',
  darkPanel: '#202020',
  overlay: 'rgba(0, 0, 0, 0.35)',
  shadow: 'rgba(15, 23, 42, 1)',
  focus: 'rgba(0, 103, 192, 0.40)',
} as const

const DARK = {
  bg: '#1F1F1F',
  surface: 'rgba(37, 37, 37, 0.55)',
  surfaceSolid: '#252525',
  surface2: 'rgba(255, 255, 255, 0.06)',
  glassBorder: 'rgba(255, 255, 255, 0.07)',
  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
  text: '#FFFFFF',
  textSecondary: '#D6D6D6',
  textMuted: '#7A7A7A',
  accent: '#4CC2FF',
  accentHover: '#6FD0FF',
  accentSoft: 'rgba(76, 194, 255, 0.12)',
  accent2: '#3DAEE9',
  accentGradient: '#0067C0',
  danger: '#FF99A4',
  dangerSoft: 'rgba(248, 113, 113, 0.12)',
  success: '#34D399',
  successSoft: 'rgba(52, 211, 153, 0.12)',
  warning: '#FCE100',
  warningSoft: 'rgba(251, 191, 36, 0.14)',
  onAccent: '#08131A',
  onDark: '#F3F3F3',
  darkPanel: '#202020',
  overlay: 'rgba(0, 0, 0, 0.45)',
  shadow: 'rgba(0, 0, 0, 1)',
  focus: 'rgba(76, 194, 255, 0.4)',
} as const

/** 图表分类色：保持 Okabe-Ito/Wong 色盲安全，不随玻璃视觉改。 */
const SERIES_L = ['#0067C0', '#3DAEE9', '#5FB3FF', '#8A8A8A', '#5C5C5C'] as const
const SERIES_D = ['#4CC2FF', '#3DAEE9', '#5FB3FF', '#CFCFCF', '#8A8A8A'] as const

// ══════════════════════════════════════════════════════════════
// 第 2 层 · Semantic
// ══════════════════════════════════════════════════════════════

const SEMANTIC_L = {
  bg: LIGHT.bg,
  surface: LIGHT.surface,
  surfaceSolid: LIGHT.surfaceSolid,
  surface2: LIGHT.surface2,
  glassBorder: LIGHT.glassBorder,
  border: LIGHT.border,
  borderStrong: LIGHT.borderStrong,
  text: LIGHT.text,
  textSecondary: LIGHT.textSecondary,
  textMuted: LIGHT.textMuted,
  accent: LIGHT.accent,
  accentHover: LIGHT.accentHover,
  accentSoft: LIGHT.accentSoft,
  accent2: LIGHT.accent2,
  accentGradient: LIGHT.accentGradient,
  danger: LIGHT.danger,
  dangerSoft: LIGHT.dangerSoft,
  success: LIGHT.success,
  successSoft: LIGHT.successSoft,
  warning: LIGHT.warning,
  warningSoft: LIGHT.warningSoft,
  onAccent: LIGHT.onAccent,
  onDark: LIGHT.onDark,
  darkPanel: LIGHT.darkPanel,
  overlay: LIGHT.overlay,
  shadowColor: LIGHT.shadow,
  focus: LIGHT.focus,
  series: SERIES_L,
} as const

const SEMANTIC_D = {
  bg: DARK.bg,
  surface: DARK.surface,
  surfaceSolid: DARK.surfaceSolid,
  surface2: DARK.surface2,
  glassBorder: DARK.glassBorder,
  border: DARK.border,
  borderStrong: DARK.borderStrong,
  text: DARK.text,
  textSecondary: DARK.textSecondary,
  textMuted: DARK.textMuted,
  accent: DARK.accent,
  accentHover: DARK.accentHover,
  accentSoft: DARK.accentSoft,
  accent2: DARK.accent2,
  accentGradient: DARK.accentGradient,
  danger: DARK.danger,
  dangerSoft: DARK.dangerSoft,
  success: DARK.success,
  successSoft: DARK.successSoft,
  warning: DARK.warning,
  warningSoft: DARK.warningSoft,
  onAccent: DARK.onAccent,
  onDark: DARK.onDark,
  darkPanel: DARK.darkPanel,
  overlay: DARK.overlay,
  shadowColor: DARK.shadow,
  focus: DARK.focus,
  series: SERIES_D,
} as const

export type Semantic = typeof SEMANTIC_L

// ══════════════════════════════════════════════════════════════
// 第 3 层 · 字体与 antd token
// ══════════════════════════════════════════════════════════════

/** Display / UI：Plus Jakarta Sans（自托管 variable，latin 子集 ~27KB，OFL） */
export const DISPLAY_STACK = "'Segoe UI Variable Display', 'Segoe UI Variable', 'Segoe UI', Selawik, -apple-system, BlinkMacSystemFont, 'Microsoft YaHei UI', 'PingFang SC', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif"
/** Body：Inter（自托管 variable，latin 子集 ~48KB，OFL） */
export const BODY_STACK = "'Segoe UI Variable Text', 'Segoe UI Variable', 'Segoe UI', Selawik, -apple-system, BlinkMacSystemFont, 'Microsoft YaHei UI', 'PingFang SC', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif"
/** 兼容旧导出名：v5 不授权任何衬线。 */
export const FONT_STACK = BODY_STACK
export const SERIF_STACK = BODY_STACK
export const MONO_STACK = "'Cascadia Mono', 'Cascadia Code', Consolas, 'Courier New', monospace"

const BASE = {
  borderRadius: 8,
  borderRadiusLG: 10,
  borderRadiusSM: 6,
  borderRadiusXS: 6,
  fontFamily: BODY_STACK,
  fontFamilyCode: MONO_STACK,
  fontSize: 14,
  fontSizeSM: 13,
  fontSizeLG: 16,
  fontSizeHeading1: 40,
  fontSizeHeading2: 32,
  fontSizeHeading3: 24,
  fontSizeHeading4: 18,
  fontSizeHeading5: 16,
  lineHeight: 1.55,
  lineHeightHeading1: 1.1,
  lineHeightHeading2: 1.15,
  lineHeightHeading3: 1.25,
  lineHeightHeading4: 1.3,
  wireframe: false,
  controlHeight: 40,
  controlHeightSM: 32,
  controlHeightLG: 48,
  motionDurationFast: '0.12s',
  motionDurationMid: '0.2s',
  motionDurationSlow: '0.3s',
  motionEaseInOut: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  boxShadow: '0 1px 2px rgba(9,9,11,0.04)',
  boxShadowSecondary: '0 4px 12px rgba(9,9,11,0.08), 0 16px 48px rgba(9,9,11,0.08)',
  boxShadowTertiary: '0 24px 64px rgba(9,9,11,0.16)',
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
  colorBgLayout: SEMANTIC_L.bg,
  colorBgContainer: SEMANTIC_L.surfaceSolid,
  colorBgElevated: SEMANTIC_L.surfaceSolid,
  colorBgSpotlight: '#0F172A',
  colorText: SEMANTIC_L.text,
  colorTextSecondary: SEMANTIC_L.textSecondary,
  colorTextTertiary: SEMANTIC_L.textMuted,
  colorTextDescription: SEMANTIC_L.textSecondary,
  colorTextPlaceholder: SEMANTIC_L.textMuted,
  colorTextLightSolid: '#FFFFFF',
  colorBorder: SEMANTIC_L.borderStrong,
  colorBorderSecondary: SEMANTIC_L.border,
  colorSplit: SEMANTIC_L.border,
  colorFillQuaternary: 'rgba(15, 23, 42, 0.03)',
  colorFillTertiary: 'rgba(15, 23, 42, 0.05)',
  colorFillSecondary: 'rgba(15, 23, 42, 0.07)',
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
  colorBgLayout: SEMANTIC_D.bg,
  colorBgContainer: SEMANTIC_D.surfaceSolid,
  colorBgElevated: '#141C30',
  colorBgSpotlight: '#F1F5F9',
  colorText: SEMANTIC_D.text,
  colorTextSecondary: SEMANTIC_D.textSecondary,
  colorTextTertiary: SEMANTIC_D.textMuted,
  colorTextDescription: SEMANTIC_D.textSecondary,
  colorTextPlaceholder: SEMANTIC_D.textMuted,
  colorTextLightSolid: '#FFFFFF',
  colorBorder: SEMANTIC_D.borderStrong,
  colorBorderSecondary: SEMANTIC_D.border,
  colorSplit: SEMANTIC_D.border,
  colorFillQuaternary: 'rgba(255, 255, 255, 0.03)',
  colorFillTertiary: 'rgba(255, 255, 255, 0.06)',
  colorFillSecondary: 'rgba(255, 255, 255, 0.08)',
}

const COMPONENTS_COMMON: NonNullable<ThemeConfig['components']> = {
  Layout: {
    headerHeight: 56,
    headerPadding: '0 20px',
    bodyBg: 'transparent',
    triggerBg: 'transparent',
  },
  Card: {
    boxShadow: '0 1px 2px rgba(9,9,11,0.04)',
    headerBg: 'transparent',
    headerFontSize: 16,
    bodyPadding: 20,
    borderRadiusLG: 20,
  },
  Table: {
    headerBg: 'rgba(255,255,255,0.4)',
    headerColor: SEMANTIC_L.textSecondary,
    headerSplitColor: 'transparent',
    headerBorderRadius: 0,
    rowHoverBg: SEMANTIC_L.accentSoft,
    cellPaddingBlock: 11,
    cellPaddingInline: 14,
    borderColor: SEMANTIC_L.border,
    footerBg: 'transparent',
    stickyScrollBarBg: 'rgba(15,23,42,0.2)',
  },
  Button: {
    fontWeight: 600,
    primaryShadow: '0 6px 20px rgba(99,102,241,0.28)',
    defaultShadow: '0 1px 2px rgba(15,23,42,0.04)',
    dangerShadow: '0 6px 20px rgba(220,38,38,0.22)',
    defaultBg: 'rgba(255,255,255,0.72)',
    defaultColor: SEMANTIC_L.text,
    defaultBorderColor: SEMANTIC_L.borderStrong,
    defaultHoverBg: '#FFFFFF',
    defaultHoverBorderColor: 'rgba(15,23,42,0.22)',
    defaultHoverColor: SEMANTIC_L.text,
    textHoverBg: SEMANTIC_L.accentSoft,
    paddingInline: 18,
    paddingInlineSM: 12,
    borderRadius: 12,
  },
  Input: {
    paddingBlock: 8,
    paddingInline: 13,
    borderRadius: 12,
    activeBg: SEMANTIC_L.surfaceSolid,
    hoverBg: SEMANTIC_L.surfaceSolid,
    activeBorderColor: SEMANTIC_L.accent,
    hoverBorderColor: SEMANTIC_L.borderStrong,
    activeShadow: '0 0 0 4px rgba(99,102,241,0.16)',
  },
  InputNumber: {
    borderRadius: 12,
    activeBorderColor: SEMANTIC_L.accent,
    hoverBorderColor: SEMANTIC_L.borderStrong,
    activeShadow: '0 0 0 4px rgba(99,102,241,0.16)',
  },
  Select: {
    borderRadius: 12,
    optionSelectedBg: SEMANTIC_L.accentSoft,
    optionSelectedColor: SEMANTIC_L.accent,
    optionActiveBg: 'rgba(15,23,42,0.04)',
    optionHeight: 36,
    activeBorderColor: SEMANTIC_L.accent,
    hoverBorderColor: SEMANTIC_L.borderStrong,
    activeOutlineColor: 'transparent',
  },
  DatePicker: {
    borderRadius: 12,
    activeBorderColor: SEMANTIC_L.accent,
    hoverBorderColor: SEMANTIC_L.borderStrong,
    activeShadow: '0 0 0 4px rgba(99,102,241,0.16)',
  },
  Tabs: {
    inkBarColor: SEMANTIC_L.accent,
    itemColor: SEMANTIC_L.textSecondary,
    itemSelectedColor: SEMANTIC_L.text,
    itemHoverColor: SEMANTIC_L.text,
    horizontalItemPadding: '12px 0',
    titleFontSize: 14,
  },
  Segmented: {
    itemSelectedBg: '#FFFFFF',
    itemSelectedColor: SEMANTIC_L.text,
    trackBg: 'rgba(15,23,42,0.05)',
    borderRadius: 10,
  },
  Modal: {
    titleFontSize: 24,
    contentBg: 'rgba(255,255,255,0.78)',
    headerBg: 'transparent',
    footerBg: 'transparent',
    borderRadiusLG: 24,
  },
  Drawer: {
    colorBgElevated: 'rgba(255,255,255,0.82)',
    paddingLG: 24,
  },
  Tag: {
    defaultBg: 'rgba(255,255,255,0.6)',
    defaultColor: SEMANTIC_L.textSecondary,
    borderRadiusSM: 8,
  },
  Alert: {
    defaultPadding: '12px 16px',
    withDescriptionPadding: '16px 18px',
    borderRadiusLG: 14,
  },
  Tooltip: {
    borderRadius: 10,
    colorBgSpotlight: '#0F172A',
  },
  Dropdown: {
    borderRadiusLG: 16,
    controlItemBgHover: SEMANTIC_L.accentSoft,
    controlItemBgActive: SEMANTIC_L.accentSoft,
  },
  Popover: {
    borderRadiusLG: 16,
  },
  Progress: {
    defaultColor: SEMANTIC_L.accent,
    remainingColor: 'rgba(15,23,42,0.08)',
  },
  Checkbox: {
    borderRadiusSM: 6,
  },
  Radio: {
    borderRadiusSM: 999,
  },
  Switch: {
    handleShadow: '0 2px 6px rgba(15,23,42,0.18)',
  },
  Notification: {
    borderRadiusLG: 20,
  },
  Message: {
    borderRadiusLG: 12,
    contentBg: 'rgba(255,255,255,0.9)',
  },
  Empty: {
    colorTextDescription: SEMANTIC_L.textMuted,
  },
  Statistic: {
    contentFontSize: 40,
    fontFamily: DISPLAY_STACK,
  },
  Descriptions: {
    labelBg: 'transparent',
    titleMarginBottom: 12,
  },
  Divider: {
    colorSplit: SEMANTIC_L.border,
    marginLG: 24,
  },
  Pagination: {
    borderRadius: 10,
    itemActiveBg: '#FFFFFF',
    colorPrimary: SEMANTIC_L.accent,
  },
  Upload: {
    borderRadiusLG: 16,
  },
  Form: {
    labelColor: SEMANTIC_L.textSecondary,
    labelFontSize: 12,
  },
}

const COMPONENTS_LIGHT: ThemeConfig['components'] = {
  ...COMPONENTS_COMMON,
  Layout: {
    ...COMPONENTS_COMMON.Layout,
    headerBg: 'transparent',
    siderBg: 'transparent',
  },
}

const COMPONENTS_DARK: ThemeConfig['components'] = {
  ...COMPONENTS_COMMON,
  Layout: {
    ...COMPONENTS_COMMON.Layout,
    headerBg: 'transparent',
    siderBg: 'transparent',
  },
  Table: {
    ...COMPONENTS_COMMON.Table,
    headerBg: 'rgba(255,255,255,0.05)',
    headerColor: SEMANTIC_D.textSecondary,
    rowHoverBg: SEMANTIC_D.accentSoft,
    borderColor: SEMANTIC_D.border,
    stickyScrollBarBg: 'rgba(255,255,255,0.2)',
  },
  Button: {
    ...COMPONENTS_COMMON.Button,
    defaultBg: 'rgba(255,255,255,0.08)',
    defaultColor: SEMANTIC_D.text,
    defaultBorderColor: SEMANTIC_D.borderStrong,
    defaultHoverBg: 'rgba(255,255,255,0.14)',
    defaultHoverBorderColor: 'rgba(255,255,255,0.28)',
    defaultHoverColor: SEMANTIC_D.text,
    textHoverBg: SEMANTIC_D.accentSoft,
  },
  Input: {
    ...COMPONENTS_COMMON.Input,
    activeBg: 'rgba(255,255,255,0.08)',
    hoverBg: 'rgba(255,255,255,0.06)',
    activeBorderColor: SEMANTIC_D.accent,
    hoverBorderColor: SEMANTIC_D.borderStrong,
    activeShadow: '0 0 0 4px rgba(129,140,248,0.18)',
  },
  InputNumber: {
    ...COMPONENTS_COMMON.InputNumber,
    activeBorderColor: SEMANTIC_D.accent,
    hoverBorderColor: SEMANTIC_D.borderStrong,
    activeShadow: '0 0 0 4px rgba(129,140,248,0.18)',
  },
  Select: {
    ...COMPONENTS_COMMON.Select,
    optionSelectedBg: SEMANTIC_D.accentSoft,
    optionSelectedColor: SEMANTIC_D.accent,
    optionActiveBg: 'rgba(255,255,255,0.08)',
    activeBorderColor: SEMANTIC_D.accent,
    hoverBorderColor: SEMANTIC_D.borderStrong,
  },
  DatePicker: {
    ...COMPONENTS_COMMON.DatePicker,
    activeBorderColor: SEMANTIC_D.accent,
    activeShadow: '0 0 0 4px rgba(129,140,248,0.18)',
  },
  Tabs: {
    ...COMPONENTS_COMMON.Tabs,
    inkBarColor: SEMANTIC_D.accent,
    itemColor: SEMANTIC_D.textSecondary,
    itemSelectedColor: SEMANTIC_D.text,
    itemHoverColor: SEMANTIC_D.text,
  },
  Modal: { ...COMPONENTS_COMMON.Modal, contentBg: 'rgba(18,26,44,0.86)' },
  Drawer: { ...COMPONENTS_COMMON.Drawer, colorBgElevated: 'rgba(12,18,32,0.94)' },
  Segmented: {
    ...COMPONENTS_COMMON.Segmented,
    itemSelectedBg: 'rgba(255,255,255,0.12)',
    itemSelectedColor: SEMANTIC_D.text,
    trackBg: 'rgba(255,255,255,0.05)',
  },
  Tag: { ...COMPONENTS_COMMON.Tag, defaultBg: 'rgba(255,255,255,0.08)', defaultColor: SEMANTIC_D.textSecondary },
  Tooltip: { ...COMPONENTS_COMMON.Tooltip, colorBgSpotlight: '#1E293B' },
  Descriptions: { ...COMPONENTS_COMMON.Descriptions },
  Message: { ...COMPONENTS_COMMON.Message, contentBg: 'rgba(20,28,44,0.94)' },
  Statistic: { ...COMPONENTS_COMMON.Statistic, fontFamily: DISPLAY_STACK },
  Pagination: { ...COMPONENTS_COMMON.Pagination, itemActiveBg: 'rgba(255,255,255,0.14)', colorPrimary: SEMANTIC_D.accent },
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

export { LIGHT, DARK }
export const BRAND = {
  accent: { light: LIGHT.accent, dark: DARK.accent },
  gradient: LIGHT.accentGradient,
  displayStack: DISPLAY_STACK,
  bodyStack: BODY_STACK,
  monoStack: MONO_STACK,
}
