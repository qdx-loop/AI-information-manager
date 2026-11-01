# v9 · Windows 11 原生桌面应用（实现合同）

> 用户指令：**全面**遵循《前端提示词》（`/home/qdx/.dsh/attachments/v1/files/dd/dd7dc6c2973ee186578cd4f871fdde37427c5abc739ee13f6eb9681665469ae4/前端提示词.md`）：
> 所有界面彻底重建，不保留任何旧格式/样式/字体/布局，第一眼必须让人认不出与上一版是同一个东西。
> 本文件是 v9 的唯一实现合同，优先级高于历史 `design-system/*`、旧 `DESIGN.md`、旧 CSS。
> 上一版（v8）全部推翻。

## 0. 技术栈说明

提示词示例栈是 Tauri + Vue3 + Element Plus；本项目既有业务栈是 React 18 + Vite + antd v5 + Fluent UI v9 + Zustand + Dexie。
用户说明「不要顾及技术栈之类的」，因此**只重做 UI 层，不迁移业务栈**：
- 设计语言、材质、布局、动效、组件形态 100% 按提示词与 Win11 原生规范落地。
- antd v5 通过 `ConfigProvider` token + 全局皮肤层（`src/styles/w11/antd.css`）二次主题化成 Win11 控件；
  这等价于提示词要求的「Element Plus 二次主题重构」。
- 图标统一 Fluent System Icons（`@fluentui/react-icons`），禁止 emoji 图标、禁止 lucide 混用。
- 外壳按无边框窗口设计（drag region / 8px 圆角 / Mica / 窗口按钮），未来迁移 Tauri 可直接复用。

## 1. 第一屏（决定成败）

浏览器里打开后，看到的必须是一张「Windows 11 桌面截图」：

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Windows 11 桌面壁纸（低饱和、中性）                 │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  信息管理                                        ─   □   ✕    │  │  ← 40px 标题栏
│  ├──────┬─────────────────────────────────────────────────────────┤  │
│  │ 68px │                                                         │  │
│  │ 图标 │          Mica 内容区：页面标题 / 命令栏 / 卡片            │  │
│  │ 导航 │                                                         │  │
│  │Acryl │                                                         │  │
│  ├──────┴─────────────────────────────────────────────────────────┤  │
│  │  状态栏：本地优先 · 数据在本机 · 4 个库 · 31 条记录              │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  ──────────────────────  Windows 任务栏  ──────────────────────────  │  ← 48px
└──────────────────────────────────────────────────────────────────────┘
```

- **桌面舞台**：`body` 铺满壁纸（`/win11-wallpaper.jpg` 暗色 / `/win11-wallpaper-light.jpg` 亮色），
  窗口浮在桌面上（inset 8px，底部让出任务栏 48px+8px），8px 圆角 + 1px 轮廓 + 柔和窗口阴影。
- **任务栏**：48px Acrylic；居中：Start（Windows 四格标）· 搜索 · 任务视图 · 分隔 · 本应用图标（活动态小横条）
  + 3 个装饰性固定应用图标；右侧托盘：Wi-Fi / 音量 / 电池 + 两行时间日期。任务栏本应用图标点击回首页。
- **窗口**：无边框；`data-tauri-drag-region`；标题栏 40px，左：16px 应用图标 + 「信息管理」12px semibold；
  右：搜索框（220px Win11 搜索框）/ 主题 / 语言 / 账户，再右：三个窗口按钮（46×32，hover 提亮，关闭 hover 红 #C42B1C）。
  标题栏双击 / 最大化按钮切换窗口最大化（inset 归零）；最小化收到任务栏；关闭 = 回到桌面（点任务栏/桌面图标重开）。
- **移动端**：不模拟桌面；全屏窗口 + 48px 标题栏 + 底部 Acrylic 标签栏（56px，4 项）。

## 2. 绝对禁止（反模式黑名单）

`neon` `gradient` `futuristic` `cyber` `tech-ui` `dashboard` —— 以及：蓝紫渐变、大面积渐变、霓虹高饱和、
科技 HUD、网页卡片 Dashboard、Gemini/Web AI 风、玻璃拟态浮光、彩色光晕、粗大阴影、>12px 网页大圆角、
emoji 图标、装饰性编号（01 / ACCOUNT 这类）、英文 kicker / 全大写小标题、Index 式侧边目录。

## 3. 色彩（只允许这些）

### 深色（默认）
- 窗口 Mica：`rgba(32,32,32,.82)` + `blur(60px) saturate(140%)`
- 导航/标题栏 Acrylic：`rgba(32,32,32,.55)` + `blur(30px) saturate(125%)`
- 内容层：`rgba(255,255,255,.0337)`；卡片：`rgba(255,255,255,.0512)`；卡片 hover：`rgba(255,255,255,.0837)`
- 描边：卡片 `rgba(255,255,255,.0698)`；分割线 `rgba(255,255,255,.0837)`
- 文字：`#FFFFFF` / 次级 `#D6D6D6` / 三级 `#A0A0A0` / 禁用 `#6B6B6B`
- 强调：`#4CC2FF`（hover `#6DD0FF`，pressed `#38A9DF`，按钮文字 `#000000`，soft `rgba(76,194,255,.12)`）
- 语义：危险 `#FF99A4`、成功 `#6CCB5F`、警告 `#FCE100`；禁止高饱和紫/蓝。

### 浅色
- 窗口 Mica：`rgba(243,243,243,.86)`；内容层 `rgba(249,249,249,.55)`；卡片 `#FFFFFF`
- 描边 `rgba(0,0,0,.0578)`；分割线 `rgba(0,0,0,.0803)`
- 文字 `#1B1B1B` / `#5C5C5C` / `#8A8A8A` / 禁用 `#B0B0B0`
- 强调 `#0067C0`（hover `#0078D4`，pressed `#005A9E`，文字 `#FFFFFF`）

强调色只允许出现在：主按钮、选中态、焦点环、活动指示、开关开启、少量状态点。其余全部中性色。

## 4. 字体

- UI：`'Segoe UI Variable Text','Segoe UI Variable','Segoe UI',Selawik,-apple-system,'Microsoft YaHei UI','PingFang SC','Noto Sans CJK SC',sans-serif`
- 标题：`'Segoe UI Variable Display','Segoe UI Variable','Segoe UI',Selawik,...`
- 等宽（仅 ID/时间/快捷键）：`'Cascadia Mono','Cascadia Code',Consolas,monospace`
- Selawik（OFL，Segoe 度量兼容）自托管：`public/fonts/selawik-regular.woff`(400) / `selawik-bold.woff`(700)。
- 字阶：caption 12/16、body 14/20、body-lg 16/22、subtitle 20/28、title 28/36、hero 36/44；
  标题 600 semibold；正文 400；出现 700 的地方一律改 600。行高按 Win11；中文回退系统黑体。

## 5. 形状 / 材质 / 动效

- 圆角：控件 4px；卡片/浮层/对话框 8px；窗口 8px；胶囊 999。**禁止 >12px 的卡片壳**。
- 材质：Mica = 长生命周期窗口底层；Acrylic = 导航/标题栏/浮层/对话框；卡片 = CardFill + 1px 描边，不用玻璃高光。
- 阴影：卡片 `0 2px 4px rgba(0,0,0,.24)`；浮层 `0 8px 16px rgba(0,0,0,.4)`；
  对话框 `0 32px 64px rgba(0,0,0,.6)`；窗口 `0 24px 48px rgba(0,0,0,.55)`。短、软、深，不做彩色光。
- 动效：100–200ms `cubic-bezier(.1,.9,.2,1)`；hover 轻微提亮，active 轻微下沉（scale .985 / 亮度），
  页面切换 150ms 淡入 + 8px 位移；禁止弹跳/大位移/长时间；`prefers-reduced-motion` 全部关闭。
- 焦点：`outline: 2px solid var(--w-focus); outline-offset: 2px`（Win11 白/黑双色描边感）。

## 6. 组件规范（共享 primitives 类见 `src/styles/w11/primitives.css`）

- **Button**：高 32；accent = 强调填充 + 反色文字；standard = 卡片底 + 1px 描边；subtle = 透明 hover 提亮；
  icon 16；圆角 4；间距 8。
- **Search**：Win11 系统搜索框：高 32、半透明底、1px 低对比描边、底部强调下划线（focus）、圆角 4。
- **List / 设置行**：行高 48–56；图标 32 圆角 6；标题 14、副文 12 次级；右侧控件（开关/下拉/chevron）；
  hover 提亮；展开器用 Win11 风格（chevron 旋转，无卡片套卡片）。
- **Table（文件资源管理器式）**：命令栏（高 48，图标+文字按钮）；地址/面包屑条（高 32 半透明）；
  表头 12 semibold 次级色、高 32、无底色；行高 40；仅横向分割线；hover 提亮；选中 = 强调 soft + 左侧 3px；
  状态栏显示项数/选择数。禁止大圆角卡片外壳包表格。
- **Dialog**：Acrylic 底 + 8px 圆角 + 1px 描边 + 深阴影；标题 20 semibold；按钮右下；遮罩 Smoke。
- **Flyout/Dropdown/Tooltip**：Acrylic；8px；菜单项 32 高、4 圆角；无彩色悬停（用中性提亮）。
- **Toggle/Switch**：Win11 胶囊开关，40×20，关闭时描边+滑块，开启时强调色。
- **Tab / Pivot**：文字 14，选中强调下划线 3px，无胶囊底。
- **Empty**：Fluent 线性图标 48 + 标题 16 semibold + 说明 13 + 主操作按钮；居中留白。
- **Scrollbar**：8px 细滚动条，圆角，半透明中性。

## 7. 布局骨架

- 左导航：**68px** 宽（60–72 范围），Acrylic；图标 20px 居中，48×48 命中区，仅 hover/focus 显示文字
  （Tooltip 在右侧弹出，含名称）；选中 = 中性提亮底 + 左侧 3px 强调条；库项 = 32×32 圆角 8 强调 soft 底 +
  Folder 图标（不再用「首字」方块），hover 右侧出现「更多」菜单（重命名/分类/新建子库/删除/上下移），
  支持拖拽排序；底部：AI 助手（Sparkle）、回收站、设置、帮助、账户头像。
- 内容区：Mica 内容层；页面左右 padding 28–32；最大宽 1200–1360（表格页可全宽）；
  页头 = 标题 28/36 semibold + 一行说明 + 右侧命令按钮；页面之间只用留白与分割线，不用卡片套卡片。
- 状态栏：窗口底部 28px，左侧「本地优先 · 数据存储在本机」/ 右侧「N 个管理库 · M 条记录 · 已同步/离线」。

## 8. 逐页要求

### 首页（HomeDashboard / EmptyHome）
Win11「设置 + 开始」混合，但**不是**旧版结构：
- 页头：56px 头像 + 「晚上好，{user}」标题 28 + 日期/本地优先说明；右侧主按钮「新建管理库」+ 次级「AI 助手」。
- 「已固定」：库磁贴网格（3–4 列，Win11 Start 风格），每块 = 32px 图标 + 库名 + 「N 条 · 分类」+ 打开箭头；
  最后一块「新建管理库」（虚线/layer 底）。无渐变、无大色块。
- 左 2/3：「最近修改」设置式列表（图标 + 条目名 + 库名 · 时间 + chevron），6 行；
  下方「快速设置」卡片行（主题、语言、云同步状态、备份导出）用 Win11 设置行 + 开关。
- 右 1/3：「AI 助手」卡片（Sparkle 图标 + 说明 + 「打开 AI」按钮）；「数据概览」（库数/记录数/本周新增，
  三行设置式，不用 KPI 大数字配色）；「回收站」行。
- EmptyHome：Win11「开始使用」页——欢迎标题 + 三步设置行（新建库 / 模板 / 导入备份）+ 主按钮，无遮罩教程。

### 库页（LibraryView / LibraryTable / 编辑器等）
- 文件资源管理器式：命令栏（新建 / 导入 / 导出 / 模板 / 字段 / 更多）；面包屑地址条；筛选搜索框 + 视图/排序；
  表格；底部状态栏（共 N 项 · 已选 0 项 · 每页 20）。
- 行内：pin 星、主字段 semibold、select 字段用 Win11 中性 tag（语义点 + 文字）、数字 tabular-nums、空值「—」。
- 编辑器 / 模板 / 导入导出 / 回收站 / 建库对话框 / 移动端库选择：全部改成 Win11 对话框、设置行、命令栏风格；
  保留全部字段类型、校验、快捷键、拖拽、批量操作与业务逻辑。

### 设置（SettingsPage）
Win11「设置」应用：页头「设置」；左侧 208px 分类列表（设置卡片 + 选中项左侧 3px 强调条，
分类：账户与安全 / AI 助手 / 备份与恢复 / 多设备同步 / 高级·云端存储 / 关于与支持）；右侧内容区
Win11 设置卡片：每卡片 = 组标题 + 若干设置行（图标 + 标题 + 说明 + 右侧控件/chevron/开关）。
全部旧「01 / ACCOUNT」式编号、英文 kicker 删除。

### 登录 / 注册（AuthPage）
Windows 11 锁屏 / 登录体验：整页壁纸 + 压暗；左上时间大字 + 日期；中央偏左或居中 Acrylic 登录面板：
应用图标 + 「信息管理」+ 用户名输入 + 密码输入 + 登录（accent 全宽）+ 注册切换（Win11 Pivot/Tab）；
错误提示在输入框附近；记住登录用 Win11 checkbox；底部小字「数据存储在本机 · 本地优先」。
注册页同构，字段增加确认密码/联系方式，密码规则提示放在字段下方。

### 落地页（Landing）
Win11 应用「欢迎 / 商店详情」气质：窗口舞台 + 大号标题 + 一句话价值 + 主 CTA（免费开始使用）/ 登录；
功能 = 3 个 Win11 设置卡片；「数据归你」= 设置行式说明；FAQ = Win11 Expander；页脚低调；
禁止营销大渐变、禁止巨幅英文标语、禁止截图乱贴（可用 public/hero-table.png 的新版截图）。

### 帮助（HelpPage）
Win11「获取帮助」：大标题 + 搜索框；主题卡片（开始使用 / AI / 同步备份 / 账户）；FAQ Win11 Expander；
文档正文用 14/20 行高、标题 20 semibold；顶部返回应用按钮。

### 管理后台（AdminPage）
Win11「系统信息 / 任务管理器」：登录 = 居中 Acrylic 小窗（密码 + 进入后台）；控制台 = 页头 + 事实条
（账户数/条目数/今日新增）+ 搜索 + 账户设置式表格（行高 48）+ 行操作（停用/重置密码/删除，Win11 危险色）。

### AI（AIPanel / ChartModal / ConfirmActionModal）
Copilot 侧栏：右 400px Acrylic；头部 = Sparkle + 「AI 助手」+ 清空/收起；会话 = 用户气泡 accentsoft + 助手透明底 + 分隔；
工具确认 = Win11 卡片（图标 + 说明 + 允许/取消）；底部 composer = Win11 输入框 + accent 发送按钮 + 快捷键提示；
快捷动作 = Win11 中性 chip。图表弹窗 = Win11 对话框 + 白底图表容器。

### 欢迎 / 赞赏（WelcomeModal / RewardCard / RewardQr / SupportLink）
Win11 内容对话框：Acrylic、8px、标题 20、QR 白底圆角 4、说明 12 次级、按钮右下；
文案/状态机/赞赏逻辑不变。

### 移动端
390px：全屏；48px 标题栏（汉堡/标题/搜索）；内容单列；底部 Acrylic 标签栏；
页头标题 24/32；表格转卡片列表（保留字段渲染逻辑）；AI 为全屏 sheet。

## 9. 共享 CSS 类（必须复用，禁止各自发明按钮/卡片/输入框）

`src/styles/w11/primitives.css` 提供：`.w-page` `.w-page-head` `.w-title` `.w-subtitle` `.w-desc` `.w-actions`
`.w-card` `.w-card-head` `.w-row` `.w-row-icon` `.w-row-main` `.w-row-title` `.w-row-desc` `.w-row-control`
`.w-btn` `.w-btn--accent` `.w-btn--subtle` `.w-btn--icon` `.w-btn--sm` `.w-btn--danger`
`.w-search` `.w-toolbar` `.w-toolbar-btn` `.w-bcrumb` `.w-table` `.w-tag` `.w-tag--success|warning|danger|accent`
`.w-switch` `.w-field` `.w-label` `.w-hint` `.w-flyout` `.w-dialog` `.w-empty` `.w-avatar` `.w-sep`
`.w-kbd` `.w-scroll` `.w-mono` `.w-muted` `.w-faint` `.w-skeleton` `.w-iconbtn`。

页面级 CSS 文件各自拥有：
- `home.css`（Lead）
- `library.css`（A）
- `public.css`（B：landing / auth / help / 欢迎 / 赞赏）
- `settings.css`（C：设置 / 后台）
- `ai.css`（C：AI 面板 / 图表 / 确认弹窗 / 全局搜索）
`index.css` 只做 `@import`，任何人不得往 `index.css` 里加页面样式。

## 10. 约束

- 保留所有 props/exports/路由/hooks/业务逻辑/校验/快捷键/i18n key；只改 UI。
- 不改 `src/db/**`、`src/utils/**`、`src/store/**`、`src/ai/**`、`src/i18n/**`（Lead 统一改文案时除外）。
- 不新增依赖；图标只用 `@fluentui/react-icons`（已有）。
- 每个组件同时适配 `[data-theme='dark']`（默认）与 light；响应式 1440 / 1024 / 768 / 390。
- 验收：`npx tsc -b`、`npx eslint src functions`、`npx vitest run`、`npm run build` 全绿；
  截图：1440×900 明暗 + 390×844 移动 + 所有页面；第一眼必须是 Win11 原生应用，不是网页。
