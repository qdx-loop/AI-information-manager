# v10 · Fluent UI 应用（不是操作系统）—— 实现合同

> 用户反馈（2026-11-02）：
> 1. **「我是说 Windows 11 风格，不是操作系统，你做的太像操作系统了。」**
>    v9 的桌面壁纸、Windows 任务栏、浮在桌面上的窗口、最小化/最大化/关闭按钮、锁屏大时钟全部**删除**。
>    这是一个 Windows 11 风格的 **Web 应用界面**，不是 Windows 桌面模拟器。
> 2. **「microsoft/fluentui 参考这个项目。」**
>    以 `microsoft/fluentui`（Fluent UI React v9，项目已安装 `@fluentui/react-components@9.75.0`）为唯一设计参考：
>    真实 Fluent 组件 + Fluent 2 design tokens + FluentProvider 主题；**不要**再用自绘 CSS 模仿 Fluent 控件。
> 3. **「参考这个插件 dsh-ui-ux-pro-max。」**
>    遵循插件检索结果：Style = **Fluent 2**；App 外壳用 **NavigationView 模式**（顶部 app bar + 左侧导航 + 内容）；
>    使用内置 Fluent 材质/tokens，避免自定义 blur/shadow；遵守其无障碍、触控、对比度、降级动效清单。

> 本文件是 v10 的唯一实现合同，**优先于 v9 的 `redesign-brief/11-v9-win11-desktop.md` 中与「操作系统模拟」相关的一切**。
> v9 的桌面舞台/任务栏/窗口 chrome 必须整体删除；其余页面结构可以沿用并改造成 Fluent 应用形态。

## 1. 新形态（第一屏）

```
┌───────────────────────────────────────────────────────────────────────┐
│ [AppIcon] 信息管理  客户台账      │  [搜索…]   ☀/🌙  中/EN   (头像) │ 48px app bar（Fluent）
├──────┬────────────────────────────────────────────────────────────────┤
│ 68px │                                                                │
│ 图标  │        Fluent 内容区：页面标题 / Toolbar / Card / Table          │
│ 导航  │        （背景 colorNeutralBackground2，卡片 colorNeutralBackground1）│
│      │                                                                │
├──────┴────────────────────────────────────────────────────────────────┤
│ （可选）页面内状态栏只属于业务页面（如资源管理器式库页），不是全局 OS 状态栏 │
└───────────────────────────────────────────────────────────────────────┘
```

- **满屏应用**：`height: 100dvh`，无壁纸、无任务栏、无桌面图标、无窗口阴影/圆角外框、无窗口按钮。
- **顶部 app bar = 48px**：左：AppIcon + 「信息管理」+ 当前库/页面上下文；右：Fluent 搜索框（Ctrl K）、
  主题切换、语言切换、账户 Menu（头像）。
- **左侧导航**：默认 232px 展开（库名 + 分类直接可见，子库缩进），底部可收起为 68px 图标栏；用 Fluent Button / Tooltip / Menu / Divider 构建；
  库项 = Fuent 图标块，hover 显示菜单（重命名/分类/子库/上移下移/删除），支持拖拽排序。
- **内容区**：页面间距/留白/低密度；卡片与列表全部 Fluent 组件或 Fluent token 布局。
- **移动端**：48px app bar + 内容 + 底部 Fluent 风格标签栏（56px，4 项）+ 抽屉导航。
- **登录/注册/落地页/帮助/后台**：都是**应用页面**（Fluent 布局/卡片/组件），**不是**操作系统锁屏或桌面。

## 2. 唯一设计系统：Fluent UI React v9

- 主题：`src/theme/win11.ts` 定义 Windows 11 风格的 **Fluent Theme**（light/dark）：
  `createLightTheme/createDarkTheme(windowsBrand)` + 覆盖为 Win11 中性色/强调色/字体/圆角；
  由 `<FluentProvider theme={...}>` 注入。**禁止**在页面中 define 新的颜色 hex 或自绘阴影。
- 全局 CSS：token bridge 把 Fluent theme 的 CSS 变量（`--colorNeutralBackground1`、`--colorNeutralForeground1`、
  `--colorBrandBackground`、`--borderRadiusMedium`、`--shadow16`、`--fontFamilyBase` …）写到 `<html>`；
  `styles/w11/tokens.css` 中的 `--w-*` 只能是 Fluent 变量的别名，不允许再出现独立色板。
- antd：仅作为 Fluent 覆盖不到的复杂输入件（DatePicker / Form 校验 / Upload）与表格内核保留，
  其主题 token 必须从同一份 Fluent theme 派生（`src/theme/index.ts`），视觉上不得与 Fluent 控件冲突。
- 组件优先：可见控件一律优先使用 `@fluentui/react-components`：
  `Button`（primary/secondary/subtle/transparent）、`Input`、`Textarea`、`SearchBox`、`Dropdown`/`Option`、
  `Dialog`/`DialogSurface`/`DialogBody`/`DialogTitle`/`DialogContent`/`DialogActions`、
  `Menu`/`MenuItem`/`MenuList`/`MenuPopover`/`MenuTrigger`/`MenuButton`、
  `Tooltip`、`Switch`、`Checkbox`、`RadioGroup`/`Radio`、`TabList`/`Tab`、`Card`/`CardHeader`、
  `Badge`、`Tag`、`Persona`/`Avatar`、`Divider`、`MessageBar`、`Spinner`、`Skeleton`、`ProgressBar`、
  `Accordion`/`AccordionItem`/`AccordionHeader`/`AccordionPanel`、`Breadcrumb`/`BreadcrumbItem`/`BreadcrumbButton`、
  `Toolbar`/`ToolbarButton`/`ToolbarGroup`/`ToolbarDivider`、`Field`/`Label`、`Toast`/`Toaster`（按需）、`SkeletonItem`。
- 文案排版：用 `Text`（`Title1/Title2/Subtitle1/Subtitle2/Body1/Body1Strong/Caption1`）或 Fluent type tokens。
- 图标：`@fluentui/react-icons`（已安装），统一 16/20px regular；禁止混用其他图标库；图标按钮必须 `aria-label`。
- 材质/层次（Fluent 2 语义，不是自绘毛玻璃）：
  - 页面画布 `colorNeutralBackground2`；卡片/表格/输入 `colorNeutralBackground1`；
  - 浮层（Menu/Dialog/Tooltip）`colorNeutralBackground1` + `shadow16/64` + 1px stroke；
  - hover/pressed/selected 用 `colorNeutralBackground*Hover/Pressed/Selected` / `colorSubtleBackground*`；
  - 边框/分割线 `colorNeutralStroke2/1`；强调 `colorBrandBackground*`；
  - 圆角 `borderRadiusMedium(4)/Large(8)`；不要自定义 blur/彩色光/大圆角。
- 动效：Fluent motion tokens；150–200ms、无弹跳；`prefers-reduced-motion` 全部关闭。

## 3. 保留 / 删除

### 保留（业务）
- 全部路由、store、db、auth、AI、导入导出、模板、同步、回收站、i18n key、快捷键、测试契约。
- 左侧默认展开导航（库名/分类可读），可收起为 68px 图标栏。
- Mica/Acrylic 的“感觉”：通过 Fluent 分层中性面 + 半透明标题栏/导航 + 轻描边表达，**不画壁纸、不做假窗口**。

### 删除（OS 模拟）
- `body` 壁纸、桌面舞台、任务栏（Start/搜索/任务视图/托盘/时钟）、桌面图标、窗口状态
  （normal/maximized/minimized/closed）、窗口按钮（最小化/最大化/关闭）、拖拽标题栏、整窗阴影/圆角外框、
  全局 28px 状态栏、Windows 锁屏大时钟/壁纸、`WinLogo`、`w-taskbar*`、`w-caption*`、`w-desktop*`、`w-window*`
  相关 JSX/CSS/i18n。
- 登录页不再出现「锁屏时间 + 桌面壁纸」；落地页不再出现「Windows 桌面截图」。

## 4. 逐页改造（Fluent）

- **外壳**：见 §1；AppShell/Sidebar/MobileTabBar 用 Fluent 组件重写。
- **首页**：Fluent `Text` 标题层级 + `Card`/`CardHeader`（已固定库磁贴、最近修改、今天、数据概览）+ `Button`
  （新建管理库 primary / AI secondary）+ `Badge`/`Tag`（逾期状态）+ `Divider` + `Spinner`/`Skeleton` 加载态；
  不再用自绘 `.w-*` 按钮/卡片，卡片内边距/圆角由 Fluent Card 负责。
- **库页**：Fluent `Toolbar`（新建条目/导入/导出/模板/复用/更多）+ `Breadcrumb` + `SearchBox` +
  `Dropdown`（筛选/排序）+ 数据表（保留资源管理器式布局，单元格用 Fluent `Tag/Badge/Checkbox/Button`）+
  页面内状态栏；编辑器/模板/导入/回收站/建库 = Fluent `Dialog`（`DialogSurface/Body/Content/Actions`）。
- **设置**：Fluent `Card` + `Divider` + 设置行（图标 + `Text` + 右侧 `Switch`/`Dropdown`/`Button`）+
  `Accordion` 展开器 + 左侧分类导航（Fluent token 样式）。
- **管理后台**：登录 = 居中的 Fluent `Card`（密码 `Input` + `Button`）；控制台 = 页头 + 事实卡 + 筛选
  （`SearchBox`/`Dropdown`）+ 账户表格（行内 Fluent Button/Tag）+ 危险操作 Dialog。
- **登录/注册**：Fluent 应用登录页——`Card` + `TabList`（登录/注册）+ `Field`/`Input`/`Checkbox` + `Button`
  + `MessageBar` 错误 + 应用图标；无锁屏、无壁纸。
- **落地页**：Fluent 应用介绍页——顶部轻量导航（AppIcon + 登录/免费注册）+ Hero（应用名/一句话/CTA/截图 Card）
  + 功能 `Card` 网格 + 「数据归你」Card + `Accordion` FAQ + 页脚；无桌面模拟。
- **帮助**：Fluent `SearchBox` + 主题 `Card` + `Accordion` + 目录；内容排版 14/20。
- **AI**：Fluent 侧栏内容——`Button`/`Input`/`Textarea`/`Card`/`Spinner`/`MessageBar`；对话/工具确认/流式逻辑不变。
- **全局搜索**：Fluent `Dialog` + `Input` + 分组列表 + 键盘提示。
- **欢迎/赞赏**：Fluent `Dialog`（`DialogSurface` + QR 白底 Card）。
- **移动端**：Fluent 风格底部标签栏（用 token 渲染，不依赖 antd）、抽屉用 Fluent `Drawer`（或现有 Drawer 改 Fluent）。

## 5. 约束

- 不新增依赖（`@fluentui/react-components` / `@fluentui/react-icons` 已安装）。
- 不改 `db/**`、`utils/**`、`store/**`（UI 状态除外）、`ai/**` 逻辑层、API；保留 props/exports。
- 页面 CSS 各归其文件（`styles/w11/home|library|public|settings|ai.css`），共享布局只改 `shell.css`/`primitives.css`。
- 所有颜色/圆角/阴影/字体只允许 Fluent token（`var(--color*)`/`var(--borderRadius*)`/`var(--shadow*)`/`var(--font*)`）。
- 验收：`tsc --noEmit`、`eslint src functions`、`vitest run`、`vite build` 全绿；
  截图 1440×900 明暗 + 390×844 + 所有页面；用 `design_review` 工具复查通过；线上部署后 200。
