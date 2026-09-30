/**
 * 设计系统 · 主题层
 *
 * 之前的问题（2026-09 重做）：
 *  antd 的 overrideToken 是**叠加在**算法输出之上的，所以旧代码里
 *  `colorBgLayout: '#F0FDFA'`、`colorBorderSecondary: '#CCEBE6'`
 *  在暗色模式下依然被强制生效——暗色页面因此出现浅薄荷色画布和边框，
 *  逼得 AppShell / Sidebar / AIPanel 在 4 处硬编码 `#141414` 去盖。
 *
 * 现在改为：**基础 token + 每套主题各自的覆盖**，暗色不再继承任何亮色值。
 * 同时补上组件级 token 覆盖（之前一个都没有），让 antd 组件不再是默认值堆砌。
 *
 * 品牌保留：青瓷釉蓝绿仍是唯一的品牌色，出现在主按钮、选中态、链接、
 * 落地页与登录页的品牌区。画布改成近中性的冷灰，是为了让数据本身跳出来——
 * 研究一致指出「颜色是信号通道，安静的中性底色才能让数据被看清」。
 */

import { theme, type ThemeConfig } from 'antd'

export type ThemeMode = 'light' | 'dark'

/** 品牌釉色。两套主题各有取值：暗色需要更亮的釉色才能压住深底。 */
const GLAZE = {
  light: '#0D9488',
  dark: '#2DD4BF',
} as const

/** 窑火琥珀：只用于「需要注意」的三件事——行焦点、内容被改、临期提醒 */
const KILN = {
  light: '#FA8C16',
  dark: '#FBBF24',
} as const

const FONT_STACK =
  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif"

/** 与主题无关的基准 token */
const BASE = {
  borderRadius: 8,
  fontFamily: FONT_STACK,
  fontSize: 14,
  lineHeight: 1.6,
  wireframe: false,
  // 行内控件的基础高度。移动端靠 CSS 放大点击区（见 tokens.css 的 .tap）
  controlHeight: 34,
  motionDurationMid: '0.18s',
} as const

/** 亮色：近中性冷灰画布 + 纯白卡片 */
const LIGHT: ThemeConfig['token'] = {
  ...BASE,
  colorPrimary: GLAZE.light,
  colorInfo: GLAZE.light,
  colorLink: GLAZE.light,
  colorSuccess: '#3F8600',
  colorWarning: KILN.light,
  colorError: '#D4380D',
  // 画布：极浅冷灰，让白色卡片与数据浮起来
  colorBgLayout: '#F5F7F8',
  colorBgContainer: '#FFFFFF',
  colorBgElevated: '#FFFFFF',
  colorText: '#1F2328',
  colorTextSecondary: '#5B6470',
  colorTextTertiary: '#8A94A0',
  colorBorder: '#DDE3E8',
  colorBorderSecondary: '#E9EDF0',
  colorFillQuaternary: 'rgba(15, 23, 42, 0.03)',
}

/** 暗色：暖中性深灰，不用纯黑（纯黑配发光边缘很脏） */
const DARK: ThemeConfig['token'] = {
  ...BASE,
  colorPrimary: GLAZE.dark,
  colorInfo: GLAZE.dark,
  colorLink: GLAZE.dark,
  colorSuccess: '#5BAF3A',
  colorWarning: KILN.dark,
  colorError: '#F06A4B',
  colorBgLayout: '#0E1113',
  colorBgContainer: '#171A1D',
  colorBgElevated: '#1E2226',
  colorText: '#E6E9EC',
  colorTextSecondary: '#A3ACB6',
  colorTextTertiary: '#727C87',
  colorBorder: '#2B3137',
  colorBorderSecondary: '#23282D',
  colorFillQuaternary: 'rgba(255, 255, 255, 0.04)',
}

/**
 * 组件级覆盖。旧版一个都没有，结果是：卡片带阴影、菜单项挤成一团、
 * 表格头没有底色、行高在手机上偏矮。这里逐个收编。
 */
const COMPONENTS_LIGHT: ThemeConfig['components'] = {
  Layout: {
    headerBg: '#FFFFFF',
    headerHeight: 56,
    headerPadding: '0 16px',
    bodyBg: '#F5F7F8',
    siderBg: '#FFFFFF',
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
    headerBg: '#F7F9FA',
    headerColor: '#5B6470',
    headerSplitColor: 'transparent',
    rowHoverBg: '#F2F8F7',
    cellPaddingBlock: 11,
    cellPaddingInline: 12,
    borderColor: '#EDF0F2',
    footerBg: 'transparent',
  },
  Menu: {
    itemHeight: 38,
    itemMarginInline: 8,
    itemBorderRadius: 8,
    itemSelectedBg: '#E6F4F1',
    itemSelectedColor: GLAZE.light,
    itemHoverBg: '#F2F5F6',
    iconSize: 15,
  },
  Button: {
    fontWeight: 500,
    primaryShadow: 'none',
    defaultShadow: 'none',
  },
  Input: { paddingBlock: 5 },
  Select: { optionSelectedBg: '#E6F4F1' },
  Segmented: { itemSelectedBg: '#FFFFFF', trackBg: '#EEF1F3' },
  Tabs: { horizontalItemPadding: '10px 0' },
  Modal: { titleFontSize: 17 },
  Drawer: { paddingLG: 16 },
  Empty: { colorTextDescription: '#8A94A0' },
  Statistic: { contentFontSize: 24 },
  Tooltip: { colorBgSpotlight: 'rgba(28, 33, 38, 0.94)' },
}

const COMPONENTS_DARK: ThemeConfig['components'] = {
  Layout: {
    headerBg: '#141719',
    headerHeight: 56,
    headerPadding: '0 16px',
    bodyBg: '#0E1113',
    siderBg: '#141719',
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
    headerBg: '#1B1F23',
    headerColor: '#A3ACB6',
    headerSplitColor: 'transparent',
    rowHoverBg: '#1C2124',
    cellPaddingBlock: 12,
    cellPaddingInline: 12,
    borderColor: '#22272C',
    footerBg: 'transparent',
  },
  Menu: {
    itemHeight: 38,
    itemMarginInline: 8,
    itemBorderRadius: 8,
    itemSelectedBg: 'rgba(45, 212, 191, 0.14)',
    itemSelectedColor: GLAZE.dark,
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
  Segmented: { itemSelectedBg: '#262B30', trackBg: '#1B1F23' },
  Tabs: { horizontalItemPadding: '10px 0' },
  Modal: { titleFontSize: 17 },
  Drawer: { paddingLG: 16 },
  Empty: { colorTextDescription: '#727C87' },
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

/** 供 CSS 侧使用的品牌色，与 antd token 保持同源 */
export const BRAND = { glaze: GLAZE, kiln: KILN, fontStack: FONT_STACK }
