---
name: 信息管理 · AI 智能信息管理助手
description: 硬边印刷 SIGNAL PRESS——骨白纸面、纯黑硬边、荧光黄绿信号色、零圆角、硬投影、Outfit + Work Sans、Bento 栅格
colors:
  paper: "#ECE9E0"
  sheet: "#FFFEF9"
  panel: "#F5F2E8"
  ink: "#141412"
  ink-soft: "#57544B"
  ink-faint: "#676358"
  line: "#141412"
  line-soft: "#C9C4B5"
  lime: "#D4FF3F"
  lime-hover: "#C3EF2B"
  lime-wash: "#F4FFCE"
  signal: "#FF5A1F"
  danger: "#C22A1C"
  success: "#1B7A43"
  warning: "#8A5A00"
  dark-paper: "#101010"
  dark-sheet: "#181817"
  dark-ink: "#F5F3E9"
  dark-lime: "#D4FF3F"
typography:
  display:
    fontFamily: "Outfit, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif"
  body:
    fontFamily: "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif"
  mono:
    fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Mono', 'Roboto Mono', 'Noto Sans Mono CJK SC', Menlo, Consolas, monospace"
  scale:
    "2xs": "11 / 1.3 · mono 小标签"
    xs: "12 / 1.35"
    sm: "13 / 1.45"
    base: "15 / 1.6（正文）"
    md: "17 / 1.6"
    lg: "20 / 1.3 · 700（区块标题）"
    xl: "24 / 1.2 · 800（弹窗标题）"
    "2xl": "32 / 1.15 · 800（页面标题）"
    "3xl": "40 / 1.05 · 800"
    "4xl": "56 / 0.98 · 800（大数字）"
    "5xl": "72 / 0.95 · 800（Landing）"
rounded:
  r-0: "0px（默认，所有卡片/弹窗/按钮）"
  r-1: "2px（仅输入框/小标签）"
  pill: "999px（仅头像/状态点，极少用）"
spacing: "4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96"
borders:
  structural: "2px solid #141412"
  rule: "1px solid #C9C4B5"
shadows:
  shadow-1: "2px 2px 0 #141412（卡片/按钮）"
  shadow-2: "4px 4px 0 #141412（浮层/hover）"
  shadow-3: "8px 8px 0 #141412（弹窗/截图框）"
  shadow-press: "1px 1px 0 #141412（按压）"
components:
  card: "sheet + 2px ink + 0 圆角 + shadow-1 / hover translate(-2,-2)+shadow-2 / active translate(1,1)+press"
  button-primary: "lime 底 + ink 字 + 2px ink 边 + shadow-1；hover 位移 / active 压入"
  button-default: "sheet 底 + 2px ink 边 + shadow-1"
  table: "表头 ink 底 + on-ink mono 11 + 44 高；行 40；hover lime-wash；选中 lime-wash + 3px ink 左条"
  rail: "264px ink 底；lime 选中块；mono 分组；底部 AI/用户"
  topbar: "64px paper 底 + 2px ink 底边；mono 面包屑；方形搜索"
  modal: "sheet + 2px ink + shadow-3 + 0 圆角；标题 24/800；footer 顶部 2px ink"
  status-pill: "2px 圆角 + 1.5px ink 边 + 浅 wash + 6px 方块 + mono 10"
---

# Design System: 信息管理（info-manager）· 硬边印刷 SIGNAL PRESS

## Overview

**Creative North Star: 「硬边印刷」SIGNAL PRESS**

这是用 **ui-ux-pro-max skill** 全盘重设计的第四版：不再沿用 v1 青瓷、v2 官纸账簿、v3 石墨信号的任何视觉语言。skill 给出的方向是 **Brutalism + Bento Grid + Swiss 栅格**，字体配对 **Outfit + Work Sans**（OFL 自托管）。设计系统落盘在 `design-system/signal-press/MASTER.md`，实现合同在 `redesign-brief/06-v4-signal-press.md`。

核心不是「再换一套颜色」，而是换一套**物理语言**：

1. **纸面**：骨白 `#ECE9E0` 画布 + 纸白 `#FFFEF9` 面板；面板不是「浮起」，而是用 **2px 纯黑硬边 + 硬偏移投影** 明确压在纸面上。
2. **信号色**：荧光黄绿 `#D4FF3F` 只做底/线/块/选中/主按钮，**永不做小号正文**；橙色 `#FF5A1F` 只做焦点/提醒 ≥14px。全屏 accent 面积 ≤10%。
3. **字**：Outfit 800 承担标题与大数字（几何、紧凑、有海报感）；Work Sans 承担正文/表单/表格（可读性）；mono 只做 kicker、编号、ID、时间、快捷键。全站 0 衬线。
4. **版面**：12 列 Swiss 栅格 + Bento 非对称（7/5、4/4/4 等跨列）；所有页面有明确的 kicker → 标题 → 主体层级，没有「裸内容」。
5. **触感**：hover 抬起 2px、active 压入 1px，阴影随之变大/变小；无模糊、无渐变、无玻璃。

它是一款 Operate 型数据工具：硬边与高对比服务于扫读、录入、确认；海报式标题只出现在页面级（一屏一个），数据区域保持克制。

## Colors

### Light（对比度为实测）
| 角色 | 值 | 用途 | 对比 |
|---|---|---|---|
| paper | `#ECE9E0` | 页面画布 | — |
| sheet | `#FFFEF9` | 面板/表格/弹窗/输入 | — |
| panel | `#F5F2E8` | 表头/内嵌/次级底 | — |
| ink | `#141412` | 文字/结构边/墨面 | 15.19:1 on paper |
| ink-soft | `#57544B` | 次要文字 | 6.23:1 |
| ink-faint | `#676358` | 注脚/占位（≥12px） | 4.94:1 |
| line | `#141412` | 2px 结构边 | 15.19:1 |
| line-soft | `#C9C4B5` | 1px 行线/分隔 | 装饰性 |
| lime / hover / wash | `#D4FF3F` / `#C3EF2B` / `#F4FFCE` | 主按钮、选中、焦点底 | ink on lime 15.96:1 |
| signal | `#FF5A1F` | focus ring、提醒数字 | ink on signal 5.91:1 |
| danger / success / warning | `#C22A1C` / `#1B7A43` / `#8A5A00` | 语义 | white on danger 5.71:1；white on success 5.32:1 |

### Dark
paper `#101010`、sheet `#181817`、panel `#21211F`、ink `#F5F3E9`、ink-soft `#BDB9AC`、ink-faint `#938F83`、line `#F5F3E9`、line-soft `#3A3A33`、lime `#D4FF3F`（不变）、signal `#FF7A45`、danger `#FF6B5A`、success `#6BD39A`、warning `#F0B429`。暗色硬阴影不可见，结构由 2px 边承担；lime 只做块/边/文字，保持 ≥4.5:1。

### Charts
Okabe-Ito/Wong 色盲安全 5 色子集（与品牌色解耦）：`#0072B2 #009E73 #D55E00 #CC79A7 #4B4B45`（暗色 `#56A6DC #57C695 #E88552 #DE9ACB #C9C4B5`）。禁止只靠颜色传达状态（状态片必须带文字）。

## Typography

- **Outfit**（display，variable 100–900，latin 子集 32KB，OFL，`public/fonts/outfit-var.woff2`）：标题、大数字、按钮、导航、wordmark。
- **Work Sans**（body，variable 100–900，latin 子集 50KB，OFL，`public/fonts/work-sans-var.woff2`）：正文、表格、表单、AI 输出。
- **Mono**（系统栈）：kicker、编号、ID、日期、金额、快捷键、小标签。中文永不进等宽。
- 中文回退：PingFang SC → Hiragino Sans GB → Noto Sans CJK SC → Microsoft YaHei。
- 字阶 11/12/13/15/17/20/24/32/40/56/72；字重 400/500/600/700/800；标题 `letter-spacing: -0.03em`，kicker `+0.09em` 大写。
- 数字一律 `tabular-nums`；表格数字列右对齐。

## Layout

- 桌面：264px ink rail + 64px paper topbar + 可滚动画布；页面容器 `.workbench` max 1440 / padding 28–36。
- Bento：12 列，gap 16；大 tile 7 列 + 侧栏 5 列；指标行 4/4/4；移动端单列/双列。
- 表格：表头 44、行 40、单元格 9/12；数字右对齐。
- AI 停靠 400（340–720 可拖）；登录海报 5fr/6fr、表单卡 400；弹窗宽度 440/520/760/840。
- 手机：无 rail；topbar 64 + 底部 60px ink tab bar + 安全区；表格改横向滚动/卡片。

## Elevation & Depth

只有硬投影，无模糊：
- `--shadow-1: 2px 2px 0`：卡片、按钮、面板。
- `--shadow-2: 4px 4px 0`：hover、下拉、浮层、FAB。
- `--shadow-3: 8px 8px 0`：弹窗、截图框、登录卡。
- `--shadow-press: 1px 1px 0`：按下/小按钮。

hover `translate(-2px,-2px)` + 升一级阴影；active `translate(1px,1px)` + 降为 press；表格行不位移，只换 lime-wash 背景。

## Shapes

默认 **0 圆角**（卡片/按钮/弹窗/输入/标签）。只有输入框与小标签允许 2px；999px 仅头像/状态点。禁止任何 4px 以上圆角。

## Components

- **Button**：40 高（sm 32 / lg 48）、2px ink 边、600 字重、shadow-1；primary = lime 底 ink 字；default = sheet；text = ink-soft；danger = danger 底白字；disabled 42% 透明、无位移。
- **面板/卡片**：sheet + 2px ink + shadow-1；`panel-head` 用 paper 底 + 2px 底边；`tile--lime` / `tile--ink` 反相。
- **表格**：`.data-table` 容器；表头 ink 底 on-ink mono 11；行 40、hover lime-wash、选中 lime-wash + 3px ink 左条；数字右对齐；短值列给最小宽度、允许横向滚动。
- **状态**：`.status-pill`（2px 圆角 + 1.5px ink 边 + wash 底 + 6px 方块 + mono 10，必须带文字）。
- **表单**：输入/选择/日期 40 高、2px ink 边、focus 3px lime ring；标签 mono 11 大写；错误 12 danger 文案；禁用 42% 透明。
- **弹窗**：0 圆角、2px ink、shadow-3；标题区 paper 底 + 2px 底边 + Outfit 800 24；footer 顶部 2px ink、按钮右对齐。
- **Rail**：ink 底；lime 选中块；mono 分组；库项 34 高、active 左 3px lime；底部 AI 入口 + 用户 + 退出。
- **Topbar**：paper 底 + 2px ink 底边；mono 面包屑；方形搜索框；方形图标按钮。
- **AI**：ink 头 + 3px lime 底边；用户消息 lime-wash 硬边块；AI 输出无底色 15/1.65；输入 40 + lime 发送方块。
- **Landing**：海报式（`lp-display` 巨型字 + lime `<em>` 高亮 + 硬边截图 + lime marquee + 编号功能行 + 死黑 deep 段 + 巨型 lime wordmark）。
- **Motion**：80/140/220ms；bento 首现一次性 320–450ms stagger；reduced-motion 全关。

## Do's and Don'ts

### Do
- 先有版面：每页 kicker → 800 标题 → 主体，页面容器 `.workbench`，不要裸内容贴左。
- 用 2px ink 边 + 硬投影建立结构；用 Bento 跨列建立节奏。
- lime 只做信号块；数字一律 tabular；短值/金额/电话给最小宽度，宁可横向滚动也不截断。
- 所有交互有 hover/active/focus 三态；focus ring 用 3px signal。
- 保持 12 列栅格与 4 的倍数间距。

### Don't
- 不要渐变、玻璃拟态、柔和阴影、模糊、发光。
- 不要 >2px 圆角（头像/状态点除外）、不要药丸按钮、不要 1px 灰卡片。
- 不要衬线、不要 emoji、不要 Filled 图标（统一 Outlined）。
- 不要把 lime/signal 用作小号正文；不要只靠颜色表达状态。
- 不要为了视觉改业务逻辑/字段顺序/快捷键/校验。
