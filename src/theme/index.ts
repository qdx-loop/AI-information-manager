/**
 * 设计系统 · 主题层 v4『硬边印刷 SIGNAL PRESS』
 *
 * 用户指令：用 ui-ux-pro-max skill 全盘重设计，**不再沿用 v2 官纸账簿 / v3 石墨信号的任何设计语言**。
 * skill 产物：design-system/signal-press/MASTER.md
 *   Style = Brutalism（sharp corners / visible borders / bold type / visible grid / asymmetric）
 *   Layout = Bento Grid + 12 列 Swiss 栅格
 *   Typography = Outfit（display）+ Work Sans（body），OFL 自托管；中文回退系统黑体
 *   Dial = variance 8 / motion 5 / density 7
 * 项目覆盖（配色 / 0 圆角 / 硬投影 / 逐页结构）见 redesign-brief/06-v4-signal-press.md §10。
 *
 * 气质：骨白纸面 + 纯黑硬边 + 荧光黄绿信号色 + 零圆角 + 硬投影 + 物理按压位移。
 * 禁止：柔和阴影、渐变、玻璃拟态、圆角卡片、衬线、emoji、Filled 图标。
 */

import { theme, type ThemeConfig } from 'antd'

export type ThemeMode = 'light' | 'dark'

// ══════════════════════════════════════════════════════════════
// 第 1 层 · Primitive（WCAG 实测，勿随意改）
// ══════════════════════════════════════════════════════════════

const LIGHT = {
  paper: '#ECE9E0',
  sheet: '#FFFEF9',
  panel: '#F5F2E8',
  ink: '#141412',
  inkSoft: '#57544B',
  inkFaint: '#676358',
  line: '#141412',
  lineSoft: '#C9C4B5',
  lime: '#D4FF3F',
  limeHover: '#C3EF2B',
  limeWash: '#F4FFCE',
  signal: '#FF5A1F',
  danger: '#C22A1C',
  dangerWash: '#FBE3DE',
  success: '#1B7A43',
  successWash: '#DFF3E7',
  warning: '#8A5A00',
  warningWash: '#F8EACB',
  onLime: '#141412',
  onInk: '#F5F3E9',
  overlay: 'rgba(20, 20, 18, 0.52)',
} as const

const DARK = {
  paper: '#101010',
  sheet: '#181817',
  panel: '#21211F',
  ink: '#F5F3E9',
  inkSoft: '#BDB9AC',
  inkFaint: '#938F83',
  line: '#F5F3E9',
  lineSoft: '#3A3A33',
  lime: '#D4FF3F',
  limeHover: '#E2FF6B',
  limeWash: '#2A3313',
  signal: '#FF7A45',
  danger: '#FF6B5A',
  dangerWash: '#3A1D19',
  success: '#6BD39A',
  successWash: '#15281F',
  warning: '#F0B429',
  warningWash: '#2E2411',
  onLime: '#141412',
  onInk: '#F5F3E9',
  overlay: 'rgba(0, 0, 0, 0.66)',
} as const

/**
 * 图表分类色：Okabe-Ito/Wong 色盲安全 5 色子集（与品牌色解耦，
 * 保证黑色/荧光黄绿之外的数据可读性；已验证正常/绿色盲/红色盲无危险色对）。
 */
const SERIES_L = ['#0072B2', '#009E73', '#D55E00', '#CC79A7', '#4B4B45'] as const
const SERIES_D = ['#56A6DC', '#57C695', '#E88552', '#DE9ACB', '#C9C4B5'] as const

// ══════════════════════════════════════════════════════════════
// 第 2 层 · Semantic
// ══════════════════════════════════════════════════════════════

const SEMANTIC_L = {
  paper: LIGHT.paper,
  sheet: LIGHT.sheet,
  panel: LIGHT.panel,
  ink: LIGHT.ink,
  inkSoft: LIGHT.inkSoft,
  inkFaint: LIGHT.inkFaint,
  line: LIGHT.line,
  lineSoft: LIGHT.lineSoft,
  lime: LIGHT.lime,
  limeHover: LIGHT.limeHover,
  limeWash: LIGHT.limeWash,
  signal: LIGHT.signal,
  danger: LIGHT.danger,
  dangerWash: LIGHT.dangerWash,
  success: LIGHT.success,
  successWash: LIGHT.successWash,
  warning: LIGHT.warning,
  warningWash: LIGHT.warningWash,
  onLime: LIGHT.onLime,
  onInk: LIGHT.onInk,
  overlay: LIGHT.overlay,
  shadowInk: LIGHT.ink,
  focus: LIGHT.signal,
  series: SERIES_L,
} as const

const SEMANTIC_D = {
  paper: DARK.paper,
  sheet: DARK.sheet,
  panel: DARK.panel,
  ink: DARK.ink,
  inkSoft: DARK.inkSoft,
  inkFaint: DARK.inkFaint,
  line: DARK.line,
  lineSoft: DARK.lineSoft,
  lime: DARK.lime,
  limeHover: DARK.limeHover,
  limeWash: DARK.limeWash,
  signal: DARK.signal,
  danger: DARK.danger,
  dangerWash: DARK.dangerWash,
  success: DARK.success,
  successWash: DARK.successWash,
  warning: DARK.warning,
  warningWash: DARK.warningWash,
  onLime: DARK.onLime,
  onInk: DARK.onInk,
  overlay: DARK.overlay,
  shadowInk: '#000000',
  focus: DARK.signal,
  series: SERIES_D,
} as const

export type Semantic = typeof SEMANTIC_L

// ══════════════════════════════════════════════════════════════
// 第 3 层 · 字体与 antd token
// ══════════════════════════════════════════════════════════════

const CJK =
  "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif"

/** Display：Outfit（自托管 variable，latin 子集 32KB） */
export const DISPLAY_STACK = `Outfit, -apple-system, BlinkMacSystemFont, 'Segoe UI', ${CJK}`
/** Body：Work Sans（自托管 variable，latin 子集 50KB） */
export const BODY_STACK = `'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', ${CJK}`
/** 兼容旧导出名：v4 不授权任何衬线，serif 直接等于 body。 */
export const FONT_STACK = BODY_STACK
export const SERIF_STACK = BODY_STACK
export const MONO_STACK =
  "ui-monospace, 'SF Mono', 'Cascadia Mono', 'Roboto Mono', 'Noto Sans Mono CJK SC', Menlo, Consolas, monospace"

const BASE = {
  borderRadius: 2,
  borderRadiusLG: 2,
  borderRadiusSM: 2,
  borderRadiusXS: 2,
  fontFamily: BODY_STACK,
  fontFamilyCode: MONO_STACK,
  fontSize: 14,
  fontSizeSM: 13,
  fontSizeLG: 16,
  fontSizeHeading1: 40,
  fontSizeHeading2: 32,
  fontSizeHeading3: 24,
  fontSizeHeading4: 20,
  fontSizeHeading5: 16,
  lineHeight: 1.6,
  lineHeightHeading1: 1.02,
  lineHeightHeading2: 1.1,
  lineHeightHeading3: 1.2,
  lineHeightHeading4: 1.25,
  wireframe: false,
  controlHeight: 40,
  controlHeightSM: 32,
  controlHeightLG: 48,
  motionDurationFast: '0.08s',
  motionDurationMid: '0.14s',
  motionDurationSlow: '0.22s',
  motionEaseInOut: 'cubic-bezier(0.2, 0.9, 0.25, 1.2)',
  boxShadow: '2px 2px 0 var(--shadow-ink)',
  boxShadowSecondary: '4px 4px 0 var(--shadow-ink)',
  boxShadowTertiary: '8px 8px 0 var(--shadow-ink)',
} as const

const TOKEN_LIGHT: ThemeConfig['token'] = {
  ...BASE,
  colorPrimary: SEMANTIC_L.ink,
  colorInfo: SEMANTIC_L.ink,
  colorLink: SEMANTIC_L.ink,
  colorLinkHover: SEMANTIC_L.signal,
  colorLinkActive: SEMANTIC_L.signal,
  colorSuccess: SEMANTIC_L.success,
  colorWarning: SEMANTIC_L.warning,
  colorError: SEMANTIC_L.danger,
  colorBgLayout: SEMANTIC_L.paper,
  colorBgContainer: SEMANTIC_L.sheet,
  colorBgElevated: SEMANTIC_L.sheet,
  colorBgSpotlight: SEMANTIC_L.ink,
  colorText: SEMANTIC_L.ink,
  colorTextSecondary: SEMANTIC_L.inkSoft,
  colorTextTertiary: SEMANTIC_L.inkFaint,
  colorTextDescription: SEMANTIC_L.inkSoft,
  colorTextPlaceholder: SEMANTIC_L.inkFaint,
  colorTextLightSolid: SEMANTIC_L.onInk,
  colorBorder: SEMANTIC_L.line,
  colorBorderSecondary: SEMANTIC_L.lineSoft,
  colorSplit: SEMANTIC_L.lineSoft,
  colorFillQuaternary: 'rgba(20, 20, 18, 0.04)',
  colorFillTertiary: 'rgba(20, 20, 18, 0.06)',
  colorFillSecondary: 'rgba(20, 20, 18, 0.08)',
  colorWhite: '#FFFEF9',
}

const TOKEN_DARK: ThemeConfig['token'] = {
  ...BASE,
  colorPrimary: SEMANTIC_D.lime,
  colorInfo: SEMANTIC_D.lime,
  colorLink: SEMANTIC_D.lime,
  colorLinkHover: SEMANTIC_D.limeHover,
  colorLinkActive: SEMANTIC_D.limeHover,
  colorSuccess: SEMANTIC_D.success,
  colorWarning: SEMANTIC_D.warning,
  colorError: SEMANTIC_D.danger,
  colorBgLayout: SEMANTIC_D.paper,
  colorBgContainer: SEMANTIC_D.sheet,
  colorBgElevated: SEMANTIC_D.sheet,
  colorBgSpotlight: SEMANTIC_D.ink,
  colorText: SEMANTIC_D.ink,
  colorTextSecondary: SEMANTIC_D.inkSoft,
  colorTextTertiary: SEMANTIC_D.inkFaint,
  colorTextDescription: SEMANTIC_D.inkSoft,
  colorTextPlaceholder: SEMANTIC_D.inkFaint,
  colorTextLightSolid: SEMANTIC_D.onInk,
  colorBorder: SEMANTIC_D.line,
  colorBorderSecondary: SEMANTIC_D.lineSoft,
  colorSplit: SEMANTIC_D.lineSoft,
  colorFillQuaternary: 'rgba(245, 243, 233, 0.05)',
  colorFillTertiary: 'rgba(245, 243, 233, 0.08)',
  colorFillSecondary: 'rgba(245, 243, 233, 0.10)',
  colorWhite: '#181817',
}

const COMPONENTS_COMMON: NonNullable<ThemeConfig['components']> = {
  Layout: {
    headerHeight: 64,
    headerPadding: '0 24px',
    bodyBg: 'transparent',
    triggerBg: 'transparent',
  },
  Card: {
    boxShadow: 'none',
    headerBg: SEMANTIC_L.sheet,
    headerFontSize: 18,
    bodyPadding: 20,
    borderRadiusLG: 2,
  },
  Table: {
    headerBg: SEMANTIC_L.ink,
    headerColor: SEMANTIC_L.onInk,
    headerSplitColor: 'transparent',
    headerBorderRadius: 0,
    rowHoverBg: SEMANTIC_L.limeWash,
    cellPaddingBlock: 10,
    cellPaddingInline: 12,
    borderColor: SEMANTIC_L.lineSoft,
    footerBg: 'transparent',
    stickyScrollBarBg: SEMANTIC_L.ink,
  },
  Button: {
    fontWeight: 600,
    primaryShadow: '2px 2px 0 var(--shadow-ink)',
    defaultShadow: '2px 2px 0 var(--shadow-ink)',
    dangerShadow: '2px 2px 0 var(--shadow-ink)',
    defaultBg: SEMANTIC_L.sheet,
    defaultColor: SEMANTIC_L.ink,
    defaultBorderColor: SEMANTIC_L.line,
    defaultHoverBg: SEMANTIC_L.limeWash,
    defaultHoverBorderColor: SEMANTIC_L.line,
    defaultHoverColor: SEMANTIC_L.ink,
    primaryColor: SEMANTIC_L.onLime,
    colorPrimary: SEMANTIC_L.lime,
    colorPrimaryHover: SEMANTIC_L.limeHover,
    colorPrimaryActive: SEMANTIC_L.limeHover,
    textHoverBg: SEMANTIC_L.limeWash,
    paddingInline: 18,
    paddingInlineSM: 12,
  },
  Input: {
    paddingBlock: 8,
    paddingInline: 12,
    borderRadius: 2,
    activeBg: SEMANTIC_L.sheet,
    hoverBg: SEMANTIC_L.sheet,
    activeBorderColor: SEMANTIC_L.ink,
    hoverBorderColor: SEMANTIC_L.ink,
    activeShadow: '0 0 0 3px #D4FF3F',
    addonBg: SEMANTIC_L.panel,
  },
  InputNumber: {
    borderRadius: 2,
    activeBorderColor: SEMANTIC_L.ink,
    hoverBorderColor: SEMANTIC_L.ink,
    activeShadow: '0 0 0 3px #D4FF3F',
  },
  Select: {
    borderRadius: 2,
    optionSelectedBg: SEMANTIC_L.limeWash,
    optionSelectedColor: SEMANTIC_L.ink,
    optionActiveBg: SEMANTIC_L.panel,
    optionHeight: 36,
    activeBorderColor: SEMANTIC_L.ink,
    hoverBorderColor: SEMANTIC_L.ink,
    activeOutlineColor: 'transparent',
  },
  DatePicker: {
    borderRadius: 2,
    activeBorderColor: SEMANTIC_L.ink,
    hoverBorderColor: SEMANTIC_L.ink,
    activeShadow: '0 0 0 3px #D4FF3F',
  },
  Tabs: {
    inkBarColor: SEMANTIC_L.lime,
    itemColor: SEMANTIC_L.inkSoft,
    itemSelectedColor: SEMANTIC_L.ink,
    itemHoverColor: SEMANTIC_L.ink,
    horizontalItemPadding: '12px 0',
    titleFontSize: 14,
  },
  Segmented: {
    itemSelectedBg: SEMANTIC_L.lime,
    itemSelectedColor: SEMANTIC_L.onLime,
    trackBg: SEMANTIC_L.panel,
    borderRadius: 2,
  },
  Modal: {
    titleFontSize: 24,
    contentBg: SEMANTIC_L.sheet,
    headerBg: SEMANTIC_L.sheet,
    footerBg: SEMANTIC_L.sheet,
    borderRadiusLG: 2,
  },
  Drawer: {
    colorBgElevated: SEMANTIC_L.sheet,
    paddingLG: 24,
  },
  Tag: {
    defaultBg: SEMANTIC_L.panel,
    defaultColor: SEMANTIC_L.ink,
    borderRadiusSM: 2,
  },
  Alert: {
    defaultPadding: '12px 16px',
    withDescriptionPadding: '16px 18px',
    borderRadiusLG: 2,
  },
  Tooltip: {
    borderRadius: 2,
    colorBgSpotlight: SEMANTIC_L.ink,
  },
  Dropdown: {
    borderRadiusLG: 2,
    controlItemBgHover: SEMANTIC_L.limeWash,
    controlItemBgActive: SEMANTIC_L.limeWash,
  },
  Popover: {
    borderRadiusLG: 2,
  },
  Progress: {
    defaultColor: SEMANTIC_L.lime,
    remainingColor: SEMANTIC_L.panel,
  },
  Checkbox: {
    borderRadiusSM: 2,
  },
  Radio: {
    borderRadiusSM: 2,
  },
  Switch: {
    handleShadow: 'none',
  },
  Notification: {
    borderRadiusLG: 2,
  },
  Message: {
    borderRadiusLG: 2,
    contentBg: SEMANTIC_L.sheet,
  },
  Empty: {
    colorTextDescription: SEMANTIC_L.inkFaint,
  },
  Statistic: {
    contentFontSize: 40,
    fontFamily: DISPLAY_STACK,
  },
  Descriptions: {
    labelBg: SEMANTIC_L.panel,
    titleMarginBottom: 12,
  },
  Divider: {
    colorSplit: SEMANTIC_L.lineSoft,
    marginLG: 24,
  },
  Pagination: {
    borderRadius: 2,
    itemActiveBg: SEMANTIC_L.lime,
    colorPrimary: SEMANTIC_L.ink,
  },
  Upload: {
    borderRadiusLG: 2,
  },
  Steps: {
    colorPrimary: SEMANTIC_L.lime,
  },
  Form: {
    labelColor: SEMANTIC_L.inkSoft,
    labelFontSize: 12,
  },
}

const COMPONENTS_LIGHT: ThemeConfig['components'] = {
  ...COMPONENTS_COMMON,
  Layout: {
    ...COMPONENTS_COMMON.Layout,
    headerBg: SEMANTIC_L.paper,
    siderBg: SEMANTIC_L.ink,
  },
}

const COMPONENTS_DARK: ThemeConfig['components'] = {
  ...COMPONENTS_COMMON,
  Layout: {
    ...COMPONENTS_COMMON.Layout,
    headerBg: SEMANTIC_D.paper,
    siderBg: '#141412',
  },
  Table: {
    ...COMPONENTS_COMMON.Table,
    headerBg: SEMANTIC_D.ink,
    headerColor: SEMANTIC_D.paper,
    rowHoverBg: SEMANTIC_D.limeWash,
    borderColor: SEMANTIC_D.lineSoft,
    stickyScrollBarBg: SEMANTIC_D.ink,
  },
  Button: {
    ...COMPONENTS_COMMON.Button,
    defaultBg: SEMANTIC_D.sheet,
    defaultColor: SEMANTIC_D.ink,
    defaultBorderColor: SEMANTIC_D.line,
    defaultHoverBg: SEMANTIC_D.limeWash,
    defaultHoverBorderColor: SEMANTIC_D.line,
    defaultHoverColor: SEMANTIC_D.ink,
    primaryColor: SEMANTIC_D.onLime,
    textHoverBg: SEMANTIC_D.limeWash,
  },
  Input: {
    ...COMPONENTS_COMMON.Input,
    activeBg: SEMANTIC_D.sheet,
    hoverBg: SEMANTIC_D.sheet,
    activeBorderColor: SEMANTIC_D.ink,
    hoverBorderColor: SEMANTIC_D.ink,
    activeShadow: '0 0 0 3px #D4FF3F',
    addonBg: SEMANTIC_D.panel,
  },
  InputNumber: {
    ...COMPONENTS_COMMON.InputNumber,
    activeBorderColor: SEMANTIC_D.ink,
    hoverBorderColor: SEMANTIC_D.ink,
    activeShadow: '0 0 0 3px #D4FF3F',
  },
  Select: {
    ...COMPONENTS_COMMON.Select,
    optionSelectedBg: SEMANTIC_D.limeWash,
    optionSelectedColor: SEMANTIC_D.ink,
    optionActiveBg: SEMANTIC_D.panel,
    activeBorderColor: SEMANTIC_D.ink,
    hoverBorderColor: SEMANTIC_D.ink,
  },
  DatePicker: {
    ...COMPONENTS_COMMON.DatePicker,
    activeBorderColor: SEMANTIC_D.ink,
    activeShadow: '0 0 0 3px #D4FF3F',
  },
  Tabs: {
    ...COMPONENTS_COMMON.Tabs,
    inkBarColor: SEMANTIC_D.lime,
    itemColor: SEMANTIC_D.inkSoft,
    itemSelectedColor: SEMANTIC_D.ink,
    itemHoverColor: SEMANTIC_D.ink,
  },
  Modal: { ...COMPONENTS_COMMON.Modal, contentBg: SEMANTIC_D.sheet },
  Drawer: { ...COMPONENTS_COMMON.Drawer, colorBgElevated: SEMANTIC_D.sheet },
  Segmented: {
    ...COMPONENTS_COMMON.Segmented,
    itemSelectedBg: SEMANTIC_D.lime,
    itemSelectedColor: SEMANTIC_D.onLime,
    trackBg: SEMANTIC_D.panel,
  },
  Tag: { ...COMPONENTS_COMMON.Tag, defaultBg: SEMANTIC_D.panel, defaultColor: SEMANTIC_D.ink },
  Tooltip: { ...COMPONENTS_COMMON.Tooltip, colorBgSpotlight: '#2A2A25' },
  Descriptions: { ...COMPONENTS_COMMON.Descriptions, labelBg: SEMANTIC_D.panel },
  Message: { ...COMPONENTS_COMMON.Message, contentBg: SEMANTIC_D.sheet },
  Statistic: { ...COMPONENTS_COMMON.Statistic, fontFamily: DISPLAY_STACK },
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
  lime: { light: LIGHT.lime, dark: DARK.lime },
  ink: { light: LIGHT.ink, dark: DARK.ink },
  displayStack: DISPLAY_STACK,
  bodyStack: BODY_STACK,
  monoStack: MONO_STACK,
}
