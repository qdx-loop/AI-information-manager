---
name: 信息管理 · AI 智能信息管理助手
description: 新星编务 NOVA EDITORIAL——近白画布、白卡细边、单一钴蓝强调、编辑式排版；Plus Jakarta Sans + Inter + 系统 mono
colors:
  bg: "#FAFAFA"
  surface: "#FFFFFF"
  surface-solid: "#FFFFFF"
  surface-2: "#F4F4F5"
  border: "#E4E4E7"
  border-strong: "#D4D4D8"
  text: "#09090B"
  text-secondary: "#52525B"
  text-muted: "#71717A"
  accent: "#2563EB"
  accent-hover: "#1D4ED8"
  accent-soft: "#EFF6FF"
  accent-2: "#0891B2"
  danger: "#DC2626"
  success: "#16A34A"
  warning: "#D97706"
  dark-bg: "#09090B"
  dark-surface: "#111113"
  dark-text: "#FAFAFA"
  dark-accent: "#60A5FA"
typography:
  display:
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif"
  mono:
    fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Mono', 'Roboto Mono', 'Noto Sans Mono CJK SC', Menlo, Consolas, monospace"
rounded:
  sm: "6px（小控件/图标按钮）"
  md: "8px（按钮/输入）"
  lg: "10px（卡片/表格容器）"
  xl: "12px（弹窗/浮层）"
  pill: "999px（状态/标签）"
shadows:
  shadow-1: "0 1px 2px rgba(9,9,11,.04)"
  shadow-2: "0 1px 3px rgba(9,9,11,.06), 0 8px 24px rgba(9,9,11,.08)"
  shadow-3: "0 24px 64px rgba(9,9,11,.16)"
---

# Design System: 信息管理 · 新星编务 NOVA EDITORIAL

## Overview

**Creative North Star：「新星编务」**

用户确认的方向：**C. 新星编务 Nova Editorial** —— shadcn/ui Nova 式现代商业编辑风，保留 antd，补齐现代库。核心不是装饰，而是**编务秩序**：近白画布、纯白卡片、1px 发丝边、单一钴蓝强调、近黑主按钮；用超大标题、编号、发丝分隔线、编辑式栅格把信息本身变成版式。上一轮 v5 的极光/磨砂玻璃全部移除；仅浮层保留轻玻璃作为功能性层次。

设计依据：`design-system/nova-editorial/MASTER.md`（skill 生成 + Project Overrides）。实现合同：`redesign-brief/08-v6-nova-editorial.md`。

## Colors

- 60% 近白/白：`#FAFAFA` 画布、`#FFFFFF` 卡面、`#F4F4F5` 次级块；30% 墨色文字/黑卡；10% 钴蓝 `#2563EB` 只用于链接、焦点环、图表、选中标记。
- 主按钮 ink `#09090B` 底白字；深色模式反转为白底黑字。
- 对比：正文 15:1、次要 7:1、弱 4.8:1；深色 ≥ 8:1；状态不只靠颜色（含圆点/文案）。
- 深色：bg `#09090B`、surface `#111113`、surface-2 `#18181B`、border `#27272A`、text `#FAFAFA`、accent `#60A5FA`。
- 图表：色盲安全 5 色 `#2563EB #0891B2 #D97706 #DB2777 #3F3F46`（dark `#60A5FA #22D3EE #FBBF24 #F472B6 #D4D4D8`）。

## Typography

- **Plus Jakarta Sans**：display/页面标题/大数字/按钮（自托管 variable）。
- **Inter**：正文/表格/表单/AI 输出（自托管 variable）。
- **系统 mono**：kicker、编号、日期、金额、快捷键；中文不进等宽。
- 字阶：display clamp(30–76) / H2 28–40 / 标题 22 / 正文 14–16 / 小字 12 / mono 10–11；标题 600–700、负字距；正文行高 1.5–1.7、行长 ≤ 68ch；数字 tabular。

## Layout

- 248px 固定白侧栏 + 56px 白顶栏 + `#FAFAFA` 内容；`workbench` max 1280，28/32 padding。
- 12 列/编辑式栅格：landing hero 7/5 分栏、功能行 3 段（编号/标题/说明）、深色段 3 段。
- 移动：无侧栏；56px 顶栏 + 固定白底 56px 底栏；卡片单列。
- 间距 8px 基准：4/8/12/16/24/32/48/64/72。

## Components

- **Button**：主 ink、次白底细边、文字钴蓝链接、危险红；radius 8；focus 3px 蓝环；无渐变/发光。
- **Card/Panel**：白底、1px `#E4E4E7`、radius 10、shadow-1；`tile--accent` 纯黑、`tile--dark` #18181B、`tile--soft` #F4F4F5。
- **Table**：白底；表头 #F4F4F5 + mono 11px；行 40；hover #F4F4F5；选中浅蓝 + 左侧 2px 蓝；状态 pill。
- **Input/Select**：40 高、radius 8、白底 1px 边、focus 蓝环。
- **Modal**：白底、radius 12、1px 边、shadow-3；标题 PJS 600 22；header/body/footer 用发丝线分区。
- **浮层**：Dropdown/Select/Command 用 rgba(255,255,255,.92)+blur(16) 轻玻璃；内容卡不透。
- **Shell**：白侧栏（选中：浅灰块 + 左侧 2px 墨条；库选中：浅蓝底蓝字；拖拽手柄 Grip）；白顶栏。
- **AI**：react-resizable-panels 右侧可拖宽白面板（min 20%，max 46%），1px 左边界；空态黑方标；不遮内容。
- **Landing**：白底 sticky 轻玻璃 nav；12 列编辑式 hero + 黑色截图卡；编号功能行；纯黑数据主权段；FAQ；黑底 footer + 巨型 wordmark；固定浅色。
- **Auth**：近白海报（细网格、超大标题、编号要点、mono meta）+ 右侧 400px 白卡；分段 tab；移动端单列。
- **欢迎/赞赏码**：白卡弹窗、QR 纯白卡面；文案/状态机不变。
- **Motion**：页面转场 220ms fade+4px；hover 150–200ms；reduced-motion 全关。

## Do's and Don'ts

### Do
- 用留白、字阶、发丝线建立层次；一屏只保留一个主 CTA（黑）。
- 所有卡片白底细边；强调色只做 10%；数字 tabular。
- 浮层可用轻玻璃；内容表面保持纸面清晰。
- 键盘 focus 必须可见；reduced-motion 必须尊重。

### Don't
- 不要极光/磨砂玻璃内容卡、渐变按钮、发光、荧光色、0 圆角、2px 硬边。
- 不要 10px 以下的中文正文；不要彩色大字报式堆叠。
- 不要为了视觉改业务逻辑/字段顺序/快捷键/校验。
