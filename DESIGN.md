---
name: 信息管理 · AI 智能信息管理助手
description: 流光玻璃 LUMINOUS GLASS——极光渐变画布、磨砂玻璃层、柔和光影、靛紫渐变品牌、Plus Jakarta Sans + Inter
colors:
  bg: "#EEF1F8"
  surface: "rgba(255,255,255,0.58)"
  surface-solid: "#FFFFFF"
  surface-2: "rgba(255,255,255,0.36)"
  glass-border: "rgba(255,255,255,0.72)"
  text: "#0B1220"
  text-secondary: "#475569"
  text-muted: "#64748B"
  accent: "#5B5BF7"
  accent-soft: "rgba(99,102,241,0.12)"
  accent-2: "#06B6D4"
  accent-gradient: "linear-gradient(135deg,#6366F1 0%,#8B5CF6 55%,#22D3EE 100%)"
  danger: "#DC2626"
  success: "#059669"
  warning: "#D97706"
  dark-bg: "#060913"
  dark-surface: "rgba(255,255,255,0.075)"
  dark-text: "#F1F5F9"
  dark-accent: "#818CF8"
typography:
  display:
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif"
  mono:
    fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Mono', 'Roboto Mono', 'Noto Sans Mono CJK SC', Menlo, Consolas, monospace"
  scale:
    "2xs": "11/1.3 mono 标签"
    xs: "12/1.4"
    sm: "13/1.45"
    base: "14/1.55（UI）"
    md: "15/1.65（正文/AI）"
    lg: "16/1.5"
    xl: "18/1.4"
    "2xl": "22/1.3 · 700（弹窗/区块标题）"
    "3xl": "28/1.2 · 700（页面标题）"
    "4xl": "36/1.12 · 700（大数字/页面主标）"
    "5xl": "48/1.05 · 700"
    "6xl": "64/1 · 700（Landing/wordmark）"
rounded:
  sm: "12px（按钮/输入/小卡）"
  md: "16px（浮层/次级面板）"
  lg: "20px（卡片/表格容器）"
  xl: "28px（外壳 rail/海报/大面板）"
  pill: "999px（胶囊按钮/标签/底栏）"
shadows:
  shadow-1: "0 2px 8px rgba(15,23,42,.06), 0 12px 32px rgba(15,23,42,.08)"
  shadow-2: "0 8px 24px rgba(15,23,42,.10), 0 24px 64px rgba(15,23,42,.12)"
  shadow-3: "0 24px 80px rgba(15,23,42,.20)"
  glow: "0 18px 50px rgba(99,102,241,.28)"
glass:
  surface: "rgba(255,255,255,.58) + backdrop-filter blur(28px) saturate(160%)"
  border: "1px solid rgba(255,255,255,.72) + inset 0 1px 0 rgba(255,255,255,.55)"
  strong: "blur(40px) + 更高不透明度（弹窗）"
---

# Design System: 信息管理（info-manager）· 流光玻璃 LUMINOUS GLASS

## Overview

**Creative North Star: 「流光玻璃」**

用户最终要求：**商业高级感 + 毛玻璃**。本轮（v5）用 ui-ux-pro-max skill 的 **Liquid Glass / Glassmorphism** 方向重做：页面不是白卡堆在灰底上，而是「一层柔光极光背景 + 多层磨砂玻璃」。光在玻璃后面流动，卡片半透明、有厚度、有内高光；主按钮与品牌字是靛紫渐变并带柔光；标题用 Plus Jakarta Sans，正文用 Inter；动效轻缓。目标气质：Apple visionOS / Stripe / Arc / Raycast 的「贵而克制」。

与上一轮的关系：信息架构与功能保留（无新手任务、注册后首屏赞赏码），视觉语言彻底替换——删除 0 圆角、2px 黑边、硬投影、荧光黄绿。

设计依据：`design-system/luminous-glass/MASTER.md`（Style = Liquid Glass）；实现合同：`redesign-brief/07-v5-luminous-glass.md`。

## Colors

### Light
| 角色 | 值 | 用途 |
|---|---|---|
| bg | `#EEF1F8` | 画布（其上叠加极光光球） |
| surface | `rgba(255,255,255,.58)` | 玻璃面板（blur 28px） |
| surface-solid | `#FFFFFF` | 需要实底的内容（QR/输入 focus） |
| surface-2 | `rgba(255,255,255,.36)` | 次级玻璃/输入底 |
| glass-border | `rgba(255,255,255,.72)` | 玻璃 1px 高光边 |
| border / border-strong | `rgba(15,23,42,.08)` / `rgba(15,23,42,.14)` | 分隔线 / 控件边 |
| text / secondary / muted | `#0B1220` / `#475569` / `#64748B` | 15:1 / 7:1 / 4.8:1 |
| accent | `#5B5BF7` | 主色（选中/链接/焦点） |
| accent-2 | `#06B6D4` | 青色辅助（深底数字/图表/渐变第二色） |
| accent-gradient | `#6366F1 → #8B5CF6 → #22D3EE` | 主按钮/品牌/高亮词/渐变边框 |
| danger / success / warning | `#DC2626` / `#059669` / `#D97706` | 语义（soft 底 10–12%） |

### Dark
bg `#060913`、surface `rgba(255,255,255,.075)`、surface-2 `rgba(255,255,255,.04)`、glass-border `rgba(255,255,255,.18)`、text `#F1F5F9`、secondary `#CBD5E1`、muted `#94A3B8`、accent `#818CF8`、accent-2 `#22D3EE`、danger `#F87171`、success `#34D399`、warning `#FBBF24`。深底上的数字用 accent-2，正文用 on-dark。

### 极光
3 层径向光球（靛蓝 46% / 青 34% / 粉 26%，light；dark 降为 40/24/18%）+ 80px 模糊 + 3.5% SVG 噪点 + 28s 缓慢漂移（reduced-motion 停）。所有玻璃面板必须透出极光，禁止纯平色背景。

### Charts
Okabe-Ito/Wong 色盲安全 5 色子集：`#4F46E5 #0891B2 #D97706 #DB2777 #334155`（暗色 `#818CF8 #22D3EE #FBBF24 #F472B6 #CBD5E1`）。

## Typography

- **Plus Jakarta Sans**（display/UI，自托管 variable，OFL，`public/fonts/plus-jakarta-sans-var.woff2`）：标题、大数字、按钮、导航、品牌。
- **Inter**（body，自托管 variable，OFL，`public/fonts/inter-var.woff2`）：正文、表格、表单、AI 输出。
- **Mono**（系统栈）：kicker、编号、日期、金额、快捷键；中文不进等宽。
- 中文回退：PingFang SC → Hiragino Sans GB → Noto Sans CJK SC → Microsoft YaHei。
- 字阶 11/12/13/14/15/16/18/22/28/36/48/64；标题 700，UI 500–600，正文 400；标题 `-0.02~-0.045em`；数字 tabular。

## Layout

- 应用：极光画布 + 悬浮玻璃 rail（264px，14px 外边距，28 圆角）+ 悬浮玻璃 topbar（56px，16 圆角）+ 画布内玻璃面板；AI 打开时右侧悬浮玻璃面板 400px。
- 页面容器 `.workbench` max 1440、padding 24/32。
- 卡片 20 圆角；弹窗 28 圆角；按钮/输入 12 圆角。
- 移动：无 rail；玻璃 topbar + 浮动玻璃胶囊底栏（58px + 安全区）；卡片单列。
- 表格：玻璃容器，表头半透明高光，行 44，悬停 accent-soft，数字右对齐。

## Elevation & Depth

只有「柔和扩散 + 内高光」，无硬投影：
- `--shadow-1`：卡片（2 层柔和阴影 + inset 顶部高光）。
- `--shadow-2`：悬浮/下拉/rail/topbar。
- `--shadow-3`：弹窗/登录卡。
- `--shadow-glow`：渐变按钮/品牌/空态图标的靛紫光晕。

玻璃层级：普通 `.glass`（blur 28）→ 强 `.glass-strong`（blur 40，弹窗/浮层）→ 深玻璃 `.glass-dark`（深色文字反白）。

## Shapes

12 / 16 / 20 / 28 + 胶囊 999。默认卡片 20、输入/按钮 12、rail/海报/大弹窗 28、标签/状态/底栏胶囊。

## Components

- **按钮**：主按钮靛紫渐变白字 + 光晕 + 内高光；hover 提亮/上浮 1px，active scale(.985)；次按钮玻璃白 + 高光边；文字按钮 accent；危险红渐变。
- **卡片/面板**：玻璃（白 58% + blur 28 + 1px 白高光边 + 内高光 + 柔和阴影）；大指标卡用品牌渐变（`.tile--accent`）；深色简报卡 `.tile--dark` 上的数字用 accent-2。
- **输入**：40 高、12 圆角、玻璃白、focus 白底 + 4px accent-soft 环。
- **表格**：玻璃容器；表头半透明；行 44；hover/选中 accent-soft；状态 pill 胶囊 soft 底 + 圆点。
- **弹窗**：blur 40 玻璃强、28 圆角、PJS 700 标题、遮罩模糊。
- **侧栏**：玻璃 rail；品牌渐变方块；选中项 accent-soft 玻璃 + accent 字；AI 入口 accent-soft。
- **AI**：悬浮玻璃面板；渐变 AI 徽标；用户消息 accent-soft 玻璃块；AI 输出无底色；输入玻璃胶囊。
- **Landing**：极光 hero + 玻璃胶囊 nav；标题关键词用渐变文字（background-clip:text），不是色块；玻璃截图卡 + 背后光晕；功能行 hover 玻璃；深色段与页脚是深玻璃大圆角面板；巨大渐变 wordmark。
- **Landing 固定浅色**：公开页不跟随系统暗色。
- **Auth**：极光 + 左侧玻璃海报（渐变标题字）+ 右侧玻璃卡；移动端单列。
- **欢迎页**：玻璃弹窗 24–28 圆角 + 白色 QR 卡 + 渐变按钮；文案/状态机不变。
- **动效**：hover 180–240ms；弹层 240–320ms；bento 首现 450ms stagger；极光 28s；reduced-motion 全关。

## Do's and Don'ts

### Do
- 每页必须有「有表面」的玻璃容器；内容放在 `.workbench` 与卡片中。
- 背景永远有色彩/光，玻璃后面必须有东西可透；面板不得纯白平底。
- 一个视口只用一个渐变主 CTA；标题 700，正文 400/500。
- 所有交互有 hover/active/focus 三态；focus ring 用 4px accent-soft。
- 数字 tabular、表格数字右对齐；短值列给最小宽度，宁可横滚不截断。

### Don't
- 不要硬边、0 圆角、硬偏移投影、荧光黄绿、纯平灰底。
- 不要把所有面板做成同一透明度；用 glass / glass-strong / glass-dark 分层。
- 不要玻璃上放低对比文字（浅色模式白字、暗色模式深字）。
- 不要衬线、emoji、Filled 图标；不要网络字体 CDN。
- 不要为了视觉改业务逻辑/字段顺序/快捷键/校验。
