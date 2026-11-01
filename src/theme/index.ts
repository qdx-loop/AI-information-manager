/**
 * 设计系统 · 主题层 v9『WINDOWS 11 NATIVE』
 *
 * 用户指令（2026-11-01 第 9 轮）：完全按《前端提示词》重做全部界面——
 * Windows 11 / Fluent Design 原生桌面应用；Mica + Acrylic、窄图标导航、
 * 拖拽标题栏、无渐变、低饱和、8px 圆角、Segoe UI Variable。
 *
 * 本文件只负责两件事：
 *   1. 导出字体栈常量（内联样式需要）
 *   2. 把 antd v5 的 token 调到 Win11 语义层（视觉细节由 w11/antd.css 完成）
 *
 * 颜色/材质/尺寸的唯一来源是 `src/styles/w11/tokens.css`；这里不重复定义色板。
 */

import { theme, type ThemeConfig } from 'antd'

export type ThemeMode = 'light' | 'dark'

export const BODY_STACK =
  "'Segoe UI Variable Text', 'Segoe UI Variable', 'Segoe UI', Selawik, -apple-system, BlinkMacSystemFont, 'Microsoft YaHei UI', 'PingFang SC', 'Noto Sans CJK SC', 'Source Han Sans SC', sans-serif"

export const DISPLAY_STACK =
  "'Segoe UI Variable Display', 'Segoe UI Variable', 'Segoe UI', Selawik, -apple-system, BlinkMacSystemFont, 'Microsoft YaHei UI', 'PingFang SC', 'Noto Sans CJK SC', 'Source Han Sans SC', sans-serif"

export const MONO_STACK =
  "'Cascadia Mono', 'Cascadia Code', Consolas, 'Courier New', 'Noto Sans Mono CJK SC', monospace"

/** Win11 中性色 / 强调色（与 tokens.css 保持一致，供 antd token 使用） */
export const LIGHT = {
  bg: '#F3F3F3',
  surface: '#FFFFFF',
  surfaceSolid: '#F9F9F9',
  text: '#1B1B1B',
  textSecondary: '#5C5C5C',
  textMuted: '#8A8A8A',
  border: 'rgba(0,0,0,0.08)',
  borderStrong: 'rgba(0,0,0,0.16)',
  accent: '#0067C0',
  danger: '#C42B1C',
  success: '#0F7B0F',
  warning: '#9D5D00',
  onAccent: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.30)',
  focus: '#1B1B1B',
} as const

export const DARK = {
  bg: '#202020',
  surface: 'rgba(255,255,255,0.0512)',
  surfaceSolid: '#2B2B2B',
  text: '#FFFFFF',
  textSecondary: '#D6D6D6',
  textMuted: '#A0A0A0',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  accent: '#4CC2FF',
  danger: '#FF99A4',
  success: '#6CCB5F',
  warning: '#FCE100',
  onAccent: '#000000',
  overlay: 'rgba(0,0,0,0.45)',
  focus: '#FFFFFF',
} as const

const SERIES_L = ['#0067C0', '#0F7B0F', '#9D5D00', '#C42B1C', '#5C5C5C'] as const
const SERIES_D = ['#4CC2FF', '#6CCB5F', '#FCE100', '#FF99A4', '#C8C8C8'] as const

const COMMON: ThemeConfig['token'] = {
  fontFamily: BODY_STACK,
  fontFamilyCode: MONO_STACK,
  fontSize: 14,
  fontSizeSM: 12,
  fontSizeLG: 16,
  lineHeight: 20 / 14,
  borderRadius: 4,
  borderRadiusXS: 3,
  borderRadiusSM: 4,
  borderRadiusLG: 8,
  controlHeight: 32,
  controlHeightSM: 28,
  controlHeightLG: 40,
  lineWidth: 1,
  wireframe: false,
  motionDurationFast: '0.1s',
  motionDurationMid: '0.15s',
  motionDurationSlow: '0.2s',
  motionEaseInOut: 'cubic-bezier(0.1, 0.9, 0.2, 1)',
  motionEaseOut: 'cubic-bezier(0.1, 0.9, 0.2, 1)',
  padding: 16,
  paddingSM: 12,
  paddingXS: 8,
  margin: 16,
  marginSM: 12,
  marginXS: 8,
}

const TOKEN_LIGHT: ThemeConfig['token'] = {
  ...COMMON,
  colorPrimary: LIGHT.accent,
  colorInfo: LIGHT.accent,
  colorLink: LIGHT.accent,
  colorLinkHover: '#0078D4',
  colorSuccess: LIGHT.success,
  colorWarning: LIGHT.warning,
  colorError: LIGHT.danger,
  colorTextBase: LIGHT.text,
  colorBgBase: LIGHT.bg,
  colorBgContainer: LIGHT.surface,
  colorBgElevated: LIGHT.surfaceSolid,
  colorBgLayout: 'transparent',
  colorBgSpotlight: LIGHT.surfaceSolid,
  colorBorder: LIGHT.border,
  colorBorderSecondary: 'rgba(0,0,0,0.0578)',
  colorSplit: 'rgba(0,0,0,0.0803)',
  colorText: LIGHT.text,
  colorTextSecondary: LIGHT.textSecondary,
  colorTextTertiary: LIGHT.textMuted,
  colorTextQuaternary: '#B0B0B0',
  colorTextDisabled: '#B0B0B0',
  colorTextPlaceholder: '#8A8A8A',
  colorFillAlter: 'rgba(0,0,0,0.03)',
  colorFillSecondary: 'rgba(0,0,0,0.05)',
  colorFillTertiary: 'rgba(0,0,0,0.04)',
  boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
  boxShadowSecondary: '0 8px 16px rgba(0,0,0,0.14)',
  boxShadowTertiary: '0 2px 4px rgba(0,0,0,0.06)',
}

const TOKEN_DARK: ThemeConfig['token'] = {
  ...COMMON,
  colorPrimary: DARK.accent,
  colorInfo: DARK.accent,
  colorLink: DARK.accent,
  colorLinkHover: '#6DD0FF',
  colorSuccess: DARK.success,
  colorWarning: DARK.warning,
  colorError: DARK.danger,
  colorTextBase: DARK.text,
  colorBgBase: DARK.bg,
  colorBgContainer: DARK.surface,
  colorBgElevated: DARK.surfaceSolid,
  colorBgLayout: 'transparent',
  colorBgSpotlight: '#2B2B2B',
  colorBorder: DARK.border,
  colorBorderSecondary: 'rgba(255,255,255,0.0698)',
  colorSplit: 'rgba(255,255,255,0.0837)',
  colorText: DARK.text,
  colorTextSecondary: DARK.textSecondary,
  colorTextTertiary: DARK.textMuted,
  colorTextQuaternary: '#6B6B6B',
  colorTextDisabled: '#6B6B6B',
  colorTextPlaceholder: '#A0A0A0',
  colorFillAlter: 'rgba(255,255,255,0.0337)',
  colorFillSecondary: 'rgba(255,255,255,0.0512)',
  colorFillTertiary: 'rgba(255,255,255,0.0337)',
  boxShadow: '0 2px 4px rgba(0,0,0,0.24)',
  boxShadowSecondary: '0 8px 16px rgba(0,0,0,0.4)',
  boxShadowTertiary: '0 2px 4px rgba(0,0,0,0.2)',
}

const COMPONENTS: ThemeConfig['components'] = {
  Button: {
    fontWeight: 400,
    primaryShadow: 'none',
    defaultShadow: 'none',
    dangerShadow: 'none',
    defaultBorderColor: 'transparent',
    paddingInline: 12,
    contentFontSize: 14,
  },
  Input: {
    activeShadow: 'none',
    hoverBorderColor: 'rgba(128,128,128,0.45)',
    activeBorderColor: 'rgba(128,128,128,0.45)',
    paddingInline: 10,
  },
  InputNumber: {
    activeShadow: 'none',
    hoverBorderColor: 'rgba(128,128,128,0.45)',
    activeBorderColor: 'rgba(128,128,128,0.45)',
  },
  Select: {
    optionSelectedBg: 'transparent',
    optionActiveBg: 'rgba(128,128,128,0.12)',
    optionHeight: 32,
    optionPadding: '6px 10px',
    activeOutlineColor: 'transparent',
    hoverBorderColor: 'rgba(128,128,128,0.45)',
    activeBorderColor: 'rgba(128,128,128,0.45)',
  },
  Table: {
    headerBg: 'transparent',
    headerColor: DARK.textSecondary,
    headerSplitColor: 'transparent',
    borderColor: DARK.border,
    rowHoverBg: 'rgba(255,255,255,0.0837)',
    cellPaddingBlock: 6,
    cellPaddingInline: 12,
    cellFontSize: 14,
  },
  Modal: {
    contentBg: 'transparent',
    headerBg: 'transparent',
    footerBg: 'transparent',
    titleFontSize: 20,
    borderRadiusLG: 8,
  },
  Drawer: {
    colorBgElevated: 'transparent',
    paddingLG: 20,
  },
  Dropdown: {
    borderRadiusLG: 8,
    controlItemBgHover: 'rgba(128,128,128,0.14)',
    controlItemBgActive: 'rgba(76,194,255,0.12)',
    paddingBlock: 6,
  },
  Tooltip: {
    borderRadius: 4,
    colorBgSpotlight: '#2B2B2B',
  },
  Switch: {
    handleShadow: 'none',
    trackHeight: 20,
    trackMinWidth: 40,
    trackPadding: 3,
    handleSize: 12,
  },
  Checkbox: {
    borderRadiusSM: 4,
  },
  Radio: {
    borderRadiusSM: 999,
  },
  Tabs: {
    inkBarColor: DARK.accent,
    itemColor: DARK.textSecondary,
    itemSelectedColor: DARK.text,
    itemHoverColor: DARK.text,
    horizontalItemPadding: '8px 0',
    titleFontSize: 14,
  },
  Form: {
    labelColor: DARK.textSecondary,
    labelFontSize: 13,
    itemMarginBottom: 16,
    verticalLabelPadding: '0 0 4px',
  },
  Pagination: {
    itemActiveBg: 'rgba(76,194,255,0.12)',
    colorPrimary: DARK.accent,
  },
  Alert: {
    withDescriptionPadding: '10px 14px',
    borderRadiusLG: 8,
  },
  Message: {
    contentBg: 'transparent',
  },
  Notification: {
    borderRadiusLG: 8,
  },
  Segmented: {
    itemSelectedBg: DARK.surface,
    trackBg: 'rgba(255,255,255,0.04)',
  },
  Upload: {
    borderRadiusLG: 8,
  },
  Progress: {
    defaultColor: DARK.accent,
    remainingColor: 'rgba(255,255,255,0.08)',
  },
  Divider: {
    colorSplit: DARK.border,
    marginLG: 16,
  },
  Tag: {
    borderRadiusSM: 4,
    defaultBg: 'rgba(255,255,255,0.0512)',
    defaultColor: DARK.textSecondary,
  },
  Avatar: {
    containerSize: 32,
    groupOverlapping: -8,
  },
  Spin: {
    colorPrimary: DARK.accent,
  },
  Popover: {
    borderRadiusLG: 8,
  },
  Result: {
    titleFontSize: 24,
    subtitleFontSize: 14,
  },
}

export function buildTheme(mode: ThemeMode): ThemeConfig {
  const dark = mode === 'dark'
  return {
    cssVar: true,
    hashed: false,
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: dark ? TOKEN_DARK : TOKEN_LIGHT,
    components: COMPONENTS,
  }
}

export interface Semantic {
  bg: string
  surface: string
  surfaceSolid: string
  surface2: string
  glassBorder: string
  border: string
  borderStrong: string
  text: string
  textSecondary: string
  textMuted: string
  accent: string
  accentHover: string
  accentSoft: string
  accent2: string
  accentGradient: string
  danger: string
  dangerSoft: string
  success: string
  successSoft: string
  warning: string
  warningSoft: string
  onAccent: string
  onDark: string
  darkPanel: string
  overlay: string
  shadowColor: string
  focus: string
  series: readonly string[]
}

/** 兼容旧调用：返回语义色（v9 起 CSS 变量是唯一来源，此函数仅供内联样式兜底）。 */
export function semanticOf(mode: ThemeMode): Semantic {
  const dark = mode === 'dark'
  const c = dark ? DARK : LIGHT
  return {
    bg: c.bg,
    surface: c.surface,
    surfaceSolid: c.surfaceSolid,
    surface2: c.border,
    glassBorder: c.border,
    border: c.border,
    borderStrong: c.borderStrong,
    text: c.text,
    textSecondary: c.textSecondary,
    textMuted: c.textMuted,
    accent: c.accent,
    accentHover: dark ? '#6DD0FF' : '#0078D4',
    accentSoft: dark ? 'rgba(76,194,255,0.12)' : 'rgba(0,103,192,0.09)',
    accent2: dark ? '#3DAEE9' : '#0078D4',
    accentGradient: c.accent,
    danger: dark ? '#FF99A4' : '#C42B1C',
    dangerSoft: dark ? 'rgba(255,153,164,0.12)' : 'rgba(196,43,28,0.09)',
    success: dark ? '#6CCB5F' : '#0F7B0F',
    successSoft: dark ? 'rgba(108,203,95,0.14)' : 'rgba(15,123,15,0.1)',
    warning: dark ? '#FCE100' : '#9D5D00',
    warningSoft: dark ? 'rgba(252,225,0,0.12)' : 'rgba(157,93,0,0.1)',
    onAccent: c.onAccent,
    onDark: dark ? '#FFFFFF' : '#1B1B1B',
    darkPanel: dark ? '#2B2B2B' : '#F9F9F9',
    overlay: c.overlay,
    shadowColor: '#000000',
    focus: c.focus,
    series: dark ? SERIES_D : SERIES_L,
  }
}

export const BRAND = {
  accent: { light: LIGHT.accent, dark: DARK.accent },
  gradient: LIGHT.accent,
  displayStack: DISPLAY_STACK,
  bodyStack: BODY_STACK,
  monoStack: MONO_STACK,
}
