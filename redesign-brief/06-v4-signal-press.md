# v4 全盘重设计合同 · 硬边印刷 SIGNAL PRESS

> 用户指令（2026-11-01）：**使用 ui-ux-pro-max skill，不再参考 v2 官纸账簿 / v3 石墨信号的任何设计模式，全盘重新设计。**
> 本文件是唯一实现合同：tokens、class、组件、逐页结构、动效、验收标准。
> skill 产出：`design-system/signal-press/MASTER.md`（Style: Brutalism；Typography: Outfit + Work Sans；dials: variance 8 / motion 5 / density 7）。
> 本文件对 MASTER 做**项目覆盖**（配色、圆角 0、硬阴影、逐页结构），覆盖原因写在 §10；MASTER 中通用 checklist 仍然有效。
> 分支：`feat/v4-signal-press`（不要切换/commit/push）。

---

## 0. 方向一句话

**「硬边印刷」SIGNAL PRESS**：把数据工作台做成一张有版面的印刷品——骨白纸底、纯黑硬边、荧光黄绿（lime）作信号色、零圆角、硬投影、超大几何无衬线标题、等宽小标签、Bento 非对称栅格、按压有物理位移。**完全不沿用** v3 的白卡浮起/细线/靛蓝/8–12 圆角/柔和阴影，也不沿用 v2 的纸感/衬线/朱砂。

设计依据（skill 搜索，需在实现中遵守）：
- Style = **Brutalism**（关键词：raw、stark、high contrast、visible borders、asymmetric、anti-design；效果：sharp corners 0px、bold typography 700+、visible grid、large blocks）
- Layout = **Bento Box Grid**（varied spans、asymmetric grid、modular cards）
- 纪律 = **Swiss/International**（12 列栅格、严格层级、数字与标签分类、留白节奏）
- Typography = **Outfit + Work Sans**（OFL，自托管；latin 子集）；中文回退系统黑体
- Motion = Stagger List（一次性、300–450ms、`back.out(1.4)`，**只用于 bento 卡片首次出现**；表格与数据行禁用 overshoot）
- Dials: Variance 8（bold/asymmetric）· Motion 5（standard）· Density 7（standard/dense workbench）

---

## 1. 颜色（已用 WCAG 实测，勿改数值）

### Light
| token | 值 | 用途 | 对比 |
|---|---|---|---|
| `--paper` | `#ECE9E0` | 页面画布（骨白） | — |
| `--sheet` | `#FFFEF9` | 卡片/表格/弹窗面 | — |
| `--panel` | `#F5F2E8` | 表头/输入内嵌/次级面 | — |
| `--ink` | `#141412` | 文字/结构线/黑块 | 15.19:1 on paper |
| `--ink-soft` | `#57544B` | 次要文字 | 6.23:1 |
| `--ink-faint` | `#676358` | 注脚/占位（≥12px） | 4.94:1 |
| `--line` | `#141412` | 2px 结构边（卡片/输入/按钮） | 15.19:1 |
| `--line-soft` | `#C9C4B5` | 1px 行线/分隔 | 装饰性 |
| `--lime` | `#D4FF3F` | 品牌信号：选中、主按钮、高亮块 | ink on lime 15.96:1 |
| `--lime-hover` | `#C3EF2B` | 主按钮 hover | — |
| `--lime-wash` | `#F4FFCE` | 选中行/焦点底 | — |
| `--signal` | `#FF5A1F` | 提醒/焦点环/强调数字 | ink on signal 5.91:1 |
| `--danger` | `#C22A1C` | 危险文字/危险按钮底 | white 5.71:1 |
| `--danger-wash` | `#FBE3DE` | 危险底 | — |
| `--success` | `#1B7A43` | 成功 | white 5.32:1 |
| `--success-wash` | `#DFF3E7` | 成功底 | — |
| `--warning` | `#8A5A00` | 警告文字 | — |
| `--warning-wash` | `#F8EACB` | 警告底 | — |
| `--on-lime` / `--on-ink` | `#141412` / `#F5F3E9` | 反白 | — |

### Dark
`--paper #101010`、`--sheet #181817`、`--panel #21211F`、`--ink #F5F3E9`、`--ink-soft #BDB9AC`、`--ink-faint #938F83`、`--line #F5F3E9`、`--line-soft #3A3A33`、`--lime #D4FF3F`、`--signal #FF7A45`、`--danger #FF6B5A`（填充仍用 `#C22A1C` 白字）、`--success #6BD39A`、`--warning #F0B429`、`--on-lime #141412`。
暗色下硬阴影颜色用 `--shadow-ink: #000000`（不可见也没关系，结构由 2px 边承担）；lime 元素保持 lime。

> 禁止：渐变、模糊阴影、玻璃拟态、彩色柔光、用 lime 做小号正文（lime 只做底/线/块）、用 signal 做正文小字（只做 ≥14px 强调或底）。

---

## 2. 字体

- Display：**Outfit**（`public/fonts/outfit-var.woff2`，自托管，100–900 variable）；标题/大数字/按钮/导航。
- Body：**Work Sans**（`public/fonts/work-sans-var.woff2`，自托管，100–900 variable）；正文/表格/表单/长文。
- Mono：系统等宽 `ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas...`；只用于 kicker/编号/ID/时间/快捷键/小标签，中文不进等宽。
- 中文回退：`'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif`。
- 字阶（8 档 + 2 展示档）：`--t-2xs 11 / 1.3`、`--t-xs 12 / 1.35`、`--t-sm 13 / 1.45`、`--t-base 15 / 1.6`、`--t-md 17 / 1.6`、`--t-lg 20 / 1.3`、`--t-xl 24 / 1.2`、`--t-2xl 32 / 1.15`、`--t-3xl 40 / 1.05`、`--t-4xl 56 / 0.98`、`--t-5xl 72 / 0.95`。
- 字重只用 400/500/600/700/800；正文 400，UI 500–600，标题 700–800；**禁止 900 以下的伪粗/描边字**。
- 标题字距 `-0.02em ~ -0.035em`（拉丁）；中文 0；kicker/小标签大写拉丁 `+0.08em`。
- 数字一律 `font-variant-numeric: tabular-nums`。

---

## 3. 尺寸 / 圆角 / 边 / 阴影 / 动效

- 空间：`--s1 4` … `--s10 64`（4/8/12/16/20/24/32/40/48/64/80）；页面 12 列栅格，gap 16。
- 圆角：**0**（`--r-0:0`）；仅输入/小标签允许 2px（`--r-1:2px`）；999 只允许状态点/头像。
- 边：结构 `--bw 2px solid var(--line)`；行线 `1px solid var(--line-soft)`；表格表头底边 2px ink。
- 阴影（硬投影，无模糊）：`--shadow-1: 2px 2px 0 var(--shadow-ink)`；`--shadow-2: 4px 4px 0 var(--shadow-ink)`；`--shadow-3: 8px 8px 0 var(--shadow-ink)`；按压 `--shadow-press: 1px 1px 0`。
- 交互位移：hover `translate(-2px,-2px)` + 阴影升一级；active `translate(1px,1px)` + 阴影降为 press；**只用于卡片/按钮，不用于表格行**。
- 动效时长：`80ms`（颜色/边框）、`140ms`（按压/位移）、`220ms`（弹窗/抽屉）；bento 首次出现 320–450ms stagger（`back.out(1.4)`，仅首屏、只一次）；`prefers-reduced-motion` 全关。
- 尺寸：topbar 64 / 左栏 264 / 控件 40（sm 32 / lg 48）/ 表格行 40 / 表头 44 / 标签 32 / AI 面板 400 / 内容最大 1440 / 手机底栏 60 + 安全区。

---

## 4. CSS 变量清单（main.tsx 注入，组件只消费这些）

```
--paper --sheet --panel --ink --ink-soft --ink-faint
--line --line-soft --lime --lime-hover --lime-wash --signal
--danger --danger-wash --success --success-wash --warning --warning-wash
--on-lime --on-ink --focus
--font-display --font-body --font-mono
--t-2xs --t-xs --t-sm --t-base --t-md --t-lg --t-xl --t-2xl --t-3xl --t-4xl --t-5xl
--s1 --s2 --s3 --s4 --s5 --s6 --s7 --s8 --s9 --s10
--r-0 --r-1 --r-pill
--bw
--shadow-1 --shadow-2 --shadow-3 --shadow-press --shadow-ink
--topbar-h --rail-w --control-h --control-h-sm --control-h-lg
--row-h --table-head-h --content-max --ai-w --mobile-tabs-h
--chart-1 .. --chart-5
```
（旧 `--app-*`、`--text-*`、`--space-*` 会保留过渡映射，但**新代码禁止引用**，自检 grep 必须为 0。）

---

## 5. 工具 class（全部由 Lead 在 `src/styles/index.css` 实现；页面直接用）

### 骨架/页面
`workbench`（页面根：max 1440、margin auto、padding `28px 36px 48px`；≤1024 `24px`；≤768 `16px 16px 32px`）
`workbench--wide`（去掉 max-width 限制）
`page-head` `page-head-main` `page-head-actions`
`page-kicker`（mono 11 / uppercase / +0.08em / ink-faint / 前面 8px lime 方块）
`page-title`（Outfit 800 / clamp(30px,3.4vw,40px) / -0.03em / line-height 1.02）
`page-sub`（Work Sans 15 / ink-soft / max 62ch）
`count-chip`（inline-flex / h 26 / padding 0 8 / lime 底 + 2px ink 边 / mono 12 700）
`page-bar`（页头下 2px ink 分隔）
`hard-rule`（h2 ink）/ `rule`（1px line-soft）/ `divider`（1px line-soft，margin 24 0）

### 卡片/Bento
`bento`（grid 12 cols / gap 16 / align stretch）
`tile`（sheet 底 / 2px ink 边 / shadow-1 / padding 20 / min-width 0）
`tile--lime`（lime 底 + ink 字）/ `tile--ink`（ink 底 + `--on-ink` 字，可用 lime 强调）/ `tile--panel`（panel 底）
`tile--hover`（可点击：hover 位移 + shadow-2）
`tile--span-3/4/5/6/7/8/9/12`、`tile--row-2`
`tile-head`（flex between / mono 11 uppercase / padding-bottom 12 / border-bottom 1px line-soft）
`metric` `metric-label`（mono 11 uppercase ink-soft）`metric-value`（Outfit 800 56 / tabular / -0.03em）`metric-note`（Work Sans 13 ink-soft）`metric-delta`（mono 12；up=success，down=danger）
`panel`（sheet + 2px ink + shadow-1）`panel-head`（padding 14 16 / border-bottom 2px ink / flex between）`panel-title`（Outfit 700 18）`panel-kicker`（mono 11）`panel-body`（padding 16）`panel--flush`（body 无 padding）
`sheet`（同 panel，无 head 时用）

### 列表/索引
`index-list`（panel 包裹）/ `index-row`（min-h 48 / padding 10 16 / border-bottom 1px line-soft / last 无 / hover lime-wash / cursor pointer）
`index-num`（mono 11 / ink-faint / width 28）/ `index-main`（flex column gap 2 min-width 0）/ `index-title`（600 14）/ `index-meta`（12 ink-soft，省略号）
`dash-list`（用于待办：行 44，左日期 mono 12 + 标题 500 + 库/字段 12 ink-soft + 右侧状态）

### 工具条 / 表格
`toolbar`（flex wrap gap 8 / min-h 40 / margin-bottom 16）/ `toolbar-group` / `toolbar-spacer`
`data-table`（sheet 底 + 2px ink 边 + shadow-1 + overflow hidden；内部 antd 表头黑底）
`table-count`（mono 12 ink-soft）
`status-pill`（inline-flex h 22 / padding 0 8 / 1.5px ink 边 / 2px 圆角 / mono 11 700 / uppercase / 6px 方块 dot / 变体 `.is-success/.is-warning/.is-danger/.is-lime/.is-neutral`）
`tag-mono`（mono 10–11 / uppercase / +0.06em / 1px line-soft 边 / padding 1 6）
`num` `tabular` `mono` `align-num` `align-date`（同语义）

### 表单 / 空态 / 其它
`form-grid`（2 列 gap 16；≤640 1 列）/ `field-label`（mono 11 uppercase + 必填 lime 方块）/ `field-hint`（12 ink-soft）
`empty-state`（居中 padding 48 24）/ `empty-mark`（56×56 lime 底 + 2px ink 边 + shadow-1 + Outfit 800 24 或图标 24）/ `empty-title`（Outfit 700 24）/ `empty-body`（15 ink-soft max 52ch）/ `empty-actions`（flex gap 8 justify-center）
`icon-btn`（40×40 / 2px transparent 边 / hover panel 底 + ink 边 / active lime-wash / focus ring）
`kbd`（mono 10 / 1px line-soft 边 / 2px 圆角 / padding 0 4）
`danger-text` `muted` `faint` `link-quiet`

### 外壳
`app-shell`（flex row / height 100dvh / paper 底）
`app-rail`（宽 264 / ink 底 / `--on-ink` 字 / flex column / height 100% / overflow hidden；暗色仍 ink 底）
`rail-brand`（padding 20 16 / Outfit 800 18 / lime 方块标 12px + 名称 / 底部 1px rgba(245,243,233,.18)）
`rail-group`（padding 14 16 6 / mono 10 uppercase `rgba(245,243,233,.45)` / +0.1em）
`rail-item`（h 38 / margin 2 8 / padding 0 10 / flex gap 10 / 0 圆角 / `rgba(245,243,233,.78)` / hover rgba(255,255,255,.08) / active lime 底 + ink 字 + 700）
`rail-item .anticon`（16）
`rail-lib`（h 34 / 缩进 / 12.5px / 同 hover；active 左侧 3px lime + lime 字）
`rail-foot`（margin-top auto / border-top 1px rgba(...,.18) / padding 12）
`app-main`（flex 1 / flex column / min-width 0）
`app-topbar`（h 64 / paper 底 / border-bottom 2px ink / flex / padding 0 24 / gap 16）
`topbar-breadcrumb`（mono 12 / ink-soft / 当前项 ink 600）
`topbar-search`（h 36 / min-w 240 / sheet 底 / 2px ink 边 / padding 0 10 / flex gap 8 / 12px / hover shadow-1）
`topbar-actions`（flex gap 4）
`app-content`（flex 1 / overflow auto / paper 底）
`mobile-tabs`（仅 ≤768：fixed bottom / h 60+env / ink 底 / 顶边 2px ink / 4–5 item）
`mobile-tab`（flex column / gap 2 / `rgba(245,243,233,.55)` / active lime / 11px 600）

### AI
`ai-host`（docked：sheet 底 + 左 2px ink 边；sheet 模式：fixed bottom 圆角 0）
`ai-dock-head`（h 56 / ink 底 / on-ink 字 / 2px 底边 lime / padding 0 12 0 16）
`ai-dock-title`（Outfit 700 16）/ `ai-mono-mark`（mono 10 / lime 边 / lime 字 / padding 0 4）
`ai-dock-body` `ai-panel-loading`
`ai-fab`（52×52 方块 / lime 底 / 2px ink 边 / shadow-2 / Outfit 800 16 "AI"；hover 位移；≤768 放底部标签栏上方 12px）
`ai-sheet-peek`（h 40 / sheet + 2px ink + shadow-2 / mono 11）
`ai-md`（Work Sans 15 / 1.65 / ink；代码块 panel + 1px line；表头 ink 底）
`clerk-run`（h 3 / lime / 静态 40%）

### 弹层
无 `.surface-card`；弹窗统一 antd Modal（全局 CSS 硬边）；欢迎卡内 QR 卡面固定 `#FFFFFF`（扫码需要白底）。
`welcome-actions`（flex 右对齐；≤520 列 + 全宽）
`menu-sheet`（如需要自定义浮层：sheet + 2px ink + shadow-3）

### 落地页 / 登录（Lead 会实现这些 class，frontend 重排结构）
`lp-page`（paper 底 / ink 字 / 固定浅色）
`lp-container`（max 1360 / padding 0 40；≤860 0 20）
`lp-nav`（h 72 / border-bottom 2px ink / flex / sticky / paper 底）
`lp-brand` `lp-brand-mark`（14 lime 方块 + 2px ink 边）
`lp-nav-links` `lp-nav-link`（mono 11 uppercase / hover lime-wash + ink 边）
`lp-nav-cta`
`lp-hero`（grid 12 / gap 24 / padding 72 0 56 / border-bottom 2px ink）
`lp-hero-copy`（span 7）/ `lp-hero-visual`（span 5）
`lp-kicker`（mono 11 uppercase + lime 方块）
`lp-display`（Outfit 800 / clamp(44px,6.2vw,88px) / line-height .94 / -0.04em；允许 `<em>` 用 lime 底 ink 字，不倾斜）
`lp-lede`（Work Sans 17 / ink-soft / max 46ch）
`lp-cta-row` `lp-btn` `lp-btn--primary`（lime + ink 边 + shadow-2）/ `lp-btn--ghost`（sheet + ink 边 + shadow-1）
`lp-marquee`（lime 底 + 上下 2px ink；内容重复 mono 12 uppercase，CSS 平移 24s linear infinite；reduced-motion 停）
`lp-section`（padding 72 0 / border-bottom 2px ink）
`lp-section-head`（grid 12：左侧 index + 标题，右侧说明）
`lp-index`（mono 11 / `0I` 编号）
`lp-h2`（Outfit 800 40 / -0.03em）
`lp-feature-row`（grid 64px 1fr 1.1fr / gap 24 / padding 24 0 / border-top 1px line-soft；最后 border-bottom）
`lp-feature-title`（Outfit 700 20）/ `lp-feature-body`（15 ink-soft）
`lp-deep`（ink 底 / on-ink 字 / padding 80 0 / lime kicker）
`lp-faq`（max 960 / border-top 2px ink）`lp-faq-item`（grid 48 1fr / padding 20 0 / border-bottom 1px line-soft）
`lp-footer`（ink 底 / on-ink / padding 48 0 28）
`lp-wordmark`（Outfit 800 clamp(48px,10vw,140px) / lime / line-height .8 / 无下划线）
`auth-page`（min-h 100dvh / grid 5fr 6fr；≤960 单列）
`auth-poster`（ink 底 / on-ink / padding 64 / flex column justify-between；lime 几何标 + Outfit 800 56 标题 + mono 注脚）
`auth-form-side`（paper 底 / flex center / padding 32 20）
`auth-card`（w 400 / max 100% / sheet / 2px ink / shadow-3 / padding 28；≤480 无阴影仍 2px 边）
`auth-brand` `auth-foot`

---

## 6. antd 全局收编（Lead 负责，页面不重复写）

- **Button**：h 40 / 0–2px 圆角 / 600 字重 / 2px ink 边 / 无默认阴影；primary = lime 底 + ink 字 + shadow-1，hover `translate(-1px,-1px)` + shadow-2，active `translate(1px,1px)` + press；default = sheet 底 + ink 边 + shadow-1；text = ink-soft，hover lime-wash；danger = danger 底 + 白字；disabled 降透明度、无位移。
- **Input/InputNumber/Select/DatePicker**：h 40 / 2px ink 边 / sheet 底 / 0–2px 圆角 / focus 时 ink 边 + `box-shadow: 0 0 0 3px var(--lime)`；placeholder ink-faint；错误 danger 边 + 下方 12px danger 文案。
- **Table**：容器 `.data-table`；表头 ink 底 + on-ink 字 + mono 11 uppercase + 44 高；行 40；行线 1px line-soft；hover lime-wash；选中 lime-wash + 左侧 3px ink；数字右对齐 tabular；pagination 方形按钮（active lime）。
- **Modal/Drawer**：2px ink 边 / shadow-3 / 0 圆角 / 遮罩 `rgba(20,20,18,.5)`；标题 Outfit 700 24；头部下 2px ink 线；footer 按钮右对齐；移动端宽度 calc(100vw-24px)。
- **Dropdown/Popover/Select 面板**：sheet + 2px ink + shadow-2 / 0 圆角 / 选项 hover lime-wash / 选中 lime 左条。
- **Tabs**：底边 1px ink；选中 3px lime 下划线 + ink 600；未选 ink-soft。
- **Tag/Badge**：2px 圆角 + 1px ink 边 + panel 底 + mono 11；状态色仅用 wash。
- **Alert**：sheet + 2px ink + 左侧 6px 色条（info lime / warning warning / error danger）+ 无圆角。
- **Message/Notification**：sheet + 2px ink + shadow-2 + Outfit 600 标题。
- **Checkbox/Radio/Switch**：选中 ink 底 + lime 勾/点；Switch 选中 lime 底 + ink 手柄。
- **Pagination**：方形 32 / ink 边 / active lime。
- **Progress**：3px 高 / lime 填充 / ink 轨。
- **Segmented**：panel 轨道 + sheet 选中 + 2px ink 边。
- **Tooltip**：ink 底 + on-ink 字 + 0 圆角 + mono 11。
- **Upload drag**：panel 底 + 2px dashed ink；hover lime-wash。
- **Empty**：用页面 `.empty-state`，antd 默认空态尽量不出现。

---

## 7. 应用外壳（Lead 负责，其他人不要改）

- 桌面：左 **264px 墨黑 rail**（品牌 → 主导航 → 库列表 → 工具 → 用户/退出），右侧列 = **64px 纸色 topbar**（面包屑/页面位置 + 搜索 + 主题/语言/头像）+ **可滚动画布**；AI 打开时右侧再停靠 400px。
- 移动：无 rail；topbar = 菜单 + 品牌 + 搜索 + 头像；底部 **60px 墨黑 tab bar**（4 个：首页/库/AI/设置），`env(safe-area-inset-bottom)`。
- rail 选中：lime 整块 + ink 字 + 700；hover 半透明白；库项 active 左侧 3px lime。
- 用户区在 rail 底部，显示用户名 + 退出（不可用下拉就行）。
- 圆角 0、硬边、无浮起白卡；所有页面内容必须在 `workbench` 容器内。

---

## 8. 逐页要求（结构必须按此重排，不是只换色）

### 8.1 首页 HomeDashboard（library-pages）
- 页头：kicker `DASHBOARD / 今日` + `page-title`（“早上好，{name}” 或 “工作台”）+ `page-sub`（日期 + 一句话）+ 右侧墨黑/lime 主操作「新建管理库」。
- **Bento 12 列**（gap 16）：
  - 左 7 列：`tile tile--lime` 大数字「总条目」`metric-value` 56–72；下面一行 3 个小指标（本周新增/管理库/待办临期）用 `tile--panel` 小 tile（各占 4 列，共 12 列第二行）。
  - 右 5 列：`tile--ink` “今日简报”：3 行（待办 N / 逾期 N / 最近同步），lime 数字 + on-ink 文字；底部一个 lime 方块按钮「打开 AI」。
  - 第三行：左 7 列 `panel`「待办与临期」`dash-list`（行 44：mono 日期 + 标题 + 库/字段 + 状态 pill）；右 5 列 `panel`「最近动态」`index-row`（最多 6 条，`index-num` 01..）。
  - 第四行：右 5 列底部放「快捷入口」`index-row`（模板中心/回收站/使用帮助），左 7 列空或放一条 `hard-rule` 注释。
- 空态：无库时 bento 仍在，但用 `empty-state` 占满主 tile（lime 方块图形 + “从第一本管理库开始” + 主按钮），不得出现新手清单。
- 错误态：panel 内 `empty-state` + 重试按钮。
- 移动：单列，tile 全宽；大数字缩小到 40；墨黑 tile 放到待办之后。

### 8.2 库页 LibraryView / LibraryTable（library-pages）
- 页头：kicker `LIBRARY / 库` + 标题（库名 40/800）+ `count-chip`「12 条」+ 右侧：新建主按钮 + 更多（Dropdown）。
- 工具条：一行 40 高，左组：搜索框（240）+ 筛选字段/值 + 排序；右组：模板/复用/导入/导出；最右主按钮「+ 新建」。全部按钮 40 高、2px ink 边。
- 表格：`.data-table`；表头 ink 底、on-ink mono 11 uppercase；行 40；首列标识 600；数字右对齐；状态 `.status-pill`；收藏用 Outlined Star（inactive ink-faint，active ink + lime 底）；操作列 hover 才显示（图标按钮 32 方形）。
- 空态：panel + `empty-state`（`empty-mark` lime 方块 + “还没有数据” + 主按钮 + 次按钮导入）。
- 移动：库页卡 = sheet + 2px ink + shadow-1；字段两列网格；顶部搜索/筛选收进工具条（可纵向）；分页简化。
- 行高保持 40；不要 hover 位移表格行；只换背景 lime-wash。

### 8.3 ItemEditor / 模板 / 导入导出 / 回收站 / 新建库（library-pages）
- ItemEditor：antd Modal 760 / 0 圆角 / 2px ink / shadow-3；标题区：mono `EDIT / 编辑条目` + Outfit 800 24 标题；body 内滚；字段两列 `form-grid`；sticky footer：左「删除」danger text，右「取消」ghost +「保存」lime primary；日历/并发逻辑不变。
- TemplateCenter：左侧模板列表 = panel + `index-row`（选中 lime-wash + 3px ink 左条 + 右侧字段数 mono）；右侧预览 = sheet + 2px ink + “页面”网格；主按钮。
- TemplateEditor：行 40；拖拽插入线 3px lime；字段芯片用 `tag-mono`；无缩放动画。
- ImportExport：三步步骤条 = 三个方形编号块（当前 lime 底 ink 边，完成 ink 底 on-ink，未开始 panel）+ 连线 2px ink；拖拽区 = panel + 2px dashed ink + hover lime-wash；映射表用 data-table；完成态大 lime 方块 + 数字。
- TrashBin：页头 + `.data-table`；剩余天数 `.status-pill`（≤3 warning / 其他 neutral）；恢复/永久删除 Popconfirm。
- CreateLibraryDialog / LibraryPickerSheet：Modal 520 / 0 圆角 / 2px ink；输入 40；选中行 lime-wash + 3px ink 左条。

### 8.4 设置 SettingsPage（frontend-analyst）
- 页头 kicker `SETTINGS / 偏好` + 标题「设置」+ 说明。
- 桌面两列：左 **编号索引**（panel，行 44）`01 账户与安全 / 02 AI 助手 / 03 备份与恢复 / 04 多设备同步 / 05 高级 · 云端存储 / 06 关于与支持`；选中行 lime 底 + ink 字 + 左侧 4px ink；不要与 rail 双重高亮（rail 可以仍选中“设置”，但目录用 lime 区分）。
- 右侧每节 = `panel`（2px ink + shadow-1）+ `panel-head`（mono kicker + Outfit 700 20 标题 + 说明）+ `panel-body` 表单；组间 24px。
- 危险区 = panel + `--danger-wash` 底 + 2px danger 边 + 标题 danger + 说明 + danger 按钮。
- 关于与支持 = RewardCard 嵌入，二维码白卡固定白底。
- 移动：Tabs 方块化（lime 选中），单列。
- `?tab=support` 保留；导出成功仍调 noteBackupExported；所有功能一个不删。

### 8.5 AI 面板（ai-analyst）
- 停靠 400px：墨黑头部 56（lime 底边 2px）：`AI` mono 方块 + 「AI 助手」Outfit 700 16 + 状态点 + 右侧会话/清空图标（on-ink）。
- 主体 paper/sheet：用户消息 = lime-wash 底 + 2px ink 边 + 0 圆角 + 右对齐块（最多 85%）；AI 输出无底色 Work Sans 15/1.65，段落 10；工具步骤 = mono 11 折叠行（chevron），展开为 01/02/03 编号；thinking 仍不渲染。
- 运行中：顶部 3px lime 静态条 + mono 12「正在核对…」；空/未配置 = `empty-state` + lime 方块 + 主按钮「去配置」。
- 输入区：sheet 底 + 顶边 2px ink；输入 40（2px ink 边）；发送 = 40×40 lime 方块 + ink 边 + 图标；附件 40 方形 ghost。
- 图表缩略：panel + 2px ink；图注 mono 11。
- ConfirmActionModal / ConfirmLibActionModal：440，0 圆角，2px ink，标题 Outfit 700 20，正文 15，按钮右对齐；保留被删条目快照与 autoConfirm 细粒度。
- ChartModal：840，sheet，2px ink，shadow-3；标题 Outfit 700 24 + mono kicker；图表区白底；网格线 line-soft；图例无底；animation:false；footer mono 11「数据来源 · 生成时间」。

### 8.6 登录/注册（frontend-analyst）
- 桌面 `auth-page` 两栏 5fr/6fr：左侧 **ink 海报**：lime 几何标 + `lp-index`「SIGNAL PRESS」+ Outfit 800 48–56 标题（“把数据 / 管成版面。”或产品主标）+ 3 条 mono 说明 + 底部 mono 版权；右侧 paper 画布上 400px `auth-card`（2px ink + shadow-3 + 0 圆角 + 28 padding）。
- 品牌只出现一次（左海报即品牌）；表单标签可见；输入 40；主按钮 lime 全宽 48；注册/登录 Tabs 方块化；Turnstile 未就绪仅点击时提示（不占 65px 空洞）；注册成功 `markWelcomePending()` 后 navigate（保留）；删注册成功 toast。
- 移动：单列；海报缩成顶部 40vh 或只保留 kicker+标题（不隐藏表单）；卡片无阴影但保留 2px 边。

### 8.7 落地页 Landing（frontend-analyst）
- 用 skill 的 Hero + Features + CTA 模式，但执行成“印刷海报”：
  - `lp-nav`：左 brand（lime 方块 + 信息管理，Outfit 800 18），中 nav mono 11，右 EN + 免费注册（lime 按钮）。
  - Hero：12 列；左 7 列：kicker + `lp-display`（两行，关键词用 lime 底块高亮，不用渐变）+ `lp-lede` + 双 CTA（lime 主 / ghost 次）+ mono 小注；右 5 列：产品截图框（2px ink + shadow-3 + 顶部 32px ink bar 三点 + 图注 mono 11），截图可横向滚动，移动端 560px 最小宽。
  - lime marquee 条：重复「本地优先 / AI 录入 / 永久免费 / 数据在你手里」，24s 平移，reduced-motion 停。
  - 功能段：不用卡片网格，用 **编号行** `lp-feature-row`（01 说话即操作 / 02 字段随你定义 / 03 一句话出图 / 04 手机电脑无缝），左编号 mono，中间 Outfit 700 20 标题，右侧 15 说明。
  - 深色段：ink 底；lime kicker；Outfit 800 40 标题；三条数据主权事实（编号 + 标题 + 说明）用 lime 编号。
  - FAQ：编号 01–03 + 2px 上边；底部 CTA 大标题 + lime 按钮。
  - Footer：ink 底；巨大 `lp-wordmark`（“信息管理”或 SIGNAL PRESS）+ 联系方式 + 「一个人维护 · 永久免费 · 关于与支持」+ 备案号。
- 不许出现圆角卡片、软阴影、渐变、衬线、emoji；不许 30–40% 空白。

### 8.8 帮助 / 后台（frontend-analyst）
- HelpPage：页头 + 左 220 目录（panel，选中 lime 底 + 左侧 4px ink）+ 右 720 正文 sheet（2px ink）；正文标题 Outfit 700 20/16；列表用 `index-row`；移动 details 折叠；文末 SupportLink。
- Admin：页头 kicker `ADMIN / 运营` + 标题；3 个 bento tile（总数/今日注册/7天活跃，lime 主 tile + 2 panel tile）；筛选条 40（方块 Tabs + Segmented + 搜索）；`.data-table` 紧凑表（行 32–36，表头 ink）；状态 pill；操作列不换行（280 宽）；数据/功能不变。

### 8.9 首屏欢迎页 + 赞赏码（data-analyst）
- `WelcomeModal` 视觉切到 v4：antd Modal 440 / 0 圆角 / 2px ink / shadow-3；头部 ink 底 bar（mono `ABOUT / 关于作者` + lime 方块）；正文 Work Sans 15/1.65；QR 白卡固定 `#FFFFFF` + 2px ink 边；主按钮 lime（唯一 CTA）；页脚 mono 11；文案/状态机/触发路径**一字不改**（见 05-first-run-support.md）。
- RewardCard：sheet + 2px ink + 标题 Outfit 700 24 + QR 白卡 + lime 按钮；已支持态保留。
- 不改 welcome.ts 语义；不改 AuthPage/AppShell 接线（Lead/ frontend 负责）。

---

## 9. 动效与交互（skill）

- 时长 token：80 / 140 / 220ms；bento 首现 320–450ms，`cubic-bezier(.2,.9,.25,1.2)`（back.out 近似），仅在页面首次加载；数据表格、行、输入不做 overshoot。
- 一次性 stagger：`.bento > .tile` 首现 `opacity 0; translateY(10px); scale(.98)` 依次 40ms；reduced-motion 直接终态。可用 CSS animation + `animation-delay` 或 React effect 加 class（不要引新依赖）。
- hover：可点击 tile/按钮 `translate(-2px,-2px)` + 阴影升一级；active `translate(1px,1px)` + 阴影降级；链接 hover 下划线 2px lime。
- 弹层：120ms 淡入 + 8px 上移；不要 spring 过头。
- 所有动效 `@media (prefers-reduced-motion: reduce)` 关闭；不动画 width/height/top/left。
- 键盘：所有交互可见 focus ring（`outline: 3px solid var(--signal); outline-offset: 2px`），模态/搜索/Esc 行为不变。

---

## 10. 为什么覆盖 skill 的 MASTER 部分值

MASTER 的通用配色（蓝/绿）、8–16px 圆角、柔和阴影与“Brutalism”风格本身冲突，且是通用生成值；本项目按以下原则做了**受控覆盖**，MASTER 的 style/typography/dials/checklist 全部保留执行：
1. 形态：Brutalism 要求 sharp corners/visible borders，故 radius 0、2px 硬边、硬投影；
2. 配色：选用骨白/墨黑/荧光黄绿 + 橙色信号，全部通过 WCAG AA（§1 表内为实测值）；
3. 字体：采用 skill 推荐配对的 Outfit + Work Sans（自托管，避免 CDN）；
4. 布局：Bento Grid + 12 列 Swiss 栅格；
5. 动效：skill 的 Stagger 仅用于 bento 首现，数据界面禁用 overshoot。

---

## 11. 机械验收（每个 scope 自查，必须全 0）

```bash
grep -rn "var(--app-\|--text-\|--space-\|--r-3\|--r-4\|shadow-pop\|shadow-sheet\|serif\|font-serif" src/components/<your-scope> || true
grep -rn "linear-gradient\|radial-gradient\|backdrop-filter\|blur(" src/components/<your-scope> || true
grep -rn "border-radius: *\([4-9][0-9]\|[1-9][0-9][0-9]\)px\|999px" src/components/<your-scope> || true
# 禁止 emoji、禁止 Filled 图标、禁止 ★ 字符（用 Outlined）
```
- `npx tsc -b`、`npx eslint src`、`npx vitest run` 全绿；
- 新代码只用 §4 token 与 §5 class；不写死 hex（QR 白卡面除外）、不写死字号（图标尺寸除外）；
- 保留全部业务逻辑、字段顺序、快捷键、校验、并发/提醒/导入导出语义；
- 中文注释保留并更新到 v4 语言（不要留“官纸/石墨/白卡/衬线”等旧词）。

---

## 12. 交付顺序（Lead 控制）

1. Lead：字体 → theme → main.tsx token → styles/index.css → 外壳（AppShell/Sidebar/AIDock/AIFab/MobileTabBar/GlobalSearch/PageSkeleton/ErrorBoundary）→ index.html/manifest。
2. 页面 owner 按 §8 并行重排；文件域不重叠。
3. 全量 verify + build；Lead 截图（桌面/移动/暗色/欢迎卡/落地页/登录）。
4. 生产部署 + 验证；GitHub 推送；报告 `redesign-report/改版报告-v4.md` + `redesign-report/screenshots/v4/`。
