/**
 * 设计系统 · 主题层 v10『FLUENT UI 2 · WINDOWS 11 应用』
 *
 * 用户指令（2026-11-02 第 10 轮）：
 *   「我是说 Windows 11 风格，不是操作系统」「参考 microsoft/fluentui」「参考 dsh-ui-ux-pro-max」。
 *
 * 唯一设计系统 = Fluent UI React v9（`src/theme/win11.ts` 中的 Fluent Theme）。
 * 本文件做两件事：
 *   1. 导出字体栈常量；
 *   2. 把 **同一份 Fluent theme** 的 token 映射成 antd v5 的 ThemeConfig。
 *      antd 只保留 Fluent 覆盖不到的复杂输入件（DatePicker / Form 校验 / Upload）与表格内核，
 *      其颜色、圆角、字体、控件高度必须与 Fluent 完全一致，不允许出现第二套色板。
 */

import { theme, type ThemeConfig } from 'antd'
import type { Theme as FluentTheme } from '@fluentui/react-components'
import {
  CONSOLAS,
  SEGOE,
  SEGOE_DISPLAY,
  win11FluentDark,
  win11FluentLight,
} from './win11'

export type ThemeMode = 'light' | 'dark'

export const BODY_STACK = SEGOE
export const DISPLAY_STACK = SEGOE_DISPLAY
export const MONO_STACK = CONSOLAS

const num = (v: string | undefined, fb: number): number => {
  const n = parseFloat(v ?? '')
  return Number.isFinite(n) ? n : fb
}

/** 旧导出（部分内联样式可能引用）：值直接来自 Fluent theme，保持同源 */
export const LIGHT = {
  bg: win11FluentLight.colorNeutralBackground2,
  surface: win11FluentLight.colorNeutralBackground1,
  surfaceSolid: win11FluentLight.colorNeutralBackground1,
  text: win11FluentLight.colorNeutralForeground1,
  textSecondary: win11FluentLight.colorNeutralForeground2,
  textMuted: win11FluentLight.colorNeutralForeground3,
  border: win11FluentLight.colorNeutralStroke2,
  borderStrong: win11FluentLight.colorNeutralStroke1,
  accent: win11FluentLight.colorBrandBackground,
  danger: win11FluentLight.colorStatusDangerForeground1,
  success: win11FluentLight.colorStatusSuccessForeground1,
  warning: win11FluentLight.colorStatusWarningForeground1,
  onAccent: win11FluentLight.colorNeutralForegroundOnBrand,
  overlay: win11FluentLight.colorBackgroundOverlay,
  focus: win11FluentLight.colorStrokeFocus2,
} as const

export const DARK = {
  bg: win11FluentDark.colorNeutralBackground2,
  surface: win11FluentDark.colorNeutralBackground1,
  surfaceSolid: win11FluentDark.colorNeutralBackground1,
  text: win11FluentDark.colorNeutralForeground1,
  textSecondary: win11FluentDark.colorNeutralForeground2,
  textMuted: win11FluentDark.colorNeutralForeground3,
  border: win11FluentDark.colorNeutralStroke2,
  borderStrong: win11FluentDark.colorNeutralStroke1,
  accent: win11FluentDark.colorBrandBackground,
  danger: win11FluentDark.colorStatusDangerForeground1,
  success: win11FluentDark.colorStatusSuccessForeground1,
  warning: win11FluentDark.colorStatusWarningForeground1,
  onAccent: win11FluentDark.colorNeutralForegroundOnBrand,
  overlay: win11FluentDark.colorBackgroundOverlay,
  focus: win11FluentDark.colorStrokeFocus2,
} as const

/** 把 Fluent theme token 映射到 antd v5 ThemeConfig（视觉由 w11/antd.css 兜底） */
function antdFromFluent(t: FluentTheme, dark: boolean): ThemeConfig {
  const brand = t.colorBrandBackground
  const components: ThemeConfig['components'] = {
    Button: {
      fontWeight: 400,
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
      defaultBorderColor: 'transparent',
      paddingInline: 12,
      contentFontSize: num(t.fontSizeBase300, 14),
      borderRadius: num(t.borderRadiusMedium, 4),
      controlHeight: 32,
    },
    Input: {
      activeShadow: 'none',
      hoverBorderColor: t.colorNeutralStroke1Hover,
      activeBorderColor: t.colorNeutralStroke1Pressed,
      paddingInline: 10,
      activeBg: t.colorNeutralBackground1,
      hoverBg: t.colorNeutralBackground1Hover,
    },
    InputNumber: {
      activeShadow: 'none',
      hoverBorderColor: t.colorNeutralStroke1Hover,
      activeBorderColor: t.colorNeutralStroke1Pressed,
    },
    Select: {
      optionSelectedBg: t.colorBrandBackground2,
      optionActiveBg: t.colorSubtleBackgroundHover,
      optionHeight: 32,
      optionPadding: '6px 10px',
      activeOutlineColor: 'transparent',
      hoverBorderColor: t.colorNeutralStroke1Hover,
      activeBorderColor: t.colorNeutralStroke1Pressed,
    },
    Table: {
      headerBg: 'transparent',
      headerColor: t.colorNeutralForeground2,
      headerSplitColor: 'transparent',
      borderColor: t.colorNeutralStroke2,
      rowHoverBg: t.colorSubtleBackgroundHover,
      cellPaddingBlock: 6,
      cellPaddingInline: 12,
      cellFontSize: num(t.fontSizeBase300, 14),
    },
    Modal: {
      contentBg: 'transparent',
      headerBg: 'transparent',
      footerBg: 'transparent',
      titleFontSize: num(t.fontSizeBase500, 20),
      borderRadiusLG: num(t.borderRadiusXLarge, 8),
    },
    Drawer: {
      colorBgElevated: 'transparent',
      paddingLG: 20,
    },
    Dropdown: {
      borderRadiusLG: num(t.borderRadiusXLarge, 8),
      controlItemBgHover: t.colorSubtleBackgroundHover,
      controlItemBgActive: t.colorSubtleBackgroundSelected,
      paddingBlock: 6,
    },
    Tooltip: {
      borderRadius: num(t.borderRadiusMedium, 4),
      colorBgSpotlight: t.colorNeutralBackground1,
    },
    Switch: {
      handleShadow: 'none',
      trackHeight: 20,
      trackMinWidth: 40,
      trackPadding: 3,
      handleSize: 12,
    },
    Checkbox: { borderRadiusSM: 4 },
    Radio: { borderRadiusSM: num(t.borderRadiusCircular, 999) },
    Tabs: {
      inkBarColor: brand,
      itemColor: t.colorNeutralForeground2,
      itemSelectedColor: t.colorNeutralForeground1,
      itemHoverColor: t.colorNeutralForeground1,
      horizontalItemPadding: '8px 0',
      titleFontSize: num(t.fontSizeBase300, 14),
    },
    Form: {
      labelColor: t.colorNeutralForeground2,
      labelFontSize: num(t.fontSizeBase200, 12),
      itemMarginBottom: 16,
      verticalLabelPadding: '0 0 4px',
    },
    Pagination: {
      itemActiveBg: t.colorBrandBackground2,
      colorPrimary: brand,
    },
    Alert: {
      withDescriptionPadding: '10px 14px',
      borderRadiusLG: num(t.borderRadiusXLarge, 8),
    },
    Message: { contentBg: 'transparent' },
    Notification: { borderRadiusLG: num(t.borderRadiusXLarge, 8) },
    Segmented: {
      itemSelectedBg: t.colorNeutralBackground1,
      trackBg: t.colorNeutralBackground3,
    },
    Upload: { borderRadiusLG: num(t.borderRadiusXLarge, 8) },
    Progress: {
      defaultColor: brand,
      remainingColor: t.colorNeutralBackground3,
    },
    Divider: { colorSplit: t.colorNeutralStroke2, marginLG: 16 },
    Tag: {
      borderRadiusSM: num(t.borderRadiusMedium, 4),
      defaultBg: t.colorNeutralBackground1,
      defaultColor: t.colorNeutralForeground2,
    },
    Avatar: { containerSize: 32, groupOverlapping: -8 },
    Spin: { colorPrimary: brand },
    Popover: { borderRadiusLG: num(t.borderRadiusXLarge, 8) },
    Result: {
      titleFontSize: num(t.fontSizeBase600, 24),
      subtitleFontSize: num(t.fontSizeBase300, 14),
    },
  }

  return {
    cssVar: true,
    hashed: false,
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      fontFamily: t.fontFamilyBase,
      fontFamilyCode: t.fontFamilyMonospace,
      fontSize: num(t.fontSizeBase300, 14),
      fontSizeSM: num(t.fontSizeBase200, 12),
      fontSizeLG: num(t.fontSizeBase400, 16),
      lineHeight: 20 / 14,
      borderRadius: num(t.borderRadiusMedium, 4),
      borderRadiusXS: num(t.borderRadiusSmall, 2),
      borderRadiusSM: num(t.borderRadiusMedium, 4),
      borderRadiusLG: num(t.borderRadiusXLarge, 8),
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
      colorPrimary: brand,
      colorInfo: t.colorBrandForeground1,
      colorLink: t.colorBrandForegroundLink,
      colorLinkHover: t.colorBrandForegroundLinkHover,
      colorSuccess: t.colorStatusSuccessForeground1,
      colorWarning: t.colorStatusWarningForeground1,
      colorError: t.colorStatusDangerForeground1,
      colorTextBase: t.colorNeutralForeground1,
      colorBgBase: t.colorNeutralBackground2,
      colorBgContainer: t.colorNeutralBackground1,
      colorBgElevated: t.colorNeutralBackground1,
      colorBgLayout: 'transparent',
      colorBgSpotlight: t.colorNeutralBackground1,
      colorBorder: t.colorNeutralStroke2,
      colorBorderSecondary: t.colorNeutralStroke3,
      colorSplit: t.colorNeutralStroke2,
      colorText: t.colorNeutralForeground1,
      colorTextSecondary: t.colorNeutralForeground2,
      colorTextTertiary: t.colorNeutralForeground3,
      colorTextQuaternary: t.colorNeutralForeground4,
      colorTextDisabled: t.colorNeutralForegroundDisabled,
      colorTextPlaceholder: t.colorNeutralForeground4,
      colorFillAlter: t.colorNeutralBackground3,
      colorFillSecondary: t.colorNeutralBackground3,
      colorFillTertiary: t.colorNeutralBackground2,
      boxShadow: t.shadow4,
      boxShadowSecondary: t.shadow16,
      boxShadowTertiary: t.shadow4,
      padding: 16,
      paddingSM: 12,
      paddingXS: 8,
      margin: 16,
      marginSM: 12,
      marginXS: 8,
    },
    components,
  }
}

export function buildTheme(mode: ThemeMode): ThemeConfig {
  const dark = mode === 'dark'
  return antdFromFluent(dark ? win11FluentDark : win11FluentLight, dark)
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

/** 兼容旧调用（v9 起 CSS 变量是唯一来源，此函数仅供内联样式兜底）。 */
export function semanticOf(mode: ThemeMode): Semantic {
  const t = mode === 'dark' ? win11FluentDark : win11FluentLight
  return {
    bg: t.colorNeutralBackground2,
    surface: t.colorNeutralBackground1,
    surfaceSolid: t.colorNeutralBackground1,
    surface2: t.colorNeutralBackground3,
    glassBorder: t.colorNeutralStroke2,
    border: t.colorNeutralStroke2,
    borderStrong: t.colorNeutralStroke1,
    text: t.colorNeutralForeground1,
    textSecondary: t.colorNeutralForeground2,
    textMuted: t.colorNeutralForeground3,
    accent: t.colorBrandBackground,
    accentHover: t.colorBrandBackgroundHover,
    accentSoft: t.colorBrandBackground2,
    accent2: t.colorBrandForeground2,
    accentGradient: t.colorBrandBackground,
    danger: t.colorStatusDangerForeground1,
    dangerSoft: t.colorStatusDangerBackground1,
    success: t.colorStatusSuccessForeground1,
    successSoft: t.colorStatusSuccessBackground1,
    warning: t.colorStatusWarningForeground1,
    warningSoft: t.colorStatusWarningBackground1,
    onAccent: t.colorNeutralForegroundOnBrand,
    onDark: t.colorNeutralForeground1,
    darkPanel: t.colorNeutralBackground1,
    overlay: t.colorBackgroundOverlay,
    shadowColor: '#000000',
    focus: t.colorStrokeFocus2,
    series: [
      t.colorBrandForeground1,
      t.colorPaletteGreenForeground1,
      t.colorPaletteYellowForeground1,
      t.colorPaletteRedForeground1,
      t.colorNeutralForeground3,
    ],
  }
}

export const BRAND = {
  accent: { light: win11FluentLight.colorBrandBackground, dark: win11FluentDark.colorBrandBackground },
  gradient: win11FluentLight.colorBrandBackground,
  displayStack: DISPLAY_STACK,
  bodyStack: BODY_STACK,
  monoStack: MONO_STACK,
}
