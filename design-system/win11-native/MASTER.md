# Design System · 信息管理 · Windows 11 Fluent App (v10)

> 单一事实来源：`redesign-brief/12-v10-fluent-app.md`（实现合同，纠正 v9 的「操作系统模拟」）、
> `DESIGN.md`（设计说明）、`src/theme/win11.ts`（唯一 Fluent Theme 定义）、
> `src/styles/w11/tokens.css`（--w-* 全部是 Fluent token 别名）。
> 设计参考：microsoft/fluentui · Fluent UI React v9（`@fluentui/react-components@9.75.0`）。

## 核心

- 目标：**Windows 11 风格的 Web 应用界面**，不是 Windows 操作系统模拟。
- 形态：48px Fluent app bar（应用标识 / 当前库 / 搜索 / 主题 / 语言 / 账户）
  + 68px 图标导航（Fluent Button + Tooltip）+ Fluent 内容画布 + 右侧 AI 面板；移动端 48px app bar + 56px 底部标签栏。
- **没有**：壁纸、任务栏、浮动窗口、最小化/最大化/关闭按钮、桌面图标、锁屏大时钟。
- 唯一设计系统：Fluent UI React v9 组件 + Fluent 2 design tokens（`FluentProvider` 主题）。
- 一句话验收：普通用户第一眼认为「这是一个做得很 Windows 11 的网页应用」，而不是「一张 Windows 桌面截图」。

## Token（唯一来源：src/theme/win11.ts）

| 组 | Fluent token | 深色（默认） | 浅色 |
|---|---|---|---|
| 画布 | `colorNeutralBackground2` | #202020 | #F3F3F3 |
| 卡片/表面 | `colorNeutralBackground1` | #2B2B2B | #FFFFFF |
| hover/pressed/selected | `colorNeutralBackground1Hover/Pressed/Selected`、`colorSubtleBackground*` | Fluent 默认 | Fluent 默认 |
| 描边/分割线 | `colorNeutralStroke1/2/3` | Fluent 默认 | Fluent 默认 |
| 文字 | `colorNeutralForeground1/2/3` | #FFFFFF/#D6D6D6/#A0A0A0 | #1B1B1B/#5C5C5C/#6E6E6E |
| 强调 | `colorBrandBackground*` | #4CC2FF（黑字） | #0067C0（白字） |
| 状态 | `colorStatusDanger/Success/Warning*` | Fluent 默认 | Fluent 默认 |
| 圆角 | `borderRadiusMedium / XLarge` | 4px / 8px | 同 |
| 阴影 | `shadow4 / 8 / 16 / 64` | Fluent 默认 | 同 |
| 字体 | `fontFamilyBase / Monospace` | Segoe UI Variable（Selawik 回退）/ Cascadia Mono | 同 |

## 组件（Fluent UI React v9 优先）

`Button`、`Input`/`Textarea`/`SearchBox`、`Dropdown`/`Option`、`Dialog` 系列、`Menu` 系列、`Tooltip`、
`Switch`、`Checkbox`、`RadioGroup`、`TabList`/`Tab`、`Card`/`CardHeader`、`Badge`/`Tag`、`Text`、
`MessageBar`、`Divider`、`Spinner`/`Skeleton`、`Accordion`、`Field`/`Label`、`ProgressBar`、
`Avatar`/`Persona`、`Link`、`Toolbar`/`ToolbarButton`。

antd v5 仅保留 Fluent 覆盖不到处：DatePicker、Form 校验内核、Upload、部分表格内核；其 token 在
`src/theme/index.ts` 由**同一份 Fluent theme** 派生，不得出现第二套色板。

布局辅助类：`src/styles/w11/primitives.css`（.w-page/.w-card/.w-row/.w-btn 等仅用于布局与原型兜底）；
页面样式各自文件：`home / library / public / settings / ai.css`（只消费 `var(--color*)` / `var(--w-*)`）。

## 页面配方

- 外壳：`AppShell.tsx` + `Sidebar.tsx` + `MobileTabBar.tsx` + `styles/w11/shell.css`
  （w-app / w-appbar / w-rail / w-content / w-panels / w-mobile-tabbar；无 OS chrome）。
- 首页：`HomeDashboard.tsx` + `home.css`（Fluent Text/Card/Button/Badge/MessageBar/Spinner/Divider）。
- 库页：`LibraryView/LibraryTable` + `library.css`（Fluent Toolbar/SearchBox/Dropdown/Dialog/Field/Checkbox/Badge + 资源管理器式表格）。
- 设置/后台：`SettingsPage/AdminPage` + `settings.css`（Fluent TabList/Card/设置行/Switch/Dialog）。
- 公开页：`AuthPage/Landing/HelpPage` + `public.css`（Fluent Card/TabList/Field/Button/Accordion/SearchBox）。
- AI/搜索/弹窗：`AIPanel/GlobalSearch/ChartModal/Confirm*` + `ai.css`（Fluent Dialog/Textarea/Button/Menu）。

## 规则

1. 颜色/圆角/阴影/字体只允许 Fluent token（`var(--color*)` / `var(--w-*)` / `var(--borderRadius*)` / `var(--shadow*)`）。
2. 新页面优先使用 Fluent 组件；antd 仅限 Fluent 覆盖不到处，且 token 必须同源。
3. 图标只用 `@fluentui/react-icons`；图标按钮必须有 `aria-label` / Tooltip；禁止 emoji 图标。
4. 每页同时支持 `[data-theme='dark']`（默认）与 light、1440/1024/768/390；
   支持 `prefers-reduced-motion`、可见焦点、键盘可达（Ctrl K / Ctrl J / Esc / ↑↓）。
5. **禁止操作系统模拟**：无壁纸/任务栏/窗口/窗口按钮/桌面图标/锁屏。
6. 保留业务逻辑 / props / exports / i18n key / 快捷键 / 测试契约；不新增依赖。
7. 验收：`tsc --noEmit`、`eslint src functions`、`vitest run`、`vite build` 全绿；
   1440×900 明暗 + 390×844 截图；线上部署 200。
