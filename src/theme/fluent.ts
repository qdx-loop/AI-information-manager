/**
 * Windows 11 / Fluent 2 主题桥接
 *
 * 规范来源（microsoft/fluentui React v9）：
 * - FluentProvider + createLightTheme/createDarkTheme（官方主题工厂）
 * - Fluent 2 tokens：字体 Segoe UI Variable、字号 12/14/16/20/28/40/68、圆角 4/8/12、
 *   阴影 shadow2/4/8/16/28/64、品牌色 Windows 11 强调蓝 #0067C0 / 暗色 #60CDFF
 * - Windows 11 Mica：窗口基底层 + LayerFillColorDefault 内容层 + Card 层（CSS 实现）
 */
import {
  createDarkTheme,
  createLightTheme,
  type BrandVariants,
  type Theme,
} from '@fluentui/react-components'

const SEGOE =
  "'Segoe UI Variable Text', 'Segoe UI Variable', 'Segoe UI', Selawik, -apple-system, BlinkMacSystemFont, 'Microsoft YaHei UI', 'PingFang SC', 'Noto Sans CJK SC', sans-serif"
const SEGOE_DISPLAY =
  "'Segoe UI Variable Display', 'Segoe UI Variable', 'Segoe UI', Selawik, -apple-system, BlinkMacSystemFont, 'Microsoft YaHei UI', 'PingFang SC', 'Noto Sans CJK SC', sans-serif"
const CONSOLAS = "'Cascadia Mono', 'Cascadia Code', Consolas, 'Courier New', monospace"

/** Windows 11 强调蓝的 16 阶品牌色（create*Theme 需要完整 ramp） */
const windowsBrand: BrandVariants = {
  10: '#001322',
  20: '#001e36',
  30: '#002a4b',
  40: '#003661',
  50: '#004277',
  60: '#004f8e',
  70: '#005ca6',
  80: '#0067c0',
  90: '#0f74c7',
  100: '#2582ce',
  110: '#3a8fd4',
  120: '#4f9ddb',
  130: '#64abe1',
  140: '#79b8e8',
  150: '#8ec6ee',
  160: '#a3d3f4',
}

function withWindowsOverrides(base: Theme, accent: string, onAccent: string): Theme {
  return {
    ...base,
    colorBrandBackground: accent,
    colorBrandBackgroundHover: accent,
    colorBrandBackgroundPressed: accent,
    colorBrandForeground1: accent,
    colorBrandForeground2: accent,
    colorNeutralForegroundOnBrand: onAccent,
    fontFamilyBase: SEGOE,
    fontFamilyMonospace: CONSOLAS,
    fontFamilyNumeric: SEGOE_DISPLAY,
    borderRadiusMedium: '8px',
    borderRadiusLarge: '12px',
    borderRadiusXLarge: '12px',
    borderRadius2XLarge: '16px',
    fontSizeBase300: '14px',
    lineHeightBase300: '20px',
  }
}

export const fluentWindowsLight = withWindowsOverrides(createLightTheme(windowsBrand), '#0067C0', '#FFFFFF')
export const fluentWindowsDark = withWindowsOverrides(createDarkTheme(windowsBrand), '#4CC2FF', '#08131A')
export { SEGOE, SEGOE_DISPLAY, CONSOLAS }
