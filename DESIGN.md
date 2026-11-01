---
name: 信息管理 · Windows 11 原生应用
description: Windows 11 / Fluent 2 原生桌面质感——68px 图标导航、拖拽标题栏、Mica 窗口、Acrylic 面板、深色中性色、#4cc2ff 强调、无渐变
colors:
  bg: "#1F1F1F"
  bg-2: "#252525"
  surface: "#2B2B2B"
  surface-2: "#303030"
  text: "#FFFFFF"
  text-secondary: "#D6D6D6"
  text-muted: "#A0A0A0"
  border: "rgba(255,255,255,0.07)"
  border-strong: "rgba(255,255,255,0.12)"
  accent: "#4CC2FF"
  accent-2: "#3DAEE9"
  accent-3: "#5FB3FF"
  light-bg: "#F0F0F0"
  light-text: "#1F1F1F"
  light-accent: "#0067C0"
typography:
  display:
    fontFamily: "'Segoe UI Variable Display', 'Segoe UI Variable', 'Segoe UI', Selawik, -apple-system, BlinkMacSystemFont, 'Microsoft YaHei UI', 'PingFang SC', 'Noto Sans CJK SC', sans-serif"
  body:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI Variable', 'Segoe UI', Selawik, -apple-system, BlinkMacSystemFont, 'Microsoft YaHei UI', 'PingFang SC', 'Noto Sans CJK SC', sans-serif"
  mono:
    fontFamily: "'Cascadia Mono', 'Cascadia Code', Consolas, 'Courier New', monospace"
rounded:
  control: "8px"
  surface: "8px"
  window: "8px"
  dialog: "8px"
  pill: "999px"
materials:
  mica: "rgba(31,31,31,0.72) + blur(40px) saturate(130%)（窗口基底）"
  acrylic: "rgba(37,37,37,0.42) + blur(24px) saturate(125%)（导航/标题栏/浮层）"
  content-layer: "rgba(31,31,31,0.55)"
  content-card: "rgba(37,37,37,0.42) + 1px hairline + soft shadow"
---

# Design System: 信息管理 · Windows 11 Native

## Overview

**Creative North Star：「Windows 11 原生应用」**

严格遵循用户提供的《前端提示词》：**原生感 > 炫酷感；真实 Win11 风格 > 现代网页风格；克制、秩序、留白、玻璃质感 > 渐变/霓虹/科技风**。

视觉目标：看起来像 Windows 11 自带的「设置 / 文件资源管理器 / 计算器」，而不是网页套壳。反模式全部禁用：蓝紫渐变、大面积渐变、科技 HUD、霓虹高饱和、网页卡片式 Dashboard、Gemini/Web AI 风格。

## 外壳（native desktop shell）

- **左导航**：68px 图标窄栏（60–72 范围），Acrylic 材质；图标优先，文字只在 title hover 显示；库项显示首字母/语义图标；选中态为左侧 3px 强调条 + 微亮底。
- **标题栏**：40px 可拖拽标题栏（`-webkit-app-region: drag` + `data-tauri-drag-region`），左侧应用图标+名称，右侧原生搜索框 + 主题/语言/账户工具按钮；无网页导航栏。
- **窗口**：桌面壁纸 + 8px 圆角 Mica 窗口 + 1px 轮廓 + 柔和阴影；模拟无边框 Win11 窗口。
- **内容**：Mica 内容层 + Acrylic 面板；大留白、低密度、中央聚焦。

## 材料

- **Mica**：`rgba(31,31,31,.72)` 窗口 + `blur(40px) saturate(130%)`；浅色 `rgba(240,240,240,.70)`。
- **Acrylic**：导航栏/标题栏/弹层 `blur(24–30px) saturate(120–130%)` + 半透明 + 细噪点；用于瞬时/浮层/工具区。
- **Card 层**：Acrylic 半透明面板 + 1px 极淡边 + 软阴影；不使用网页大圆角/厚阴影。
- **Smoke**：对话框遮罩 = 黑色 .45 + blur(3px)。

## 色彩

- 深色主色：`#1F1F1F` / `#252525` / `#2B2B2B` / `#303030`；文字 `#FFFFFF` / `#D6D6D6` / `#A0A0A0`；轮廓 `rgba(255,255,255,.07/.12)`。
- 强调色只做 10%：`#4CC2FF`（深色主强调）、`#3DAEE9`、`#5FB3FF`；浅色主题用 `#0067C0` 保证对比度。
- 状态：danger `#FF99A4`、success `#6CCB5F`、warning `#FCE100`（深色）；浅色对应 Win11 语义色。
- 禁止：高饱和紫/蓝、粉紫渐变、蓝紫渐变背景、霓虹。

## 字体

- Segoe UI Variable Text/Display（Windows 系统字体）；非 Windows 回退 **Selawik**（OFL，Segoe 度量兼容，自托管）。
- 中文回退 Microsoft YaHei UI / PingFang SC / Noto Sans CJK。
- 字号：正文 14/20，标题 20/28–24/32，窗口标题 12/16；大标题最多 28/36；数字 tabular；正文行长 ≤ 60ch；无衬线、semibold 600 标题（Windows 使用 semibold）。
- 最小 12px regular / 14px semibold。

## 圆角 / 阴影 / 动效

- 圆角 8px（控件/面板/窗口/弹窗），pill 999；不使用旧版 12/20/28 大圆角体系。
- 阴影：`0 2px 8px rgba(0,0,0,.32)` 面板；`0 8px 24px` 浮层；`0 12px 40px` 对话框；轻、软、短，不使用大扩散彩色光。
- 动效：150–200ms、轻微 fade/brightness；无弹跳、无大位移；`prefers-reduced-motion` 关闭。

## 组件

- **Button**：高 32、圆角 8；主按钮 accent 填充 + 反色文字；次按钮半透明+细边；hover 轻微提亮；active 轻微下沉（scale .985）；focus 3px accent 环。
- **Search**：原生 Win11 搜索框：半透明、内阴影、圆角 8、低对比边框；标题栏内 `Ctrl K`。
- **List**：Win11 设置列表：行高 48，标题 14/20，副文 12，hover 提亮，分隔线极淡。
- **Table**：无卡片外壳；表头 12 semibold；行 48；横向分隔；hover 提亮；选中 accent 软底 + 3px 左条。
- **Modal**：Acrylic、8px 圆角、轻阴影、Smoke 遮罩；标题 18–20 semibold。
- **Dropdown/Flyout**：Acrylic、8px、32px 菜单项、hover 提亮。
- **Home**：Windows Start/Settings 混合：身份页头 + 「已固定」大图标磁贴（无卡片壳） + 「推荐/今天」列表 + 设置式快速行；禁止 KPI 大色块 Dashboard。
- **Landing/Auth**：Windows 11 应用产品页/锁屏式居中 Mica 卡；无营销大字报、无渐变、无装饰色块。
- **AI**：右侧 Acrylic 面板；Mica 底；无渐变 FAB（桌面入口固定在左侧导航）。
- **欢迎/赞赏码**：Acrylic 对话框 + 纯白 QR；文案/状态机不变。

## Do / Don't

### Do
- 保持桌面原生感：图标导航、标题栏、Mica/Acrylic、低饱和、大留白、设置式列表。
- 主色只用深中性色；强调色只做 CTA/选中/状态/图标。
- 所有交互有 hover / active / focus；键盘可达；reduced-motion。
- 窗口/浮层/内容分层清晰；不要把所有区域都做成卡片。

### Don't
- 不要渐变背景/渐变按钮/霓虹/蓝紫、不要科技 HUD、不要网页 Dashboard 卡片网格。
- 不要大圆角网页风格（>12px 的卡片壳）、不要厚阴影/彩色光。
- 不要低于 12px 的功能文字；不要用 emoji 图标。
- 不要为了视觉改业务逻辑/字段顺序/快捷键/校验。
