---
name: 信息管理 · Windows 11 原生桌面应用
version: v9 · 2026-11
description: 以《前端提示词》为唯一圣经的 Windows 11 / Fluent Design 原生桌面体验——桌面壁纸 + 任务栏 + 无边框 Mica 窗口 + Acrylic 图标导航 + Segoe UI Variable + 无渐变低饱和中性色
colors:
  window-mica: "rgba(32,32,32,0.82) + blur(60px) saturate(140%)"
  acrylic: "rgba(32,32,32,0.55) + blur(30px) saturate(130%)"
  layer: "rgba(255,255,255,0.0337)"
  card: "rgba(255,255,255,0.0512)"
  card-hover: "rgba(255,255,255,0.0837)"
  card-border: "rgba(255,255,255,0.0698)"
  divider: "rgba(255,255,255,0.0837)"
  text: "#FFFFFF"
  text-secondary: "#D6D6D6"
  text-tertiary: "#A0A0A0"
  text-disabled: "#6B6B6B"
  accent: "#4CC2FF"
  accent-hover: "#6DD0FF"
  accent-pressed: "#38A9DF"
  accent-soft: "rgba(76,194,255,0.12)"
  danger: "#FF99A4"
  success: "#6CCB5F"
  warning: "#FCE100"
  light-window: "rgba(243,243,243,0.86)"
  light-card: "#FFFFFF"
  light-text: "#1B1B1B"
  light-accent: "#0067C0"
typography:
  ui:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI Variable', 'Segoe UI', Selawik, -apple-system, 'Microsoft YaHei UI', 'PingFang SC', 'Noto Sans CJK SC', sans-serif"
  display:
    fontFamily: "'Segoe UI Variable Display', 'Segoe UI Variable', 'Segoe UI', Selawik, -apple-system, 'Microsoft YaHei UI', 'PingFang SC', 'Noto Sans CJK SC', sans-serif"
  mono:
    fontFamily: "'Cascadia Mono', 'Cascadia Code', Consolas, 'Courier New', monospace"
  scale: "caption 12/16 · body 14/20 · body-lg 16/22 · subtitle 18/24 · title 28/36 · hero 36/44（标题 600）"
rounded:
  control: "4px"
  card: "8px"
  flyout: "8px"
  dialog: "8px"
  window: "8px"
  pill: "999px"
layout:
  rail: "68px（60–72）Acrylic 图标导航，文字仅 hover Tooltip"
  caption: "40px 可拖拽标题栏 + 窗口按钮（46×32）"
  statusbar: "28px"
  taskbar: "48px（桌面层，非窗口内）"
  content-max: "1280px；库页可 1600px"
  page-pad: "32px（移动端 12–16px）"
materials:
  desktop: "中性近黑 Bloom 壁纸（暗）/ 中性浅灰壁纸（亮），窗口浮于其上"
  mica: "窗口长生命周期底层，带壁纸采样的柔和半透明"
  acrylic: "标题栏 / 导航 / 浮层 / 对话框 / 任务栏，blur 24–48 + 噪点"
  smoke: "对话框遮罩：黑 45% + blur(2px)"
---

# Design System · 信息管理 · Windows 11 Native v9

## 一句话

> 这不是网页套壳。它应该像 **Windows 11 自带的设置 / 文件资源管理器 / 计算器**：桌面壁纸上的一个无边框圆角 Mica 窗口，图标导航、系统字体、中性色、克制动效、没有渐变。

本文件是 v9 的唯一设计说明。实现合同见 `redesign-brief/11-v9-win11-desktop.md`；
唯一色板/尺寸来源是 `src/styles/w11/tokens.css`；共享组件类在 `src/styles/w11/primitives.css`。

## 与 v8 及更早版本的关系

**全部推翻。** v8 是「全屏浅色网页 + 窄栏」，v9 是「Windows 11 桌面上的原生窗口」：

| | v8（旧） | v9（当前） |
|---|---|---|
| 画面 | 铺满浏览器的浅色网页 | 壁纸 + 任务栏 + 浮动 Mica 窗口 + 窗口按钮 |
| 默认主题 | 浅色 | 深色（Win11 深色设置应用） |
| 字体 | Inter / Plus Jakarta Sans | Segoe UI Variable（Selawik 回退） |
| 导航 | 68px 窄栏 + 中文首字方块 | 68px Acrylic 图标栏 + Fluent 语义图标 + hover Tooltip |
| 页面 | 白卡片 + 大圆角 + 编号目录 | 设置卡片 / 资源管理器命令栏 / 原生列表；8px 圆角 |
| 首页 | Start + Settings 混合 | Win11 设置主页 + 已固定磁贴 + 最近修改 + 今天 + 数据概览 |
| 登录 | 居中深色卡片 | Win11 锁屏：壁纸 + 大时钟 + Acrylic 登录面板 |
| AI | 右侧面板 | Copilot 式 Acrylic 侧栏 |
| 组件库 | antd 浅色 token | antd 全局 Win11 皮肤 + Fluent 图标 |

历史样式文件（v5 流光玻璃、v6 Nova、v7 Fluent、v8）已全部删除，不允许往回兼容。

## 反模式（禁止）

`neon` `gradient` `futuristic` `cyber` `tech-ui` `dashboard`；
蓝紫渐变背景、大面积渐变、科技 HUD、霓虹高饱和、网页卡片式 Dashboard、Gemini/Web AI 风、
玻璃拟态高光、彩色光晕、厚投影、>12px 网页大圆角、emoji 图标、英文 kicker、
`01 / INDEX / ACCOUNT` 编号目录、悬浮渐变 AI 按钮。

## 外壳（Windows 11 桌面）

- **桌面**：`body` 铺中性壁纸（暗 `#0D0D0D` 基调 / 亮 `#E9E9E9` 基调），一层极轻噪点。
- **任务栏**：48px Acrylic，居中 Start/搜索/任务视图 + 本应用 + 文件/帮助/设置；
  右侧托盘（Wi-Fi/音量/电池）+ 两行时间日期；本应用按钮有 Win11 活动横条，点击回首页/恢复窗口。
- **窗口**：inset 8px、底部让出任务栏；8px 圆角、1px 极淡轮廓、柔和深阴影；无边框。
- **标题栏**：40px。左：16px 应用图标 + 「信息管理 — 当前库」；中间拖拽区；右：搜索框（Ctrl K）/
  主题 / 语言 / 账户；最右三个窗口按钮（最小化 / 最大化·还原 / 关闭，关闭 hover 变成 `#C42B1C` 红）。
  双击标题栏切换最大化；最小化/关闭回到桌面并保留「重新打开」入口。
- **内容区**：Mica 层；底部 28px 原生状态栏（本地优先 · N 个管理库 · 已连接）。
- **移动端**：不模拟桌面；全屏窗口 + 48px 标题栏 + 56px Acrylic 底部标签栏 + 抽屉导航。

## 材质与色彩

- **Mica**：窗口 `rgba(32,32,32,.82)` + `blur(60px) saturate(140%)`（浅色 `rgba(243,243,243,.86)`）。
  长生命周期主表面只用 Mica。
- **Acrylic**：标题栏 / 导航 / 任务栏 / 浮层 / 弹窗 / 对话框；`blur(24–48px) saturate(125–140%)` + 细噪点。
- **Card 层**：`rgba(255,255,255,.0512)` + 1px `rgba(255,255,255,.07)` 描边 + `0 2px 4px rgba(0,0,0,.24)`。
  亮色卡片纯白 + `rgba(0,0,0,.0578)` 描边。
- **强调色只做 10%**：主按钮、选中态、焦点环、活动指示、开关开启、少量状态点。
- 深色默认 + 完整浅色主题；两套都通过 WCAG AA（正文 4.5:1）。

## 字体

Segoe UI Variable Text / Display；非 Windows 环境回退 **Selawik**（OFL，Segoe 度量兼容，自托管
`public/fonts/selawik-*.woff`）；中文回退 Microsoft YaHei UI / PingFang SC / Noto Sans CJK SC。
等宽（Cascadia Mono）只用于 ID / 时间 / 快捷键。字阶见 front-matter；标题 600，正文 400；
最小 12px，禁止 12px 以下的功能文字。

## 形状 / 阴影 / 动效

- 圆角：控件 4px；卡片 / 浮层 / 对话框 / 窗口 8px；胶囊 999px。
- 阴影：卡片 `0 2px 4px rgba(0,0,0,.24)`；浮层 `0 8px 16px rgba(0,0,0,.4)`；
  对话框 `0 32px 64px rgba(0,0,0,.6)`；窗口 `0 24px 48px rgba(0,0,0,.55)`。短、软、深，无彩色光。
- 动效：100–200ms `cubic-bezier(.1,.9,.2,1)`；hover 提亮 / active `scale(.985)`；
  页面切换 150ms 淡入 + 6px 上移；窗口入场 180ms。禁止弹跳 / 大位移；`prefers-reduced-motion` 全关。
- 焦点：2px 实线焦点环，深色白环 / 浅色黑环（Win11 双色描边感）。

## 组件（共享类见 `src/styles/w11/primitives.css`）

- **Button**：高 32 / 28 / 40；accent / standard / subtle / danger / icon；圆角 4；icon 16。
- **Search**：高 32、半透明底、1px 低对比描边、focus 底部 2px 强调下划线。
- **设置行**：48–56 高；32px 图标块 + 标题 14 + 说明 12 + 右侧控件；hover 提亮；卡片内只用横向分割线。
- **Table（资源管理器）**：命令栏 44 + 地址条 32 + 表头 34 + 行 40；仅横线；hover 提亮；选中 accent-soft + 左 3px。
- **Dialog**：Acrylic、8px、20px 标题、右下按钮、Smoke 遮罩。
- **Flyout / Dropdown / Tooltip**：Acrylic、8px、32px 菜单项、中性 hover。
- **Toggle**：40×20 Win11 胶囊；**Pivot**：14px 文字 + 2px 强调下划线。
- **Empty**：Fluent 线性图标 + 16px 标题 + 13px 说明 + 主操作。

## 页面

- **首页**：设置主页结构——问候页头 + 已固定磁贴 + 最近修改 + 今天 + 数据概览（事实行，不是彩色 KPI）+ 快速设置。
- **库页**：文件资源管理器——命令栏 + 面包屑 + 筛选 + 原生 details 表格 + 状态栏；编辑器/模板/导入导出/回收站为 Win11 ContentDialog。
- **设置**：Win11 设置——左侧分类列表 + 右侧设置卡片与设置行。
- **管理后台**：系统信息 / 任务管理器——事实条 + 账户表格 + 危险色行操作。
- **登录/注册**：Win11 锁屏——壁纸 + 大时钟 + Acrylic 登录面板。
- **落地页**：Win11 应用欢迎 / 商店详情——克制营销、设置卡片、FAQ Expander。
- **帮助**：Win11 获取帮助——搜索 + 主题卡 + FAQ。
- **AI**：Copilot 侧栏——消息 / 工具确认卡 / 输入区 / 快捷 chip；图表与确认弹窗为 Win11 对话框。
- **移动端**：全屏 + 底栏；390px 单列。

## 工程

- 样式入口 `src/styles/index.css` 只做 `@import`：tokens → base → antd → primitives → shell → 页面 CSS。
- 页面样式各归其文件：home / library / public / settings / ai。
- antd 由 `ConfigProvider` token + `w11/antd.css` 二次主题（等价提示词里的「Element Plus 二次主题」）。
- 图标只用 `@fluentui/react-icons`；不新增依赖；不改变业务逻辑 / 字段 / 校验 / 快捷键 / i18n key。
- 验收：`tsc -b`、`eslint src functions`、`vitest run`、`vite build` 全绿；1440×900 明暗 + 390×844 截图通过。

## Do / Don't

### Do
- 把用户当 Windows 用户：系统字体、中性色、稳定布局、键盘可达（Ctrl K / Ctrl J / Esc / ↑↓）。
- 大留白、低密度、中央聚焦；页面之间用留白和分割线，不套卡片。
- 材质分层：桌面 → 窗口 Mica → Acrylic 导航/浮层 → Card 层。

### Don't
- 不要渐变 / 霓虹 / 蓝紫 / 科技 HUD / Web Dashboard / Gemini 风。
- 不要 >12px 的网页大圆角、厚阴影、彩色光晕、emoji 图标。
- 不要为了视觉改业务逻辑、字段顺序、快捷键、校验。
