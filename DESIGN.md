---
name: 信息管理 · AI 智能信息管理助手
description: 石墨信号 Graphite Signal——现代产品感：白卡浮于浅灰画布、墨黑主按钮、电靛蓝强调色、全站无衬线
colors:
  canvas: "#FAFAF9"
  surface: "#FFFFFF"
  sunken: "#F2F3F5"
  raised: "#FFFFFF"
  ink: "#18191C"
  ink-muted: "#5B616E"
  ink-faint: "#6B7280"
  border: "#E4E6EA"
  border-strong: "#C9CED8"
  border-rule: "#EDEFF2"
  accent: "#3D5AFE"
  accent-hover: "#2F49D6"
  accent-wash: "#EEF1FF"
  action: "#1B1D22"
  danger: "#C0303E"
  success: "#1E7F4F"
  warning: "#9A5B00"
  dark-canvas: "#0B0C0E"
  dark-surface: "#141619"
  dark-ink: "#EDEEF1"
  dark-accent: "#7C8CFF"
typography:
  sans:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif"
  mono:
    fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Mono', 'Roboto Mono', 'Noto Sans Mono CJK SC', Menlo, Consolas, monospace"
  scale:
    "2xs": "12 / 1.4 · 500（表头、徽标、时间戳）"
    xs: "13 / 1.45（辅助说明）"
    sm: "14 / 1.5（默认 UI 与表格）"
    base: "16 / 1.7（正文、编辑器、AI 输出）"
    lg: "20 / 1.35 · 600（区块标题、弹窗标题）"
    xl: "24 / 1.3 · 600（页面标题，每页一个）"
    "2xl": "32 / 1.2 · 600（大数字/空状态主句）"
    "3xl": "44 / 1.1 · 600（落地页主标）"
rounded:
  r-1: "4px（Tag/Badge/复选）"
  r-2: "8px（按钮/输入/Select/单元格）"
  r-3: "10px（卡片/表格容器）"
  r-4: "12px（弹窗/抽屉/AI 面板）"
  pill: "999px（仅头像与状态点）"
spacing: "4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64"
components:
  card: "白面 + 1px #E4E6EA + 10px 圆角 + shadow-1"
  button-primary: "墨黑 #1B1D22 底 + 白字 + 8px 圆角"
  button-secondary: "白底 + 1px #C9CED8 + 8px 圆角"
  table: "表头 40（sunken + 12/500）/ 行 38 / 行线 #EDEFF2 / 数字右对齐 tabular"
  status-pill: "浅 wash 底 + 语义深字 + 6px 圆点 + 4px 圆角"
  input: "36 高 / 8px 圆角 / sunken 底 + #C9CED8 边"
  shadow-1: "0 1px 2px rgba(16,24,40,.05)（卡片）"
  shadow-2: "0 1px 2px + 0 4px 12px rgba(16,24,40,.08)（浮层）"
  shadow-3: "0 12px 32px rgba(16,24,40,.14) + 0 2px 6px（弹窗）"
---

# Design System: 信息管理（info-manager）· 石墨信号 Graphite Signal

## Overview

**Creative North Star: 「石墨信号」**

用户要的是「现代产品感」：Linear / Notion / Figma / Arc 那一类成熟商业产品。它的「高级」不来自某个隐喻，而来自四个可验证的结构：

1. **表面**：纯白卡片浮在浅灰画布上（canvas `#FAFAF9` / surface `#FFFFFF`，明度差 ≥0.03）。前两版（青瓷 SaaS / 官纸账簿）失败在这里——尤其 v2 的 canvas 与 surface 明度只差 0.02，表面消失，整屏被读作「空、没做完」。
2. **焦点**：全站只有一个鲜亮强调色 **电靛蓝 `#3D5AFE`**（选中、链接、焦点、图表系列 1），加上语义状态色（success/warning/danger）。没有色就没有重点。
3. **字重**：全站无衬线，UI 一律 500、标题 600、400 只给长文；Inter 自托管 latin 子集 + 系统中文链；数字一律 tabular。
4. **完成度**：三级阴影只给卡片/浮层/弹窗；圆角按尺寸递增（4/8/10/12）；动效三档（80/140/200ms）只做颜色、边框、透明度、位移。

这是一款 Operate 型数据工具：所有装饰都必须为「扫读、录入、确认」服务。当前设计不追求叙事感，而追求「第一眼像成熟商业产品、第二眼细节都对得上」。

## Colors

### Light
| 角色 | 值 | 用途 |
|---|---|---|
| canvas | `#FAFAF9` | 页面底 |
| surface | `#FFFFFF` | 卡片/面板/表格/侧栏/头部 |
| sunken | `#F2F3F5` | 表头、输入底、内嵌区、用户消息块 |
| ink | `#18191C` | 正文/标题/数字（16.8:1） |
| ink-muted | `#5B616E` | 次要文字（5.95:1） |
| ink-faint | `#6B7280` | 注脚/占位符（4.63:1） |
| border / border-strong / border-rule | `#E4E6EA` / `#C9CED8` / `#EDEFF2` | 卡片边 / 输入边 / 表格行线 |
| accent / hover / wash | `#3D5AFE` / `#2F49D6` / `#EEF1FF` | 选中、链接、焦点、图表 1 |
| action / hover | `#1B1D22` / `#2C2F36` | 主按钮（白字 16.86:1） |
| success / warning / danger | `#1E7F4F` / `#9A5B00` / `#C0303E` | 语义状态（均 ≥5:1） |

### Dark
`canvas #0B0C0E`、`surface #141619`、`sunken #1A1D22`、`raised #21242A`、`ink #EDEEF1`、`ink-muted #A9AFBA`、`ink-faint #7B828E`、`border #2A2E35`、`accent #7C8CFF`、`action #EDEEF1`（深字 `#0B0C0E`）。暗色下 accent 填充必须用深字（白字仅 2.98:1）。

### Charts
Okabe-Ito/Wong 色盲安全 5 色子集：`#0072B2 #009E73 #D55E00 #CC79A7 #404040`（暗色 `#4C9BD6 #4FBF8F #E07340 #D98BC4 #B4BCC6`）。已验证正常视觉/绿色盲/红色盲无危险色对，不要改。

## Typography

- **Inter 自托管**（`public/fonts/inter-var.woff2`，OFL，latin 子集 ~48KB，`font-display:swap`）；禁止 Google Fonts/CDN（目标市场被墙）。
- 中文走系统黑体链：PingFang SC → Hiragino Sans GB → Noto Sans CJK SC → Microsoft YaHei。
- 字阶只有 8 档：12/13/14/16/20/24/32/44；字重只有 400/500/600（禁止 700）。
- 中文 `letter-spacing: 0`；拉丁标题 `-0.015em ~ -0.025em`；大写字标 `+0.04em`。
- 数字/金额/日期/ID 一律 `font-variant-numeric: tabular-nums`，表格数字列右对齐。
- 等宽只用于数字/日期/ID/快捷键，中文永不进等宽。

## Layout

- 桌面：侧栏 240px（白面）+ 页眉 52px + 内容画布；页面容器 `.page-wrap` 最大 1120，`padding: 24px 32px 40px`；表格页可用 `.page-wrap-wide`（1320）。
- 平板 20/24；手机 16px；底部标签栏 56px + 安全区。
- 表格：表头 40、行 38、单元格 padding 8/12；控件高 36（sm 32 / lg 40）。
- AI 停靠列 360px（340–720 可拖）；内容最大宽 1120；登录表单卡 380；欢迎卡 Modal 420。

## Elevation & Depth

只有三级阴影，全部 token 化：
- `--shadow-1`：卡片（白面 + 1px 边 + 10 圆角 + shadow-1 = **卡片三件套**）。
- `--shadow-2`：下拉/选择器/气泡/peek 入口。
- `--shadow-3`：Modal/Drawer（欢迎卡、图表、确认弹窗）。

按钮、表格行、输入框零阴影；hover 不加位移。

## Shapes

4 / 8 / 10 / 12 四档；上限 12。只有头像与状态点允许 999px。Tag/Badge 4px；状态色片 4px + 6px 圆点。

## Components

- **按钮**：主按钮墨黑（暗色反相）；次按钮白底 + 1px `border-strong`；文字按钮 muted；删除 danger。32/36/40 三档，圆角 8。
- **表格**：白卡容器 `.data-table`；表头 sunken、12/500、`+0.02em`；行 38、行线 `border-rule`；数字右对齐 tabular；状态必须 `.status-pill`（色片 + 圆点）；收藏用 `StarOutlined`；操作列 hover 才显示；允许横向滚动，不允许把电话/金额截断成错值。
- **卡片**：一律「白面 + 1px + 10 圆角 + shadow-1」；禁止无表面裸内容区（v2 最大问题）。KPI 卡 24/600 tabular + 12 标签 + 变化值。
- **输入**：36 高、8 圆角、`border-strong` 边；focus 时 accent 边 + 3px `accent-ring`；错误 danger。
- **状态**：浅 wash 底 + 深字 + 6px 圆点（success/warning/danger/neutral）；不用彩色胶囊长条。
- **弹窗**：12 圆角、shadow-3、标题 20/600；欢迎卡（首次注册）与确认弹窗同一语言。
- **AI 面板**：360 白面；头部 52；用户消息右侧浅灰圆角块，AI 输出无底色 16/1.7；步骤 13 muted 折叠；输入 36 + accent/墨黑发送；运行中顶部 2px accent 静态条。
- **登录**：左 45% sunken 品牌区（标 + 32/600 主标 + 三条说明），右 55% 画布上白卡表单（380）。
- **落地页**：近白底 + 白卡；hero 左 6 栏 + 右产品截图白卡（shadow-3）；功能区 3 列白卡；唯一深色断口；页脚「一个人维护 · 永久免费 · 关于与支持」。
- **动效**：hover/focus 80ms；按下/行高亮 140ms；展开/弹窗 200ms；`prefers-reduced-motion` 全关。

## Do's and Don'ts

### Do
- 先有表面、再谈装饰：每页至少一个白卡/面板；用表面与栅格建立层级，而不是横线。
- 全站只用一个强调色；每个视口可见一个 accent 焦点（≤8% 面积）。
- 数字右对齐 + tabular；金额/电话等短值列给最小宽度，宁可横向滚动不截断。
- 字重 500 是 UI 基线；标题 600；长文 400。
- 复用 `--bg-* / --ink-* / --accent / --action / --shadow-1..3 / --r-* / --text-*` 与工具 class（`.surface-card/.page-wrap/.kpi-*/.data-table/.status-pill/.empty-state`）。

### Don't
- 不要中文衬线（全站 0 处）；不要 Google Fonts/CDN。
- 不要渐变、玻璃拟态、发光、插画站素材、emoji 图标。
- 不要 999px 药丸（头像/状态点除外）；不要 >12px 圆角。
- 不要无表面的裸内容区；不要把整页留空 30–40%。
- 不要第七种灰色、第三种字重、第五种圆角。
- 不要为了好看改交互语义/字段顺序/业务逻辑。
