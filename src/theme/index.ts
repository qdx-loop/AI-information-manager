/**
 * 设计系统 · 主题层（2026-10 第二轮大改版）
 *
 * 方向：『官纸账簿 The Ledger』
 *   暖纸底 + 墨字 + 朱砂标记 + 账线；衬线只做 ≥20px 标题，无衬线做 UI，
 *   等宽做数字/日期/ID；圆角 ≤6、零卡片阴影、零渐变、零 emoji、零无限动画。
 *
 * 依据：redesign-brief/01-ui-research.md（§D 方向选择、§E token、§K 禁止清单）。
 * 与上一版（青瓷工作台）的关系是「换骨不换筋」：三层 token 结构、对比度纪律、
 * 色盲安全图表色全部保留；品牌色从青瓷釉退场，界面骨架改由「墨」承担动作、
 * 「朱砂」只承担标记（选中/焦点/AI 批注/印章），任何一屏彩度面积 ≤3%。
 *
 * 三层结构（不变）：
 *   1) primitive 原始色阶（PAPER / INK / CINNABAR / DANGER …）
 *   2) semantic  语义角色（surface / ink / accent / action …），亮暗各一套
 *   3) component antd 组件 token（统一收编默认外观）
 */

import { theme, type ThemeConfig } from 'antd'

export type ThemeMode = 'light' | 'dark'

// ══════════════════════════════════════════════════════════════
// 第 1 层 · Primitive
// ══════════════════════════════════════════════════════════════

/** 纸（暖中性）。同一色温，由浅到深；画布不是纯白，避免「AI SaaS 冷白」。 */
const PAPER = {
  canvas: '#F7F4ED',
  surface: '#FDFBF6',
  sunken: '#EFEBE1',
  raised: '#FFFDF9',
  overlay: 'rgba(28, 26, 22, 0.42)',
} as const

/** 墨阶（暖灰黑）。正文 15.68:1、次要 8.56:1、注脚 5.10:1（对 canvas，WCAG 实测）。 */
const INK = {
  strong: '#1C1B18',
  soft: '#4A463D',
  faint: '#6E6759',
} as const

/** 朱砂（印章红）。低彩偏褐，只做标记；当文字时用 text 档（7.31:1）。 */
const CINNABAR = {
  base: '#A63D2C',
  text: '#8C3325',
  wash: '#F6E7E1',
} as const

/** 墨色主按钮（白字 15.50:1）。暗色模式反相成亮底深字。 */
const ACTION = {
  base: '#26241F',
  hover: '#3A3730',
} as const

const LINE = {
  border: '#D9D3C5',
  strong: '#B9B0A0',
  soft: '#E6E1D5',
} as const

const STATE_L = {
  success: '#3F6B4A',
  warning: '#8A5A22',
  warningWash: '#F6EDDE',
  danger: '#A82A1F',
  dangerWash: '#F7E4E1',
} as const

/** 暗色：墨底（不是纯黑），纸与墨整体反转，朱砂提亮。 */
const DARK_PRIMITIVE = {
  canvas: '#141310',
  surface: '#1B1917',
  sunken: '#232019',
  raised: '#26221C',
  overlay: 'rgba(0, 0, 0, 0.62)',
  ink: '#E8E4DA',
  inkSoft: '#B9B2A4',
  inkFaint: '#948C7D',
  border: '#33302A',
  borderStrong: '#4A453C',
  borderSoft: '#2A2722',
  accent: '#E0785F',
  accentText: '#E0785F',
  accentWash: '#33231F',
  action: '#E8E4DA',
  actionHover: '#F2EEE4',
  success: '#7FB08C',
  warning: '#D6A05C',
  warningWash: '#33291C',
  danger: '#F0785F',
  dangerWash: '#3A2320',
} as const

/**
 * 图表分类色：Okabe-Ito/Wong 色盲安全 5 色子集（Wong 2011, Nat Methods）。
 * 上一轮已用 Machado(2009) 标准矩阵验证：正常/绿色盲/红色盲下无危险色对。
 * 这是数据产品的核心输出，**不要为了配合新配色而改动**。
 */
const SERIES_L = ['#009E73', '#0072B2', '#D55E00', '#CC79A7', '#1A1A1A'] as const
const SERIES_D = ['#009E73', '#0072B2', '#D55E00', '#CC79A7', '#B4BCC6'] as const

// ══════════════════════════════════════════════════════════════
// 第 2 层 · Semantic
// ══════════════════════════════════════════════════════════════

/**
 * 亮色语义。
 *
 * 兼容字段说明（旧组件依赖，值已按新体系重映射）：
 * - glaze / glazeText = 墨（旧的「品牌色」位置现在由墨承担动作语义）
 * - glazeSoft / glazeSoftStrong = 纸的凹陷面
 * - kiln / kilnText / kilnWash / kilnWashed = 朱砂（旧「窑火琥珀」位置）
 */
const SEMANTIC_L = {
  surface: PAPER.surface,
  surfaceSunken: PAPER.sunken,
  surfaceRaised: PAPER.raised,
  canvas: PAPER.canvas,
  overlay: PAPER.overlay,

  ink: INK.strong,
  inkSoft: INK.soft,
  inkFaint: INK.faint,

  border: LINE.border,
  borderStrong: LINE.strong,
  borderSoft: LINE.soft,
  rule: LINE.soft,

  /** 朱砂：选中标记、焦点环、AI 批注、印章 */
  accent: CINNABAR.base,
  accentText: CINNABAR.text,
  accentWash: CINNABAR.wash,
  /** 主按钮（墨） */
  action: ACTION.base,
  actionHover: ACTION.hover,

  // —— 旧字段兼容映射 ——
  glaze: ACTION.base,
  glazeText: ACTION.base,
  glazeSoft: PAPER.sunken,
  glazeSoftStrong: LINE.soft,

  kiln: CINNABAR.base,
  kilnText: CINNABAR.text,
  kilnWash: CINNABAR.wash,
  kilnWashed: CINNABAR.wash,
  pinnedWash: CINNABAR.wash,

  success: STATE_L.success,
  warning: STATE_L.warning,
  warningWash: STATE_L.warningWash,
  danger: STATE_L.danger,
  dangerText: STATE_L.danger,
  dangerWash: STATE_L.dangerWash,
  focus: CINNABAR.base,

  series: SERIES_L,
} as const

const SEMANTIC_D = {
  surface: DARK_PRIMITIVE.surface,
  surfaceSunken: DARK_PRIMITIVE.sunken,
  surfaceRaised: DARK_PRIMITIVE.raised,
  canvas: DARK_PRIMITIVE.canvas,
  overlay: DARK_PRIMITIVE.overlay,

  ink: DARK_PRIMITIVE.ink,
  inkSoft: DARK_PRIMITIVE.inkSoft,
  inkFaint: DARK_PRIMITIVE.inkFaint,

  border: DARK_PRIMITIVE.border,
  borderStrong: DARK_PRIMITIVE.borderStrong,
  borderSoft: DARK_PRIMITIVE.borderSoft,
  rule: DARK_PRIMITIVE.borderSoft,

  accent: DARK_PRIMITIVE.accent,
  accentText: DARK_PRIMITIVE.accentText,
  accentWash: DARK_PRIMITIVE.accentWash,
  action: DARK_PRIMITIVE.action,
  actionHover: DARK_PRIMITIVE.actionHover,

  glaze: DARK_PRIMITIVE.action,
  glazeText: DARK_PRIMITIVE.action,
  glazeSoft: DARK_PRIMITIVE.sunken,
  glazeSoftStrong: DARK_PRIMITIVE.borderSoft,

  kiln: DARK_PRIMITIVE.accent,
  kilnText: DARK_PRIMITIVE.accentText,
  kilnWash: DARK_PRIMITIVE.accentWash,
  kilnWashed: DARK_PRIMITIVE.accentWash,
  pinnedWash: DARK_PRIMITIVE.accentWash,

  success: DARK_PRIMITIVE.success,
  warning: DARK_PRIMITIVE.warning,
  warningWash: DARK_PRIMITIVE.warningWash,
  danger: DARK_PRIMITIVE.danger,
  dangerText: DARK_PRIMITIVE.danger,
  dangerWash: DARK_PRIMITIVE.dangerWash,
  focus: DARK_PRIMITIVE.accent,

  series: SERIES_D,
} as const

export type Semantic = typeof SEMANTIC_L

// ══════════════════════════════════════════════════════════════
// 第 3 层 · antd 组件 token
// ══════════════════════════════════════════════════════════════

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Source Han Sans SC', Roboto, sans-serif"

/** 衬线：只用于 ≥20px 中文标题、空状态主句、大数字。禁止网络字体。 */
export const SERIF_STACK =
  "'Noto Serif CJK SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', 'Noto Serif SC', serif"

/** 等宽：数字/日期/ID/编号/快捷键。中文正文绝不用等宽。 */
export const MONO_STACK =
  "'Noto Sans Mono CJK SC', ui-monospace, 'SF Mono', 'Cascadia Mono', Roboto Mono, Menlo, Consolas, monospace"

/**
 * 基准 token。
 * 旧版 controlHeight 34 / borderRadius 8 是「后台模板感」的来源之一：
 * 控件偏大、圆角偏软。新基线 32 / 4（输入框在组件层再收到 2）。
 */
const BASE = {
  borderRadius: 4,
  borderRadiusLG: 6,
  borderRadiusSM: 2,
  fontFamily: FONT_STACK,
  fontFamilyCode: MONO_STACK,
  fontSize: 14,
  fontSizeSM: 13,
  fontSizeLG: 16,
  fontSizeHeading1: 34,
  fontSizeHeading2: 26,
  fontSizeHeading3: 20,
  fontSizeHeading4: 16,
  fontSizeHeading5: 14,
  lineHeight: 1.6,
  lineHeightHeading1: 1.2,
  lineHeightHeading2: 1.3,
  lineHeightHeading3: 1.4,
  wireframe: false,
  controlHeight: 32,
  controlHeightSM: 28,
  controlHeightLG: 40,
  motionDurationMid: '0.16s',
  motionEaseInOut: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
  boxShadow: 'none',
  boxShadowSecondary: '0 1px 2px rgba(28,26,22,.06), 0 8px 24px rgba(28,26,22,.10)',
} as const

const LIGHT: ThemeConfig['token'] = {
  ...BASE,
  colorPrimary: SEMANTIC_L.action,
  colorInfo: SEMANTIC_L.inkSoft,
  colorLink: SEMANTIC_L.accentText,
  colorLinkHover: SEMANTIC_L.accent,
  colorLinkActive: SEMANTIC_L.accentText,
  colorSuccess: SEMANTIC_L.success,
  colorWarning: SEMANTIC_L.warning,
  colorError: SEMANTIC_L.danger,
  colorBgLayout: SEMANTIC_L.canvas,
  colorBgContainer: SEMANTIC_L.surface,
  colorBgElevated: SEMANTIC_L.surfaceRaised,
  colorBgSpotlight: SEMANTIC_L.ink,
  colorText: SEMANTIC_L.ink,
  colorTextSecondary: SEMANTIC_L.inkSoft,
  colorTextTertiary: SEMANTIC_L.inkFaint,
  colorTextDescription: SEMANTIC_L.inkFaint,
  colorTextPlaceholder: SEMANTIC_L.inkFaint,
  colorBorder: SEMANTIC_L.border,
  colorBorderSecondary: SEMANTIC_L.borderSoft,
  colorSplit: SEMANTIC_L.rule,
  colorFillQuaternary: 'rgba(28, 26, 22, 0.04)',
  colorFillTertiary: 'rgba(28, 26, 22, 0.06)',
  colorFillSecondary: 'rgba(28, 26, 22, 0.08)',
}

const DARK: ThemeConfig['token'] = {
  ...BASE,
  colorPrimary: SEMANTIC_D.action,
  colorInfo: SEMANTIC_D.inkSoft,
  colorLink: SEMANTIC_D.accentText,
  colorLinkHover: '#F09A84',
  colorLinkActive: SEMANTIC_D.accentText,
  colorSuccess: SEMANTIC_D.success,
  colorWarning: SEMANTIC_D.warning,
  colorError: SEMANTIC_D.danger,
  colorBgLayout: SEMANTIC_D.canvas,
  colorBgContainer: SEMANTIC_D.surface,
  colorBgElevated: SEMANTIC_D.surfaceRaised,
  colorBgSpotlight: '#2C2821',
  colorText: SEMANTIC_D.ink,
  colorTextSecondary: SEMANTIC_D.inkSoft,
  colorTextTertiary: SEMANTIC_D.inkFaint,
  colorTextDescription: SEMANTIC_D.inkFaint,
  colorTextPlaceholder: SEMANTIC_D.inkFaint,
  colorBorder: SEMANTIC_D.border,
  colorBorderSecondary: SEMANTIC_D.borderSoft,
  colorSplit: SEMANTIC_D.rule,
  colorFillQuaternary: 'rgba(255, 255, 255, 0.04)',
  colorFillTertiary: 'rgba(255, 255, 255, 0.06)',
  colorFillSecondary: 'rgba(255, 255, 255, 0.08)',
}

/**
 * 组件级收编。原则：
 * - 卡片/按钮/表格行/输入框一律 0 阴影；只有浮层允许 `boxShadowSecondary`。
 * - 表格只保留横线（无竖线、无斑马）；表头 sunken 底 + 11px 字。
 * - 侧栏选中 = 朱砂 wash + 左侧 2px 立线，不做整行反白。
 */
const COMPONENTS_COMMON: NonNullable<ThemeConfig['components']> = {
  Layout: {
    headerHeight: 44,
    headerPadding: '0 12px',
    bodyBg: 'transparent',
    triggerBg: 'transparent',
  },
  Card: {
    boxShadow: 'none',
    headerBg: 'transparent',
    headerFontSize: 16,
    bodyPadding: 16,
    borderRadiusLG: 4,
  },
  Table: {
    headerBg: SEMANTIC_L.surfaceSunken,
    headerColor: SEMANTIC_L.inkFaint,
    headerSplitColor: 'transparent',
    headerBorderRadius: 0,
    rowHoverBg: 'rgba(246, 231, 225, 0.55)',
    cellPaddingBlock: 6,
    cellPaddingInline: 12,
    borderColor: SEMANTIC_L.rule,
    footerBg: 'transparent',
    stickyScrollBarBg: SEMANTIC_L.borderStrong,
  },
  Menu: {
    itemHeight: 30,
    itemMarginInline: 0,
    itemMarginBlock: 1,
    itemBorderRadius: 2,
    itemSelectedBg: SEMANTIC_L.accentWash,
    itemSelectedColor: SEMANTIC_L.ink,
    itemHoverBg: SEMANTIC_L.surfaceSunken,
    itemHoverColor: SEMANTIC_L.ink,
    itemColor: SEMANTIC_L.inkSoft,
    iconSize: 14,
    activeBarWidth: 2,
    activeBarBorderWidth: 0,
    subMenuItemBg: 'transparent',
  },
  Button: {
    fontWeight: 500,
    primaryShadow: 'none',
    defaultShadow: 'none',
    dangerShadow: 'none',
    defaultBg: SEMANTIC_L.surface,
    defaultColor: SEMANTIC_L.ink,
    defaultBorderColor: SEMANTIC_L.border,
    defaultHoverBg: SEMANTIC_L.surfaceSunken,
    defaultHoverBorderColor: SEMANTIC_L.borderStrong,
    defaultHoverColor: SEMANTIC_L.ink,
    textHoverBg: SEMANTIC_L.surfaceSunken,
    paddingInline: 16,
    paddingInlineSM: 10,
  },
  Input: {
    paddingBlock: 4,
    paddingInline: 10,
    borderRadius: 2,
    activeBg: SEMANTIC_L.surface,
    hoverBg: SEMANTIC_L.surface,
    activeBorderColor: SEMANTIC_L.ink,
    hoverBorderColor: SEMANTIC_L.borderStrong,
    activeShadow: 'none',
  },
  InputNumber: {
    borderRadius: 2,
    activeBorderColor: SEMANTIC_L.ink,
    hoverBorderColor: SEMANTIC_L.borderStrong,
    activeShadow: 'none',
  },
  Select: {
    borderRadius: 2,
    optionSelectedBg: SEMANTIC_L.accentWash,
    optionSelectedColor: SEMANTIC_L.ink,
    optionActiveBg: SEMANTIC_L.surfaceSunken,
    optionHeight: 30,
    activeBorderColor: SEMANTIC_L.ink,
    hoverBorderColor: SEMANTIC_L.borderStrong,
    activeOutlineColor: 'transparent',
  },
  DatePicker: {
    borderRadius: 2,
    activeBorderColor: SEMANTIC_L.ink,
    hoverBorderColor: SEMANTIC_L.borderStrong,
    activeShadow: 'none',
  },
  Tabs: {
    inkBarColor: SEMANTIC_L.ink,
    itemColor: SEMANTIC_L.inkSoft,
    itemSelectedColor: SEMANTIC_L.ink,
    itemHoverColor: SEMANTIC_L.ink,
    horizontalItemPadding: '10px 0',
    titleFontSize: 14,
  },
  Segmented: {
    itemSelectedBg: SEMANTIC_L.surface,
    trackBg: SEMANTIC_L.surfaceSunken,
    borderRadius: 2,
    itemSelectedColor: SEMANTIC_L.ink,
  },
  Modal: {
    titleFontSize: 20,
    contentBg: SEMANTIC_L.surfaceRaised,
    headerBg: 'transparent',
    footerBg: 'transparent',
    borderRadiusLG: 6,
  },
  Drawer: {
    colorBgElevated: SEMANTIC_L.surface,
    paddingLG: 16,
  },
  Tag: {
    defaultBg: 'transparent',
    defaultColor: SEMANTIC_L.inkSoft,
    borderRadiusSM: 2,
  },
  Alert: {
    defaultPadding: '8px 0',
    withDescriptionPadding: '8px 0',
    borderRadiusLG: 2,
  },
  Tooltip: {
    borderRadius: 3,
    colorBgSpotlight: SEMANTIC_L.ink,
  },
  Empty: {
    colorTextDescription: SEMANTIC_L.inkFaint,
  },
  Statistic: {
    contentFontSize: 26,
    fontFamily: MONO_STACK,
  },
  Descriptions: {
    labelBg: SEMANTIC_L.surfaceSunken,
    titleMarginBottom: 12,
  },
  Divider: {
    colorSplit: SEMANTIC_L.rule,
    marginLG: 24,
  },
  Dropdown: {
    borderRadiusLG: 4,
    controlItemBgHover: SEMANTIC_L.surfaceSunken,
  },
  Popover: {
    borderRadiusLG: 4,
  },
  Progress: {
    defaultColor: SEMANTIC_L.accent,
    remainingColor: SEMANTIC_L.surfaceSunken,
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
    borderRadiusLG: 4,
  },
  Message: {
    borderRadiusLG: 4,
    contentBg: SEMANTIC_L.surfaceRaised,
  },
}

const COMPONENTS_LIGHT: ThemeConfig['components'] = {
  ...COMPONENTS_COMMON,
  Layout: { ...COMPONENTS_COMMON.Layout, headerBg: PAPER.surface, siderBg: PAPER.surface },
  Table: {
    ...COMPONENTS_COMMON.Table,
    headerBg: SEMANTIC_L.surfaceSunken,
    rowHoverBg: 'rgba(246, 231, 225, 0.55)',
  },
}

const COMPONENTS_DARK: ThemeConfig['components'] = {
  ...COMPONENTS_COMMON,
  Layout: { ...COMPONENTS_COMMON.Layout, headerBg: SEMANTIC_D.surface, siderBg: SEMANTIC_D.surface },
  Table: {
    ...COMPONENTS_COMMON.Table,
    headerBg: SEMANTIC_D.surfaceSunken,
    headerColor: SEMANTIC_D.inkFaint,
    rowHoverBg: 'rgba(51, 35, 31, 0.55)',
    borderColor: SEMANTIC_D.rule,
  },
  Menu: {
    ...COMPONENTS_COMMON.Menu,
    itemSelectedBg: SEMANTIC_D.accentWash,
    itemSelectedColor: SEMANTIC_D.ink,
    itemHoverBg: SEMANTIC_D.surfaceSunken,
    itemHoverColor: SEMANTIC_D.ink,
    itemColor: SEMANTIC_D.inkSoft,
  },
  Button: {
    ...COMPONENTS_COMMON.Button,
    defaultBg: SEMANTIC_D.surface,
    defaultColor: SEMANTIC_D.ink,
    defaultBorderColor: SEMANTIC_D.border,
    defaultHoverBg: SEMANTIC_D.surfaceSunken,
    defaultHoverBorderColor: SEMANTIC_D.borderStrong,
    defaultHoverColor: SEMANTIC_D.ink,
    textHoverBg: SEMANTIC_D.surfaceSunken,
  },
  Input: {
    ...COMPONENTS_COMMON.Input,
    activeBg: SEMANTIC_D.surface,
    hoverBg: SEMANTIC_D.surface,
    activeBorderColor: SEMANTIC_D.accent,
    hoverBorderColor: SEMANTIC_D.borderStrong,
  },
  Select: {
    ...COMPONENTS_COMMON.Select,
    optionSelectedBg: SEMANTIC_D.accentWash,
    optionSelectedColor: SEMANTIC_D.ink,
    optionActiveBg: SEMANTIC_D.surfaceSunken,
    activeBorderColor: SEMANTIC_D.accent,
  },
  Tabs: {
    ...COMPONENTS_COMMON.Tabs,
    inkBarColor: SEMANTIC_D.ink,
    itemColor: SEMANTIC_D.inkSoft,
    itemSelectedColor: SEMANTIC_D.ink,
    itemHoverColor: SEMANTIC_D.ink,
  },
  Modal: {
    ...COMPONENTS_COMMON.Modal,
    contentBg: SEMANTIC_D.surfaceRaised,
  },
  Drawer: { ...COMPONENTS_COMMON.Drawer, colorBgElevated: SEMANTIC_D.surface },
  Segmented: {
    ...COMPONENTS_COMMON.Segmented,
    itemSelectedBg: SEMANTIC_D.surface,
    trackBg: SEMANTIC_D.surfaceSunken,
  },
  Tooltip: { ...COMPONENTS_COMMON.Tooltip, colorBgSpotlight: '#2C2821' },
  Descriptions: { ...COMPONENTS_COMMON.Descriptions, labelBg: SEMANTIC_D.surfaceSunken },
}

export function buildTheme(mode: ThemeMode): ThemeConfig {
  const dark = mode === 'dark'
  return {
    // cssVar 让业务代码可以用 var(--ant-color-*)，替代写死的灰阶
    cssVar: true,
    hashed: false,
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: dark ? DARK : LIGHT,
    components: dark ? COMPONENTS_DARK : COMPONENTS_LIGHT,
  }
}

/** 取某套主题的语义色，供 CSS 变量注入使用 */
export function semanticOf(mode: ThemeMode): Semantic {
  return (mode === 'dark' ? SEMANTIC_D : SEMANTIC_L) as Semantic
}

export { PAPER, INK, CINNABAR, ACTION, LINE, FONT_STACK }
export const BRAND = {
  /** 动作色（主按钮/选中文字）——墨 */
  ink: { light: ACTION.base, dark: DARK_PRIMITIVE.action },
  /** 标记色（印章/焦点/批注）——朱砂 */
  accent: { light: CINNABAR.base, dark: DARK_PRIMITIVE.accent },
  fontStack: FONT_STACK,
  serifStack: SERIF_STACK,
  monoStack: MONO_STACK,
}
