/**
 * 设计系统 · 主题层
 *
 * 调研结论（多家设计系统的共识）：
 * - Harmonic / NYSDS / SAP / VA.gov 都是**三层 token**：primitive（原始色阶）
 *   → semantic（语义角色）→ component（组件）。语义层用「角色」命名而不是
 *   「颜色」命名，这样换品牌色时不用改任何调用点。
 * - HPE 给了背景层次的正确顺序：back → default → front → floating，
 *   靠明度差做层级，而不是到处描边。
 * - MiHCM 的 60/30/10：60% 中性、30% 品牌、10% 强调色。用来自检
 *   「颜色是不是用过头了」。
 * - Fluent：品牌色不要铺在大面积表面上，否则会稀释层级、让界面难导航。
 *   —— 这正是我们把画布从薄荷色改成近中性冷灰的原因。
 *
 * 之前的问题（2026-09 重做）：
 *  antd 的 overrideToken 叠加在算法输出之上，所以旧代码里
 *  `colorBgLayout: '#F0FDFA'` 在暗色模式下依然生效，暗色页面出现浅薄荷画布，
 *  逼得 4 处硬编码 `#141414` 去盖。现在暗色不再继承任何亮色值。
 *
 * 本轮新增：**用 WCAG 对比度实测**修掉了亮色模式下 5 处不达标的配色。
 * 关键认知：一个 colorPrimary 不可能同时胜任「按钮填充底色」和「白底上的
 * 文字/链接」——前者要和白字有 4.5:1，后者要和白底有 4.5:1。所以品牌色
 * 必须拆成「填充用」和「文字用」两个值。
 */

import { theme, type ThemeConfig } from 'antd'

export type ThemeMode = 'light' | 'dark'

// ══════════════════════════════════════════════════════════════
// 第 1 层 · Primitive（原始色阶，与使用场景无关）
// ══════════════════════════════════════════════════════════════

/**
 * 青瓷（品牌釉色）色阶。同一色相，由浅到深。
 * 浅色模式下按钮/链接取 700（对白 5.47:1，对白底也是 5.47:1，两头都过 AA）；
 * 旧的 500（#0D9488）只有 3.74:1，白字压在上面不达标。
 */
const GLAZE = {
  50: '#F0FAF8',
  100: '#D6F0EB',
  200: '#AEE0D8',
  300: '#7BCDC1',
  400: '#3FB3A6',
  500: '#0D9488',
  600: '#0C8378',
  700: '#0F766E',
  800: '#115E57',
  900: '#134E48',
} as const

/** 窑火琥珀：只用于「需要注意」的三件事——行焦点、内容被改、临期提醒 */
const KILN = {
  100: '#FFF3E0',
  300: '#FCD9A0',
  500: '#FA8C16',
  600: '#C96A06',
  700: '#B45309',
  800: '#8A4207',
} as const

/** 危险：白字要 4.5:1，取 600 档 */
const DANGER = {
  500: '#E2503A',
  600: '#C5351F',
} as const

/** 中性冷灰（亮色）。50→900 由浅到深。 */
const NEUTRAL_L = {
  0: '#FFFFFF',
  25: '#FBFCFC',
  50: '#F5F7F8',
  100: '#EDF0F2',
  200: '#E3E8EC',
  300: '#D3D9DE',
  400: '#AEB6BE',
  500: '#8A94A0',
  600: '#66717E',
  700: '#4E5866',
  800: '#333B47',
  900: '#1F2328',
} as const

/**
 * 中性（暗色）。不用纯黑——纯黑配发光边缘很脏。
 * 亮暗两套的关键是「同一个中性色，亮色下编号越大越深，暗色下相反」，
 * 所以这里按角色重新编号而不是直接复用亮色阶。
 */
const NEUTRAL_D = {
  0: '#0E1113', // 画布 back
  25: '#141719', // 表面 default
  50: '#171A1D', // 卡片 front
  100: '#1B1F23', // 悬浮层 floating
  200: '#23282D', // 弱分隔
  300: '#2B3137', // 常规描边
  400: '#3A424A', // 强描边
  500: '#727C87', // 弱文字
  600: '#A3ACB6', // 次要文字
  700: '#E6E9EC', // 主要文字
} as const

/**
 * 图表分类色。数据工具的图表是核心输出，分类色必须彼此可辨、
 * 且在两种主题下都能读。首位是品牌色，保持视觉连续性。
 * 说明：分类色的可辨性靠色相间隔 + 明度错落，不靠同色系深浅。
 */
const SERIES_L = ['#0F766E', '#2F6FD0', '#C96A06', '#A63D9B', '#2E8B3D', '#6B4FD8', '#D14B4B', '#0E7490'] as const
const SERIES_D = ['#2DD4BF', '#7FB0F5', '#FBBF24', '#E79BE0', '#7BD48A', '#B4A2F0', '#FF8F8F', '#5BC8DC'] as const

// ══════════════════════════════════════════════════════════════
// 第 2 层 · Semantic（角色，亮/暗各一套）
// ══════════════════════════════════════════════════════════════

/** 亮色语义 */
const SEMANTIC_L = {
  surface: NEUTRAL_L[0], // 卡片、面板
  surfaceSunken: NEUTRAL_L[50], // 表头、内嵌区
  canvas: NEUTRAL_L[50], // 页面画布（back）
  overlay: 'rgba(28, 33, 38, 0.44)',

  ink: NEUTRAL_L[900],
  inkSoft: NEUTRAL_L[700],
  // 旧的 #8A94A0 只有 2.86:1，占位符/说明文字都读不清；700 档 4.62:1 达标
  inkFaint: NEUTRAL_L[600],

  border: NEUTRAL_L[300],
  borderSoft: NEUTRAL_L[200],

  // 品牌：填充用与文字用同值（700 对白 5.47:1 / 对白底 5.47:1）
  glaze: GLAZE[700],
  glazeText: GLAZE[700],
  glazeSoft: GLAZE[50],
  glazeSoftStrong: GLAZE[100],

  // 强调色：填充/指示用亮琥珀（配深字），作为文字必须用 700 档
  kiln: KILN[500],
  kilnText: KILN[700],
  kilnWash: KILN[100],
  kilnWashed: '#FFF8EC',

  success: '#3F7A21',
  danger: DANGER[600],
  dangerText: DANGER[600],

  series: SERIES_L,
} as const

/** 暗色语义 */
const SEMANTIC_D = {
  surface: NEUTRAL_D[50],
  surfaceSunken: NEUTRAL_D[100],
  canvas: NEUTRAL_D[0],
  overlay: 'rgba(0, 0, 0, 0.62)',

  ink: NEUTRAL_D[700],
  inkSoft: NEUTRAL_D[600],
  inkFaint: NEUTRAL_D[500],

  border: NEUTRAL_D[300],
  borderSoft: NEUTRAL_D[200],

  // 暗底上要更亮的釉色才能压住深底（对深底 10.18:1）
  glaze: GLAZE[300],
  glazeText: GLAZE[300],
  glazeSoft: 'rgba(45, 212, 191, 0.14)',
  glazeSoftStrong: 'rgba(45, 212, 191, 0.22)',

  kiln: KILN[300],
  kilnText: KILN[300],
  kilnWash: 'rgba(251, 191, 36, 0.12)',
  kilnWashed: 'rgba(251, 191, 36, 0.07)',

  success: '#6BBF4E',
  danger: '#F4785F',
  dangerText: '#F4785F',

  series: SERIES_D,
} as const

export type Semantic = typeof SEMANTIC_L

// ══════════════════════════════════════════════════════════════
// 第 3 层 · antd 组件 token
// ══════════════════════════════════════════════════════════════

const FONT_STACK =
  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif"

/** 与主题无关的基准 token */
const BASE = {
  borderRadius: 8,
  fontFamily: FONT_STACK,
  fontSize: 14,
  lineHeight: 1.6,
  wireframe: false,
  // 行内控件的基础高度。移动端靠 CSS 放大点击区（见 index.css 的 .tap）
  controlHeight: 34,
  motionDurationMid: '0.18s',
} as const

/** 亮色：近中性冷灰画布 + 纯白卡片 */
const LIGHT: ThemeConfig['token'] = {
  ...BASE,
  colorPrimary: SEMANTIC_L.glaze,
  colorInfo: SEMANTIC_L.glaze,
  // 链接是「白底上的文字」，必须用文字档
  colorLink: SEMANTIC_L.glazeText,
  colorLinkHover: GLAZE[600],
  colorSuccess: SEMANTIC_L.success,
  colorWarning: KILN[600],
  colorError: SEMANTIC_L.danger,
  colorBgLayout: SEMANTIC_L.canvas,
  colorBgContainer: SEMANTIC_L.surface,
  colorBgElevated: NEUTRAL_L[0],
  colorText: SEMANTIC_L.ink,
  colorTextSecondary: SEMANTIC_L.inkSoft,
  colorTextTertiary: SEMANTIC_L.inkFaint,
  colorBorder: SEMANTIC_L.border,
  colorBorderSecondary: SEMANTIC_L.borderSoft,
  colorFillQuaternary: 'rgba(15, 23, 42, 0.03)',
}

/** 暗色：暖中性深灰，不用纯黑（纯黑配发光边缘很脏） */
const DARK: ThemeConfig['token'] = {
  ...BASE,
  colorPrimary: SEMANTIC_D.glaze,
  colorInfo: SEMANTIC_D.glaze,
  colorLink: SEMANTIC_D.glazeText,
  colorLinkHover: GLAZE[200],
  colorSuccess: SEMANTIC_D.success,
  colorWarning: KILN[500],
  colorError: SEMANTIC_D.danger,
  colorBgLayout: SEMANTIC_D.canvas,
  colorBgContainer: SEMANTIC_D.surface,
  colorBgElevated: NEUTRAL_D[100],
  colorText: SEMANTIC_D.ink,
  colorTextSecondary: SEMANTIC_D.inkSoft,
  colorTextTertiary: SEMANTIC_D.inkFaint,
  colorBorder: SEMANTIC_D.border,
  colorBorderSecondary: SEMANTIC_D.borderSoft,
  colorFillQuaternary: 'rgba(255, 255, 255, 0.04)',
}

/**
 * 组件级覆盖。旧版一个都没有，结果是：卡片带阴影、菜单项挤成一团、
 * 表格头没有底色、行高在手机上偏矮。这里逐个收编。
 */
const COMPONENTS_LIGHT: ThemeConfig['components'] = {
  Layout: {
    headerBg: NEUTRAL_L[0],
    headerHeight: 52,
    headerPadding: '0 12px',
    bodyBg: SEMANTIC_L.canvas,
    siderBg: NEUTRAL_L[0],
    // antd 把侧边栏折叠条底色写死成 #002140（深色 Sider 专用），
    // 不跟主题走，暗色下会在侧边栏底部留下一块突兀的亮蓝。
    triggerBg: 'var(--app-surface)',
    triggerColor: 'var(--app-ink-faint)',
  },
  Card: {
    // 研究结论：「需要描边的话，多半是需要更多留白」——卡片默认不要阴影
    boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
    headerBg: 'transparent',
    headerFontSize: 15,
    bodyPadding: 16,
  },
  Table: {
    headerBg: NEUTRAL_L[50],
    headerColor: SEMANTIC_L.inkSoft,
    headerSplitColor: 'transparent',
    rowHoverBg: GLAZE[50],
    cellPaddingBlock: 11,
    cellPaddingInline: 12,
    borderColor: NEUTRAL_L[100],
    footerBg: 'transparent',
  },
  Menu: {
    itemHeight: 38,
    itemMarginInline: 8,
    itemBorderRadius: 8,
    itemSelectedBg: GLAZE[50],
    itemSelectedColor: GLAZE[700],
    itemHoverBg: NEUTRAL_L[25],
    iconSize: 15,
  },
  Button: {
    fontWeight: 500,
    primaryShadow: 'none',
    defaultShadow: 'none',
  },
  Input: { paddingBlock: 5 },
  Select: { optionSelectedBg: GLAZE[50] },
  Segmented: { itemSelectedBg: NEUTRAL_L[0], trackBg: NEUTRAL_L[100] },
  Tabs: { horizontalItemPadding: '10px 0' },
  Modal: { titleFontSize: 17 },
  Drawer: { paddingLG: 16 },
  Empty: { colorTextDescription: SEMANTIC_L.inkFaint },
  Statistic: { contentFontSize: 24 },
  Tooltip: { colorBgSpotlight: 'rgba(28, 33, 38, 0.94)' },
}

const COMPONENTS_DARK: ThemeConfig['components'] = {
  Layout: {
    headerBg: NEUTRAL_D[25],
    headerHeight: 52,
    headerPadding: '0 12px',
    bodyBg: SEMANTIC_D.canvas,
    siderBg: NEUTRAL_D[25],
    triggerBg: 'var(--app-surface)',
    triggerColor: 'var(--app-ink-faint)',
  },
  Card: {
    boxShadow: 'none',
    headerBg: 'transparent',
    headerFontSize: 15,
    bodyPadding: 16,
  },
  Table: {
    headerBg: NEUTRAL_D[100],
    headerColor: SEMANTIC_D.inkSoft,
    headerSplitColor: 'transparent',
    rowHoverBg: NEUTRAL_D[100],
    cellPaddingBlock: 12,
    cellPaddingInline: 12,
    borderColor: NEUTRAL_D[200],
    footerBg: 'transparent',
  },
  Menu: {
    itemHeight: 38,
    itemMarginInline: 8,
    itemBorderRadius: 8,
    itemSelectedBg: 'rgba(45, 212, 191, 0.14)',
    itemSelectedColor: GLAZE[300],
    itemHoverBg: 'rgba(255,255,255,0.05)',
    iconSize: 15,
  },
  Button: {
    fontWeight: 500,
    primaryShadow: 'none',
    defaultShadow: 'none',
  },
  Input: { paddingBlock: 5 },
  Select: { optionSelectedBg: 'rgba(45, 212, 191, 0.16)' },
  Segmented: { itemSelectedBg: NEUTRAL_D[100], trackBg: NEUTRAL_D[25] },
  Tabs: { horizontalItemPadding: '10px 0' },
  Modal: { titleFontSize: 17 },
  Drawer: { paddingLG: 16 },
  Empty: { colorTextDescription: SEMANTIC_D.inkFaint },
  Statistic: { contentFontSize: 24 },
  Tooltip: { colorBgSpotlight: 'rgba(48, 54, 60, 0.96)' },
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

export { GLAZE, KILN, DANGER, NEUTRAL_L, NEUTRAL_D, FONT_STACK }
export const BRAND = {
  glaze: { light: SEMANTIC_L.glaze, dark: SEMANTIC_D.glaze },
  kiln: { light: SEMANTIC_L.kiln, dark: SEMANTIC_D.kiln },
  fontStack: FONT_STACK,
}
