---
name: 信息管理 · AI 智能信息管理助手
description: 官纸账簿 The Ledger——暖纸、墨字、朱砂标记、账线；衬线标题、无衬线 UI、等宽数字
colors:
  canvas: "#F7F4ED"
  surface: "#FDFBF6"
  surface-sunken: "#EFEBE1"
  ink: "#1C1B18"
  ink-soft: "#4A463D"
  ink-faint: "#6E6759"
  border: "#D9D3C5"
  border-strong: "#B9B0A0"
  rule: "#E6E1D5"
  accent: "#A63D2C"
  accent-text: "#8C3325"
  accent-wash: "#F6E7E1"
  action: "#26241F"
  danger: "#A82A1F"
  success: "#3F6B4A"
  warning: "#8A5A22"
  dark-canvas: "#141310"
  dark-surface: "#1B1917"
  dark-ink: "#E8E4DA"
  dark-accent: "#E0785F"
typography:
  sans:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Source Han Sans SC', Roboto, sans-serif"
  serif:
    fontFamily: "'Noto Serif CJK SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', 'Noto Serif SC', serif"
  mono:
    fontFamily: "'Noto Sans Mono CJK SC', ui-monospace, 'SF Mono', 'Cascadia Mono', Roboto Mono, Menlo, Consolas, monospace"
  scale:
    "2xs": "11px / 1.4 (mono +0.06em: 眉题、表头、快捷键)"
    xs: "12px / 1.5 (辅助说明、时间戳、图注)"
    sm: "13px / 1.5 (表格、侧栏、密集 UI)"
    base: "14px / 1.6 (正文、表单)"
    md: "16px / 1.75 (阅读区、AI 输出、编辑器正文)"
    lg: "20px / 1.4 (区块标题、弹窗标题、空状态主句，serif 600)"
    xl: "26px / 1.3 (页面标题，serif 600，每页仅一个)"
    "2xl": "34px / 1.2 (大数字、登录主标，serif 600)"
rounded:
  flat: "0 (表格、账页、分割线)"
  sm: "2px (输入框、单元格编辑态、Tag)"
  md: "4px (按钮、卡片、菜单项)"
  lg: "6px (弹窗、抽屉)"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "7": "32px"
  "8": "48px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "#F7F4ED"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.md}"
  table-header:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink-faint}"
    borderBottom: "1px solid {colors.border-strong}"
  row-selected:
    backgroundColor: "{colors.accent-wash}"
    boxShadow: "inset 2px 0 0 {colors.accent}"
  focus:
    outline: "2px solid {colors.accent}"
---

# Design System: 信息管理（info-manager）· 官纸账簿 The Ledger

## Overview

**Creative North Star: 「官纸账簿」**

这个产品本质是一本账：管理库是账本、条目是一笔记录、字段是账栏、导入导出是过账。AI 不是「助手」，是**书记员（录事）**——把口述变成条目、把账目核对出来，写完在边上留一行朱批。整套视觉因此从「青瓷工作台」的冷白 SaaS 语汇，换成暖纸底、墨字、朱砂标记与账线。

它仍然是典型的 Operate 型产品：用户每天在这里录数据、查数据、跟 AI 对话，扫读效率与状态可预期高于一切表达欲。所以「账簿」只做气质，不做装饰：**没有纸纹理、没有做旧噪点、没有渐变**；纸感只来自色温，账感只来自 1px 横线。

**Key Characteristics**
- 一屏最多两种色相：墨（动作/正文）+ 朱砂（标记）；彩度面积 ≤3%
- 无卡片阴影、无渐变、无玻璃拟态、无 emoji 图标、无无限动画
- 衬线只做 ≥20px 中文标题；无衬线做 UI；等宽做数字/日期/ID
- 表格是账页：只有横线、无竖线、无斑马、数字右对齐、表头冻结

## Colors

一句话：**墨是动作，朱是标记，纸是底。**

### Primary / Action（墨）
- `action` `#26241F`：主按钮、选中文字、标题。白字对比 15.50:1。
- `ink` `#1C1B18` / `ink-soft` `#4A463D` / `ink-faint` `#6E6759`：正文 15.68:1、次要 8.56:1、注脚 5.10:1（对 canvas，WCAG 实测）。
- 暗色反相：`action` 变 `#E8E4DA`（亮底深字），墨阶整体反转为暖浅灰。

### Accent（朱砂）
- `accent` `#A63D2C`：印章、选中标记、焦点环、AI 批注立线、当前项左线。**只做标记，不做按钮底色。**
- `accent-text` `#8C3325`：朱砂当文字/链接时用（7.31:1）。
- `accent-wash` `#F6E7E1`：选中行/提示的浅底，单屏面积 ≤8%。

### Neutral（纸）
- `canvas` `#F7F4ED`：页面底。
- `surface` `#FDFBF6`：卡片、侧栏、面板。
- `surface-sunken` `#EFEBE1`：表头、内嵌区、输入框聚焦前底。
- `surface-raised` `#FFFDF9`：浮层（下拉/弹窗/AI 抽屉）。
- 线：`border` `#D9D3C5`（输入框）、`border-strong` `#B9B0A0`（表头底线）、`rule` `#E6E1D5`（表格行线）。

### Status
- `success` `#3F6B4A`（完成）、`warning` `#8A5A22` + `warning-wash` `#F6EDDE`（临期）、`danger` `#A82A1F` + `danger-wash` `#F7E4E1`（删除/错误）。
- 状态一律「文字 + 6px 方点」表达，不用彩色胶囊 Tag。

### Charts
Okabe-Ito/Wong 色盲安全 5 色子集（`#009E73 #0072B2 #D55E00 #CC79A7 #1A1A1A`，暗色第 5 色换 `#B4BCC6`）。已验证正常视觉/绿色盲/红色盲下无危险色对，**不要改动**。

### Named Rules
**The Two-Ink Rule.** 全站只有两种「墨」：墨黑负责动作，朱砂负责标记。出现第三种色相即视为 bug（图表与状态色除外）。
**The 3% Rule.** 朱砂在任何一屏的面积不超过 3%——它是印章，不是主题色。
**朱砂不是危险色.** 朱砂（低彩偏褐）只做标记；危险（高彩）只做破坏性操作，且必须同时有图标、文字说明与二次确认。

## Typography

**Sans** 系统中文链做 UI；**Serif** 只做 ≥20px 标题/大数字/空状态主句（系统宋体链，Windows SimSun 无真 bold → `font-synthesis-weight:none`，缺字重时降级为无衬线而不是伪粗体）；**Mono** 只做数字/日期/ID/编号/快捷键（中文正文绝不用等宽）。

- 中文正文 `letter-spacing: 0`；标题最多 `-0.01em`；拉丁大写眉题 `+0.06em`。
- 所有数值 `font-variant-numeric: tabular-nums`；金额/数量列右对齐；日期统一 `YYYY-MM-DD`。
- 字阶只有 8 档：11 / 12 / 13 / 14 / 16 / 20 / 26 / 34。

### Named Rules
**The Serif-at-20 Rule.** 衬线字号不得小于 20px。
**The Mono-for-Numbers Rule.** 数字、日期、ID、快捷键必须等宽 + tabular；中文不得进等宽。

## Layout

- 桌面：左 220px 侧栏（可折叠）+ 44px 页眉 + 内容区；页面内边距 `24px 32px`。
- 平板：`20px 24px`；手机：`16px`，底部 48px 标签栏 + 安全区。
- 表格行高 32（紧凑 28 / 舒适 40）；表头 36；控件高 32（small 28）。
- AI 停靠列默认 380px（340–720 可拖）；移动端底部抽屉，圆角 6。

## Elevation & Depth

扁平纸面。深度只来自：① 纸与凹陷纸的明度差；② 1px 线（`rule` / `border` / `border-strong`）；③ 浮层的唯一阴影 `--shadow-pop`。**卡片、按钮、表格行、输入框一律零阴影**；hover 不加位移。

## Shapes

表格/账页 0 圆角；输入框/单元格 2；按钮/卡片/菜单项 4；弹窗/抽屉 6。**禁止 999px 药丸与 >6px 圆角**（头像 50% 除外）。状态标签不用胶囊。

## Components

- **Buttons**：主按钮墨色实心（暗色反相）；次按钮白底 + 1px 线；文字按钮只用于低权重操作；危险操作 `danger` 实心 + 文案写清后果。
- **Tables**：表头 sunken + 11px 字 + 0.04em 字距；只有横线；数字右对齐；置顶用朱砂★；选中行 `accent-wash` + 2px 朱砂左条；内联编辑 hover 虚线、编辑中 2px 朱砂 inset。
- **Cards**：默认不用卡片；需要成组时用 `sheet`（surface + 1px 线 + 0 圆角 + 0 阴影）。信息条不用色块 Alert，改成「2px 左线 + 正文」。
- **Inputs**：32px 高、2px 圆角、1px 线；聚焦边框变墨；错误用危险色边框 + 文字说明。
- **Tabs**：只用下划线（墨色 2px），不铺底色；移动端设置页保留 Tabs，桌面改为左侧垂直目录（当前项 2px 朱砂左线）。
- **Chat (AI)**：没有气泡。用户输入 = 左侧 2px 朱砂立线 + 14px 墨字；AI 输出 = 16/1.75 文档流；执行步骤折叠为「已核对 N 步」+ mono 编号；运行中 = 12px 文字 + 2px 静态朱砂短条。
- **Mobile tab bar**：48px；选中 = 朱砂文字 + 顶部 2px 朱砂短线；无胶囊底、无投影。
- **Landing**：editorial 账页排版；hero 左对齐非对称；深色段是唯一节奏断口；产品截图放 hairline 展柜里；按钮墨色/ghost。

## Do's and Don'ts

### Do
- 先铺纸与墨，最后点朱砂；新界面先问「这里需要标记吗」。
- 数字右对齐、等宽、tabular；日期 `YYYY-MM-DD`。
- 每个页面只有一个 26px 衬线标题；区块标题 20px 衬线。
- 复用 `--app-*` 变量与工具 class（`.serif/.mono/.num/.eyebrow/.page-title/.rule/.sheet/.empty-state` 等）；新增颜色先加 token。
- 尊重 `prefers-reduced-motion`：只允许 120–180ms 的 opacity/transform。

### Don't
- 不要渐变、玻璃拟态、发光、投影卡片、999px 药丸、>6px 圆角。
- 不要 emoji 当图标/状态/标题；不要聊天气泡与头像；不要无限动画（呼吸/脉冲）。
- 不要紫/蓝/粉强调色；不要第三种色相；朱砂不要大面积铺。
- 不要居中一切（只有「空状态主句 + 动作」允许居中）。
- 不要写死颜色/字号/圆角；不要为好看改变交互行为。
- 不要引入网络字体（尤其中文）与 CDN 资源——目标市场被墙。
