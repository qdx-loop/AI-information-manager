/**
 * v10 · Windows 11 Fluent 2 主题（microsoft/fluentui · Fluent UI React v9）
 *
 * 唯一设计系统来源：
 *   - 用 Fluent UI React v9 的 createLightTheme/createDarkTheme 生成官方 Theme；
 *   - 覆盖成 Windows 11 应用的中性色 / 强调色 / Segoe 字体 / Fluent 2 圆角与阴影；
 *   - 由 <FluentProvider theme={...}> 注入；同时把全部 token 映射为 <html> 上的
 *     CSS 变量（--colorNeutralBackground1 …），供布局 CSS / antd 门户（body 下）
 *     与自定义布局共同消费 —— 任何页面都不允许再定义独立色板。
 *
 * 参考：https://github.com/microsoft/fluentui  (packages/react-components)
 */
import {
  createDarkTheme,
  createLightTheme,
  type BrandVariants,
  type Theme,
} from '@fluentui/react-components'

/** Segoe UI Variable（Windows 系统字体）；非 Windows 回退 Selawik（度量兼容，自托管） */
export const SEGOE =
  "'Segoe UI Variable Text', 'Segoe UI Variable', 'Segoe UI', Selawik, -apple-system, BlinkMacSystemFont, 'Microsoft YaHei UI', 'PingFang SC', 'Noto Sans CJK SC', sans-serif"
export const SEGOE_DISPLAY =
  "'Segoe UI Variable Display', 'Segoe UI Variable', 'Segoe UI', Selawik, -apple-system, BlinkMacSystemFont, 'Microsoft YaHei UI', 'PingFang SC', 'Noto Sans CJK SC', sans-serif"
export const CONSOLAS =
  "'Cascadia Mono', 'Cascadia Code', Consolas, 'Courier New', 'Noto Sans Mono CJK SC', monospace"

/** Windows 11 强调蓝的 16 阶品牌色（Fluent BrandVariants；生成后仍会覆盖关键 brand token） */
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

/** 公共排版 / 圆角覆盖：Fluent 2 字体 + Windows 11 字体栈 */
function withCommonOverrides(base: Theme): Theme {
  return {
    ...base,
    fontFamilyBase: SEGOE,
    fontFamilyMonospace: CONSOLAS,
    fontFamilyNumeric: SEGOE_DISPLAY,
    fontSizeBase200: '12px',
    lineHeightBase200: '16px',
    fontSizeBase300: '14px',
    lineHeightBase300: '20px',
    fontSizeBase400: '16px',
    lineHeightBase400: '22px',
    fontSizeBase500: '20px',
    lineHeightBase500: '28px',
    fontSizeBase600: '24px',
    lineHeightBase600: '32px',
    borderRadiusMedium: '4px',
    borderRadiusLarge: '8px',
    borderRadiusXLarge: '8px',
    borderRadius2XLarge: '12px',
  }
}

/** 深色：Win11 深色应用（#202020 画布 / #2B2B2B 卡片 / #4CC2FF 强调 + 黑字） */
export const win11FluentDark: Theme = withCommonOverrides({
  ...createDarkTheme(windowsBrand),
  colorNeutralBackground1: '#2b2b2b',
  colorNeutralBackground1Hover: '#333333',
  colorNeutralBackground1Pressed: '#2e2e2e',
  colorNeutralBackground1Selected: '#3a3a3a',
  colorNeutralBackground2: '#202020',
  colorNeutralBackground2Hover: '#2a2a2a',
  colorNeutralBackground2Pressed: '#1b1b1b',
  colorNeutralBackground2Selected: '#2a2a2a',
  colorNeutralBackground3: '#1a1a1a',
  colorNeutralBackground3Hover: '#242424',
  colorNeutralBackground3Pressed: '#161616',
  colorNeutralBackground3Selected: '#242424',
  colorNeutralBackground4: '#141414',
  colorNeutralBackground5: '#0f0f0f',
  colorNeutralBackground6: '#3a3a3a',
  colorNeutralForeground1: '#ffffff',
  colorNeutralForeground2: '#d6d6d6',
  colorNeutralForeground3: '#a0a0a0',
  colorNeutralForeground4: '#8a8a8a',
  colorNeutralForeground5: '#7a7a7a',
  colorNeutralForegroundDisabled: '#6b6b6b',
  colorNeutralStroke1: '#5c5c5c',
  colorNeutralStroke1Hover: '#6e6e6e',
  colorNeutralStroke1Pressed: '#4a4a4a',
  colorNeutralStroke2: '#464646',
  colorNeutralStroke3: '#3a3a3a',
  colorNeutralStrokeAccessible: '#a0a0a0',
  colorSubtleBackgroundHover: '#333333',
  colorSubtleBackgroundPressed: '#2e2e2e',
  colorSubtleBackgroundSelected: '#383838',

  colorBrandBackground: '#4cc2ff',
  colorBrandBackgroundHover: '#6dd0ff',
  colorBrandBackgroundPressed: '#38a9df',
  colorBrandBackgroundSelected: '#38a9df',
  colorBrandBackground2: '#0a2a3f',
  colorBrandBackground2Hover: '#0e3550',
  colorBrandBackground2Pressed: '#123f5c',
  colorBrandForeground1: '#4cc2ff',
  colorBrandForeground2: '#6dd0ff',
  colorBrandForeground2Hover: '#8adcff',
  colorBrandForeground2Pressed: '#38a9df',
  colorBrandForegroundLink: '#4cc2ff',
  colorBrandForegroundLinkHover: '#6dd0ff',
  colorBrandForegroundLinkPressed: '#38a9df',
  colorBrandForegroundLinkSelected: '#38a9df',
  colorNeutralForegroundOnBrand: '#000000',
  colorStrokeFocus1: '#000000',
  colorStrokeFocus2: '#ffffff',
  // 危险文本在 #2b2b2b 卡片面上需 ≥4.5:1；Fluent 默认 #dc626d 只有 4.05
  colorStatusDangerForeground1: '#ff99a4',
  // 输入框聚焦下划线：默认 #2582ce 在深色画布上过暗，改用品牌前景色
  colorCompoundBrandStroke: '#4cc2ff',
  colorCompoundBrandStrokeHover: '#6dd0ff',
  colorCompoundBrandStrokePressed: '#38a9df',
})

/** 浅色：Win11 浅色应用（#F3F3F3 画布 / #FFFFFF 卡片 / #0067C0 强调 + 白字） */
export const win11FluentLight: Theme = withCommonOverrides({
  ...createLightTheme(windowsBrand),
  colorNeutralBackground1: '#ffffff',
  colorNeutralBackground1Hover: '#f5f5f5',
  colorNeutralBackground1Pressed: '#e8e8e8',
  colorNeutralBackground1Selected: '#ebebeb',
  colorNeutralBackground2: '#f3f3f3',
  colorNeutralBackground2Hover: '#ebebeb',
  colorNeutralBackground2Pressed: '#e0e0e0',
  colorNeutralBackground2Selected: '#ebebeb',
  colorNeutralBackground3: '#ededed',
  colorNeutralBackground3Hover: '#e5e5e5',
  colorNeutralBackground3Pressed: '#dcdcdc',
  colorNeutralBackground3Selected: '#e5e5e5',
  colorNeutralBackground4: '#f0f0f0',
  colorNeutralBackground5: '#ebebeb',
  colorNeutralBackground6: '#e6e6e6',
  colorNeutralForeground1: '#1b1b1b',
  colorNeutralForeground2: '#5c5c5c',
  colorNeutralForeground3: '#6e6e6e',
  colorNeutralForeground4: '#7a7a7a',
  colorNeutralForeground5: '#8a8a8a',
  colorNeutralForegroundDisabled: '#b0b0b0',
  colorNeutralStroke1: '#d1d1d1',
  colorNeutralStroke1Hover: '#bdbdbd',
  colorNeutralStroke1Pressed: '#a8a8a8',
  colorNeutralStroke2: '#e5e5e5',
  colorNeutralStroke3: '#f0f0f0',
  colorNeutralStrokeAccessible: '#6e6e6e',
  colorSubtleBackgroundHover: '#f5f5f5',
  colorSubtleBackgroundPressed: '#e8e8e8',
  colorSubtleBackgroundSelected: '#ebebeb',

  colorBrandBackground: '#0067c0',
  colorBrandBackgroundHover: '#0078d4',
  colorBrandBackgroundPressed: '#005a9e',
  colorBrandBackgroundSelected: '#005a9e',
  colorBrandBackground2: '#e5f1fa',
  colorBrandBackground2Hover: '#d4e8f7',
  colorBrandBackground2Pressed: '#c2dff5',
  colorBrandForeground1: '#0067c0',
  colorBrandForeground2: '#0078d4',
  colorBrandForeground2Hover: '#0067c0',
  colorBrandForeground2Pressed: '#005a9e',
  colorBrandForegroundLink: '#0067c0',
  colorBrandForegroundLinkHover: '#0078d4',
  colorBrandForegroundLinkPressed: '#005a9e',
  colorBrandForegroundLinkSelected: '#005a9e',
  colorNeutralForegroundOnBrand: '#ffffff',
  colorStrokeFocus1: '#ffffff',
  colorStrokeFocus2: '#000000',
  colorCompoundBrandStroke: '#0067c0',
  colorCompoundBrandStrokeHover: '#0078d4',
  colorCompoundBrandStrokePressed: '#005a9e',
})

/**
 * 把 Fluent theme 的全部字符串 token 映射为 <html> 上的 CSS 变量。
 * 目的：
 *   1. 布局 CSS 可直接消费 Fluent token（--colorNeutralBackground1 等）；
 *   2. antd 的 portal（挂在 body 下、在 FluentProvider 之外）也能拿到同一套变量；
 *   3. 主题切换时只换这一层变量，页面不用感知。
 */
export function applyFluentThemeVars(theme: Theme, el: HTMLElement): void {
  for (const [key, value] of Object.entries(theme)) {
    if (typeof value !== 'string') continue
    el.style.setProperty(`--${key}`, value)
  }
}

/** 当前模式对应的 Win11 Fluent theme */
export function fluentThemeOf(mode: 'light' | 'dark'): Theme {
  return mode === 'dark' ? win11FluentDark : win11FluentLight
}

/** 兼容旧导入名（v9 起 main.tsx 使用 fluentWindowsLight/Dark） */
export const fluentWindowsLight = win11FluentLight
export const fluentWindowsDark = win11FluentDark
