# Design System · 信息管理 · Windows 11 Native (v9)

> 单一事实来源：`redesign-brief/11-v9-win11-desktop.md`（实现合同）、`DESIGN.md`（设计说明）、
> `src/styles/w11/tokens.css`（唯一 token 定义）。本文件是给后续迭代/新页面的检索入口。

## 核心

- 目标：**Windows 11 原生桌面应用**，不是网页。桌面壁纸 + 任务栏 + 无边框圆角 Mica 窗口 +
  40px 拖拽标题栏（最小化/最大化/关闭）+ 68px Acrylic 图标导航 + 28px 原生状态栏。
- 一句话验收：普通用户第一眼认为「这像 Windows 自带的软件」。
- 禁止：渐变、霓虹、科技 HUD、网页 Dashboard、Gemini 风、emoji 图标、>12px 网页大圆角、彩色光晕。

## Token（详见 tokens.css）

| 组 | 深色（默认） | 浅色 |
|---|---|---|
| 窗口 Mica | `rgba(32,32,32,.82)` | `rgba(243,243,243,.86)` |
| Acrylic | `rgba(32,32,32,.55)` | `rgba(249,249,249,.62)` |
| 卡片 | `rgba(255,255,255,.0512)` | `#FFFFFF` |
| 卡片描边 | `rgba(255,255,255,.0698)` | `rgba(0,0,0,.0578)` |
| 分割线 | `rgba(255,255,255,.0837)` | `rgba(0,0,0,.0803)` |
| 文字 | `#FFF / #D6D6D6 / #A0A0A0` | `#1B1B1B / #5C5C5C / #8A8A8A` |
| 强调 | `#4CC2FF` | `#0067C0` |
| 圆角 | 控件 4 / 卡片·浮层·对话框·窗口 8 / 胶囊 999 | 同 |
| 字体 | Segoe UI Variable（Selawik 回退）、Cascadia Mono | 同 |
| 尺寸 | 标题栏 40 / 导航 68 / 状态栏 28 / 任务栏 48 / 控件 32 / 设置行 48–56 | 同 |

## 组件

共享类见 `src/styles/w11/primitives.css`：`.w-page .w-page-head .w-title .w-desc .w-actions .w-card
.w-row .w-row-icon .w-row-main .w-row-title .w-row-desc .w-row-control .w-btn(.--accent/--subtle/--icon/--sm/--danger)
.w-search .w-toolbar .w-toolbar-btn .w-bcrumb .w-table .w-tag(.--success/--warning/--danger/--accent)
.w-switch .w-field .w-label .w-hint .w-flyout .w-menu .w-dialog .w-empty .w-avatar .w-sep .w-kbd .w-mono
.w-muted .w-faint .w-skeleton .w-iconbtn .w-facts .w-fact-value`。

antd 由 `ConfigProvider` + `src/styles/w11/antd.css` 二次主题成 Win11 控件（Button 32/4px、输入框底部强调下划线、
Table 40 行高、Modal Acrylic、Switch 40×20、Focus 白/黑环…）。

## 页面配方

- 桌面外壳：`AppShell.tsx`（w-stage → w-window → w-titlebar / w-window-body（w-rail + w-main）/ w-statusbar + w-taskbar）。
- 首页：`HomeDashboard.tsx` + `styles/w11/home.css`（设置主页 + 已固定）。
- 库页：`LibraryView/LibraryTable` + `styles/w11/library.css`（文件资源管理器）。
- 设置/后台：`SettingsPage/AdminPage` + `styles/w11/settings.css`。
- 公开页：`Landing/AuthPage/HelpPage` + `styles/w11/public.css`（Win11 锁屏 / 欢迎页 / 获取帮助）。
- AI/搜索/弹窗：`AIPanel/GlobalSearch/...` + `styles/w11/ai.css`。

## 规则

1. 颜色/尺寸/圆角/阴影只允许 `var(--w-*)`；不得在页面 CSS 写新 hex（状态色除外，须复用 token）。
2. 新页面只使用 primitives 类 + 自己的页面 CSS；不得复制粘贴按钮/卡片/输入框样式。
3. 图标只用 `@fluentui/react-icons`；禁止 emoji 与混用其他图标库。
4. 每个页面同时支持 `[data-theme='dark']`（默认）与 light、1440/1024/768/390。
5. 保留业务逻辑 / props / exports / i18n key / 快捷键；UI 重做不等于重写行为。
