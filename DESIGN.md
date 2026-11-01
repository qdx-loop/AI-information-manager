---
name: 信息管理 · AI 智能信息管理助手
description: Windows 11 / Fluent 2——Mica 云母窗口、Bloom 壁纸、Segoe UI Variable、Fluent 分层阴影、12px 圆角、官方 Fluent System Icons
colors:
  bg: "#F3F3F3"
  mica: "rgba(243,243,243,0.82)"
  card: "rgba(255,255,255,0.78)"
  layer: "rgba(255,255,255,0.55)"
  surface: "#FFFFFF"
  surface-2: "#FAFAFA"
  border: "rgba(0,0,0,0.08)"
  border-strong: "rgba(0,0,0,0.16)"
  text: "#242424"
  text-secondary: "#616161"
  text-muted: "#707070"
  accent: "#0067C0"
  accent-hover: "#005A9E"
  accent-soft: "rgba(0,103,192,0.10)"
  accent-2: "#00B7C3"
  danger: "#C42B1C"
  success: "#0F7B0F"
  warning: "#9D5D00"
  dark-bg: "#202020"
  dark-mica: "rgba(32,32,32,0.86)"
  dark-card: "rgba(43,43,43,0.86)"
  dark-text: "#FFFFFF"
  dark-accent: "#60CDFF"
typography:
  display:
    fontFamily: "'Segoe UI Variable Display', 'Segoe UI Variable', 'Segoe UI', Selawik, -apple-system, BlinkMacSystemFont, 'Microsoft YaHei UI', 'PingFang SC', 'Noto Sans CJK SC', sans-serif"
  body:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI Variable', 'Segoe UI', Selawik, -apple-system, BlinkMacSystemFont, 'Microsoft YaHei UI', 'PingFang SC', 'Noto Sans CJK SC', sans-serif"
  mono:
    fontFamily: "'Cascadia Mono', 'Cascadia Code', Consolas, 'Courier New', monospace"
rounded:
  control: "4/8px（Fluent borderRadiusMedium/Large）"
  card: "12px（Fluent borderRadius2XLarge）"
  window: "12px"
  dialog: "12px"
  pill: "999px"
shadows:
  shadow2: "0 0 2px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.14)"
  shadow4: "0 0 2px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.14)"
  shadow8: "0 0 2px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.14)"
  shadow16: "0 0 2px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.14)"
  shadow28: "0 0 8px rgba(0,0,0,0.12), 0 14px 28px rgba(0,0,0,0.14)"
  shadow64: "0 0 8px rgba(0,0,0,0.12), 0 32px 64px rgba(0,0,0,0.14)"
---

# Design System: 信息管理 · Windows 11 / Fluent 2

## Overview

**Creative North Star：「Windows 11 原生质感」**

用户指定：检索 microsoft/fluentui React v9 最新规范，全面遵循，做成 Windows 11 现代高级质感（**Mica 云母、12px 圆角、细腻分层阴影、Segoe 语义图标**）。

实现方式：`@fluentui/react-components` v9 的 **FluentProvider**（官方 `createLightTheme/createDarkTheme`）+ `@fluentui/react-icons`（Fluent System Icons）；antd v5 继续承担复杂数据组件并通过 theme/CSS 映射到 Fluent tokens，避免双组件体系。视觉骨架来自 Windows 11 官方文档：Mica 基底、Mica Alt 指挥层、LayerFill 内容层、Card 层、Acrylic 浮层、Smoke 弹窗遮罩；elevation 1/2/8/16/32/128 对应 Fluent shadow2/4/8/16/28/64。

设计依据：`design-system/fluent-windows-11/MASTER.md`（Project Overrides）。实现合同：`redesign-brief/09-v7-fluent-win11.md`。

## 材质与层级（Windows 11 Mica）

- **桌面**：Windows 11 Bloom 风格壁纸（自生成 2560×1440，`public/win11-bloom-dark.jpg`）；body fixed cover。
- **应用窗口**：`inset:20px`、12px 圆角、1px 白色轮廓、Fluent shadow64；Mica = `rgba(243,243,243,.82)`（dark `.86`）+ `blur(64px) saturate(150%)`。
- **标题栏 / 导航窗格 / 命令栏**：Mica Alt（light 白 .34 / dark 白 .035–.04），1px 发丝分隔。
- **内容层**：LayerFillColorDefault（light 白 .55 / dark 白 .045）。
- **卡片**：Card 层（light 白 .78 / dark #2B2B2B .86）+ 1px 轮廓 + 12px 圆角 + Fluent shadow8（elevation 8）。
- **浮层**：Acrylic（blur 30 + 白 .86）+ shadow16/32；**对话框**：Mica 强层 + Smoke（黑 .35 + blur 4）+ shadow64；**窗口** shadow64。
- 原则：不重复叠材质（内容卡不用 backdrop-filter）；只有窗口 Mica 和 Acrylic 浮层用模糊。

## Colors（Fluent 2 / Windows 11）

- 60% 中性：`#FFFFFF` / `#FAFAFA` / `#F5F5F5` / `#F0F0F0`；30% 文本/轮廓：`#242424` / `#424242` / `#616161` / `#707070` / `#D1D1D1` / `#E0E0E0`；10% Windows 强调蓝 `#0067C0`（hover `#005A9E`）。
- 语义：danger `#C42B1C`、success `#0F7B0F`、warning `#9D5D00`；暗色对应 Fluent dark（`#60CDFF` 强调、`#FF99A4`/`#6CCB5F`/`#FCE100`）。
- 对比度：正文 ≥ 12:1（#242424 on white），次要 ≥ 7:1，弱 ≥ 4.8:1；深色正文 ≥ 12:1；状态不只靠颜色。

## Typography（Windows 11 type ramp）

- **Segoe UI Variable Display/Text**（Windows 11 系统字体）；非 Windows 平台回退 **Selawik**（OFL，Segoe 度量兼容，自托管 `public/fonts/selawik-*.woff`）；中文 Microsoft YaHei UI / PingFang SC / Noto Sans CJK。
- Ramp：caption 12/16、body 14/20、body strong 14/20 semibold、subtitle 20/28 semibold、title 28/36 semibold、title large 40/52、display 68/92；标题 semibold 600（不用 bold）；正文行长 50–60 字符；数字 tabular。
- 最小功能文字 12px regular / 14px semibold；装饰性 mono 标签 11–12px。

## Layout

- 桌面窗口化：20px 壁纸边、12px 圆角窗口；标题栏 40px + 命令栏 52px + 260px 导航窗格 + 内容层。
- 页面 `workbench` max 1400，24/28 间距；卡片 12px 圆角；8px 间距基准。
- Windows 11 选中态：3px 强调色左条 + 半透明底（导航/索引/表格选中）。
- 移动端：全屏 Mica；命令栏 52px + 固定 Acrylic 底栏 58px；卡片单列；工具栏横滚。

## Components

- **Button**：主 = Windows 强调蓝填充白字（dark 为 `#60CDFF` 黑字），radius 8，hover 深一阶；次 = 白 .55 + 1px 轮廓；文字 = 强调蓝；focus 双线（2px 文本色 + 4px surface）。
- **Card/Panel**：Card 层 + 12px 圆角 + Fluent shadow8；强调卡 = 强调色渐变 + 白字；深色简报卡 = #202020。
- **Table**：Card 层；表头 12px semibold（Sentence case）；行 40；正文 14；hover 白 .34；选中强调色软底 + 3px 左条；状态 pill 22。
- **Input/Select**：32px/radius 8、白 .55、1px 轮廓；focus 2px 强调色底边 + inset 线。
- **Modal**：Mica 强层 + 12px 圆角 + shadow64 + Smoke 遮罩；标题 20 semibold。
- **Flyout/Menu**：Acrylic blur 30、radius 8、shadow16/32；选中项 3px 强调条。
- **Shell**：标题栏（品牌标 + 名称 + 本地优先 + MICA 标签）；导航窗格（Mica Alt，Windows 11 选中条）；命令栏（面包屑/搜索/主题/语言/头像）。
- **AI**：Mica Alt 右侧可拖宽面板（react-resizable-panels），Fluent 命令头；移动端 Acrylic 底部抽屉。
- **Landing**：Acrylic nav + Mica hero 卡（真实 v7 截图在 Fluent 窗口框内）+ Mica 功能段 + 黑色数据主权卡 + Mica FAQ/CTA/联系 + 黑色 footer 巨型 Segoe wordmark。
- **Auth**：Windows 11 锁屏式：全屏 Bloom + 居中 Mica 卡（12 圆角 + shadow64）+ Segoe 标题 + Fluent 按钮；移动端单列。
- **Motion**：Fluent 曲线 150–250ms；页面转场 200ms fade + 4px；reduced-motion 终态。

## Do's and Don'ts

### Do
- 让壁纸/云母在窗口边缘和半透明层中透出；层级用 Mica / Mica Alt / Layer / Card / Acrylic 区分。
- 12px 圆角用于卡片、窗口、弹窗；控件 4/8；1px 轮廓线。
- 标题 semibold 600、正文 400、数字 tabular；一屏一个强调色 CTA。
- 所有交互有 hover/pressed/focus 三态；focus 双线；键盘可达。

### Don't
- 不要极光/毛玻璃内容卡、渐变霓虹、发光、0 圆角、2px 硬边、硬投影。
- 不要低于 12px 的功能文字；不要用 bold 代替 semibold。
- 不要在内容卡上重复应用 backdrop-filter（Mica 只做在窗口/浮层）。
- 不要为了视觉改业务逻辑/字段顺序/快捷键/校验。
