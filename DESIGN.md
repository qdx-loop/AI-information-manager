---
name: 信息管理 · Windows 11 Fluent 应用
version: v10.3 · 2026-11
description: 以 microsoft/fluentui（Fluent UI React v9）为唯一设计系统的 Windows 11 风格 Web 应用——Fluent app bar + 232px 展开式导航（可收起为 68px 图标栏）+ Fluent Card/列表/对话框；不是操作系统模拟（无壁纸/任务栏/窗口/锁屏）
colors:
  source: "全部来自 src/theme/win11.ts 的 Fluent Theme（light/dark），页面只消费 token"
  canvas: "colorNeutralBackground2（深色 #202020 / 浅色 #F3F3F3）"
  surface: "colorNeutralBackground1（深色 #2B2B2B / 浅色 #FFFFFF）"
  surface-hover: "colorNeutralBackground1Hover"
  stroke: "colorNeutralStroke2"
  text: "colorNeutralForeground1（深色 #FFFFFF / 浅色 #1B1B1B）"
  text-2: "colorNeutralForeground2（深色 #D6D6D6 / 浅色 #5C5C5C）"
  text-3: "colorNeutralForeground3（深色 #A0A0A0 / 浅色 #6E6E6E）"
  accent: "colorBrandBackground（深色 #4CC2FF + 黑字 / 浅色 #0067C0 + 白字）"
  danger: "colorStatusDangerForeground1/Background1"
  success: "colorStatusSuccessForeground1/Background1"
  warning: "colorStatusWarningForeground1/Background1"
typography:
  source: "Fluent typography tokens（fontFamilyBase / fontSizeBase100-1000 / lineHeightBase* / fontWeight*）"
  font-family: "'Segoe UI Variable Text', 'Segoe UI Variable', 'Segoe UI', Selawik, -apple-system, 'Microsoft YaHei UI', 'PingFang SC', 'Noto Sans CJK SC', sans-serif"
  display: "'Segoe UI Variable Display', 'Segoe UI Variable', 'Segoe UI', Selawik, …"
  mono: "'Cascadia Mono', 'Cascadia Code', Consolas, 'Courier New', monospace"
  scale: "100 10 / 200 12 / 300 14 / 400 16 / 500 20 / 600 24 / 700 28 / 800 32 / 900 40 / 1000 68"
rounded:
  control: "borderRadiusMedium = 4px"
  card-flyout-dialog: "borderRadiusXLarge = 8px"
  pill: "borderRadiusCircular"
materials:
  rule: "Fluent 2 分层中性面：canvas=Background2，surface=Background1，hover/pressed/selected=对应 Fluent 状态 token，浮层=Background1 + shadow16/64 + stroke2；不使用自定义 blur/壁纸/假 Mica"
  shadow-4: "var(--shadow4)"
  shadow-16: "var(--shadow16)"
  shadow-64: "var(--shadow64)"
layout:
  appbar: "48px Fluent app bar（应用标识 / 当前库 / 搜索 / 主题 / 语言 / 账户）"
  rail: "232px 展开式 NavigationView（库名 + 分类可见；可收起为 68px 图标栏，选择持久化）"
  content: "Fluent 内容画布 + 页面级 Card/Toolbar/Table；右栏 AI 面板 320-400px"
  mobile: "48px app bar + 内容 + 56px 底部标签栏 + 抽屉导航"
---

# Design System · 信息管理 · Windows 11 Fluent App（v10）

## 一句话

> 这是 **Windows 11 风格的应用界面**，不是 Windows 桌面模拟器。
> 界面用 **microsoft/fluentui 的 Fluent UI React v9** 搭建：Fluent app bar、Fluent 导航、Fluent Card、Fluent 对话框、
> Fluent 2 design tokens；没有壁纸、任务栏、浮动窗口、最小化/最大化/关闭、锁屏大时钟。

## 与 v9 的关系（用户反馈 2026-11-02）

| | v9（被否） | v10（当前） |
|---|---|---|
| 形态 | 桌面壁纸 + 任务栏 + 浮在桌面上的窗口 | 满屏 Web 应用：app bar + 展开式导航 + 内容 |
| 窗口 | 标题栏 + 最小化/最大化/关闭 + 桌面图标 | 无窗口 chrome |
| 登录 | Win11 锁屏（壁纸 + 大时钟） | Fluent 应用登录页（中性画布 + Fluent Card） |
| 落地页 | 含桌面截图/窗口感 | Fluent 应用介绍页 |
| 控件 | 自绘 CSS 模仿 Fluent | 直接使用 `@fluentui/react-components` v9 |
| 主题来源 | 自定义 CSS 色板 + antd token | **唯一来源**：`src/theme/win11.ts` 的 Fluent Theme；CSS 只做 token 别名 |

v9 的 OS 模拟组件/样式/资源已删除（`w-window*` / `w-taskbar*` / `w-caption*` / `w-desktop*`、壁纸 JPG、WinLogo、锁屏时钟）。

## 设计系统（Fluent UI React v9）

- 唯一参考：https://github.com/microsoft/fluentui （Fluent UI React v9，项目安装 `@fluentui/react-components@9.75.0`）。
- 主题：`createLightTheme/createDarkTheme(windowsBrand)` + Windows 11 中性色/强调色/字体覆盖；
  `<FluentProvider theme={win11FluentLight|Dark}>` 注入；全部 token 同步写到 `<html>` CSS 变量。
- 组件：**可见控件优先用 Fluent 组件**——
  `Button`、`Input`/`Textarea`/`SearchBox`、`Dropdown`/`Option`、`Dialog*`、`Menu*`、`Tooltip`、`Switch`、
  `Checkbox`、`RadioGroup`、`TabList`/`Tab`、`Card`/`CardHeader`、`Badge`/`Tag`、`Text`、`MessageBar`、
  `Divider`、`Spinner`/`Skeleton`、`Accordion`、`Field`/`Label`、`ProgressBar`、`Avatar`/`Persona`、`Link`。
- antd v5 只保留 Fluent 覆盖不到的复杂输入件（DatePicker / Form 校验内核 / Upload）与部分表格内核；
  其 token 由**同一份 Fluent theme** 派生（`src/theme/index.ts`），不允许出现第二套色板。
- 图标：`@fluentui/react-icons` 统一 16/20px regular；图标按钮必须有 `aria-label`/`Tooltip`。

## 颜色 / 排版 / 形状

- 颜色：只用 Fluent token（`var(--color*)` / `--w-*` 别名）。页面 CSS 不得出现独立 hex。
  - 画布 `colorNeutralBackground2`（#202020 / #F3F3F3），卡片/表格/输入 `colorNeutralBackground1`（#2B2B2B / #FFFFFF）。
  - 悬停/按下/选中用 `colorNeutralBackground*Hover/Pressed/Selected`、`colorSubtleBackground*`。
  - 边界/分割线 `colorNeutralStroke2/1`；强调 `colorBrandBackground*`；状态色 `colorStatus*`。
- 字体：Fluent `fontFamilyBase` = Segoe UI Variable（Selawik 回退，中文字体回退 Microsoft YaHei UI/Noto Sans CJK）。
  字阶使用 Fluent `Text` 的 size 100–1000 / weight regular–semibold；正文 14/20。
- 圆角：控件 4px（Fluent Medium），卡片/浮层/对话框 8px（Fluent XLarge）；不做 >12px 网页圆角。
- 阴影：只用 Fluent `shadow4/8/16/64`；不做彩色光、厚投影、自定义 blur。

## 布局（Fluent 应用）

- **app bar 48px**：左 AppIcon +「信息管理」+ 当前库；右 Fluent 搜索触发（Ctrl K）、主题、语言、账户 Menu。
- **左导航**：默认 232px 展开（Windows 11 NavigationView 展开态）——库名 + 分类直接可见、子库缩进；底部「收起导航」可回到 68px 图标栏，选择写入 localStorage。首页 / 库列表 / 新建 / AI / 回收站 / 设置 / 帮助 / 账户。
- **内容**：`w-page` 最大宽 1280、32px 边距、卡片化分组；库页是资源管理器式 Toolbar + 面包屑 + 数据表 + 页面内状态栏。
- **AI**：右侧 Fluent 面板（桌面）/底部 Sheet（手机）。
- **移动端**：48px app bar + 内容 + 56px 底部标签栏 + 抽屉导航。

## 页面

- 首页：Fluent Text/Card/Button/Badge/Spinner —— 已固定库、最近修改、今天、数据概览、快速设置。
- 库页：Fluent Toolbar/Button/SearchBox/Dropdown/Dialog/Field/Checkbox/Tag/Badge + 资源管理器式表格。
- 设置：Fluent Card + Divider + 设置行（Switch/Dropdown/Button/Accordion）。
- 登录/注册：Fluent 应用登录页（Card + TabList + Field/Input + MessageBar）。
- 落地页：Fluent 应用介绍页（导航 + Hero + Card 网格 + Accordion FAQ）。
- 帮助：SearchBox + Card + Accordion + 目录/正文。
- 后台：Fluent Card 登录 + 事实 Card + 表格 + Dialog 危险操作。
- AI/图表/确认/全局搜索：Fluent Dialog + Fluent 控件。

## Components

组件全部直接使用 Fluent UI React v9（`@fluentui/react-components`），不另造一套视觉件；
页面 CSS 只允许调 Fluent token 与布局，不允许重画按钮/输入框/卡片。以下为跨页面的一致约定：

| 组件 | 用法与不变量 | 来源 |
| --- | --- | --- |
| Button | `appearance="primary"` 只给页面唯一主操作；`secondary` 用于次级动作；`subtle` 用于工具栏/图标按钮。图标按钮必须带 `aria-label` 或 Tooltip；加载态用 `Spinner size="tiny"` 替换 icon 并 `disabled`。 | Fluent `Button` |
| Input / SearchBox / Dropdown | 表单一律 `Field + label`，错误用 `validationState="error"` + `validationMessage`；占位符颜色提升到 `colorNeutralForeground3`（≥4.5:1）；聚焦下划线使用 `colorCompoundBrandStroke`（深色 #4CC2FF / 浅色 #0067C0）。 | Fluent `Input`/`SearchBox`/`Dropdown` |
| Card | 只做一层容器：`colorNeutralBackground1` + `borderRadiusXLarge` + 1px `colorNeutralStroke2`；卡片内不再套卡片；页面分组用 Card，列表行不用 Card。 | Fluent `Card` |
| Dialog | 统一 `DialogSurface` + `DialogBody`，标题左对齐、危险动作红色；关闭/Esc 由 Fluent 焦点陷阱处理，关闭后焦点回到触发元素。宽度遵循 `min(px, calc(100vw - 32px))`。 | Fluent `Dialog*` |
| Toolbar + Table | 库页用 `Toolbar`；表格使用原生 `<table role="grid">` + Fluent token 渲染，行高 40、表头 34，仅横向分割线；行选中态用 `colorSubtleBackgroundSelected` + 左侧 3px 品牌色条（Win11 资源管理器惯例），键盘焦点用 2px `colorStrokeFocus2` 焦点环（两者可区分）。 | Fluent `Toolbar` + 自定义表格 |
| NavigationView（rail） | 默认 232px 展开：库名 13px + 分类 11px，子库按层级缩进；收起后为 68px 图标栏（Fluent Button + Tooltip）。当前项 `aria-current="page"` + 选中底色；移动端改为 48px app bar + 底部标签栏 + Drawer。 | Fluent `Button`/`Tooltip`/`Menu` |
| MessageBar / Toast | 离线、错误、提示用 `MessageBar`（页面内）或 antd `message`（瞬时反馈，token 与 Fluent 同源）；危险/错误消息必须说明恢复动作。 | Fluent `MessageBar` + antd message |

状态约定：每个可交互组件必须有 hover / pressed / focus-visible / disabled 四态；异步操作必须有加载态与失败文案；
空列表用 `EmptyPanel`，错误用 `MessageBar intent="error"`，不能只 toast 后留空屏。

## 工程与验收

- 单一主题来源：`src/theme/win11.ts`；`src/main.tsx` 首帧前与切换时把 token 写到 `<html>`。
- `src/styles/w11/tokens.css`：`--w-*` 只做 Fluent token 别名；`primitives.css` 提供布局辅助类；
  `shell.css` 是 Fluent app 外壳；页面样式各自文件（home/library/public/settings/ai）。
- 验收：`tsc --noEmit`、`eslint src functions`、`vitest run`、`vite build` 全绿；
  1440×900 明暗 + 390×844 + 全部页面截图；`design_review` 复查；线上部署 200。
- 不新增依赖、不改业务逻辑/字段/校验/快捷键/i18n key。

## Do / Don't

### Do
- 用 Fluent 组件与 Fluent token 表达 Windows 11 风格：分层中性面、4/8px 圆角、克制动效、系统字体。
- 保持键盘可达（Ctrl K / Ctrl J / Esc / ↑↓）、可见焦点、触控目标 ≥ 32/44、明暗对比 ≥ 4.5:1。
- 页面只用 Fluent 语义层级：Canvas → Card → Card 内行；避免自绘按钮/输入框。

### Don't
- 不要做操作系统模拟：无壁纸、任务栏、窗口、窗口按钮、桌面图标、锁屏时钟。
- 不要渐变 / 霓虹 / 科技 HUD / 网页 Dashboard / 自定义 blur / 大圆角卡片墙 / emoji 图标。
- 不要为了视觉改业务逻辑、字段顺序、快捷键、校验。
