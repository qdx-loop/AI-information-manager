# v5 全盘重设计合同 · 流光玻璃 LUMINOUS GLASS

> 用户最新指令（2026-11-01，v4 硬边方向被否）：「还是不行，要那种商业高级感，毛玻璃那种。」
> 本轮目标：**商业高端 SaaS 的「流光玻璃」质感**——极光渐变底 + 磨砂玻璃层 + 柔和光影 + 精致排版，和 v2 官纸账簿、v3 石墨信号、v4 硬边印刷完全切割。
> skill 依据：ui-ux-pro-max → `design-system/luminous-glass/MASTER.md`（Style = Liquid Glass，support light/dark；关键词 translucency / lensing / layered depth / vibrant background）；通用值按 §10 做项目覆盖。
> 分支：`feat/glass-premium`（已在 v4 基础上新建；不要切换/commit/push）。

---

## 0. 方向一句话

**「流光玻璃」**：页面不是白卡堆在灰底上，而是**一层柔光极光背景 + 多层磨砂玻璃**。光在玻璃后面流动，卡片半透明、有厚度、有内高光；主按钮是靛紫渐变并带柔光；数字与标题用 Plus Jakarta Sans，正文用 Inter；圆角 12–28，阴影柔和扩散，动效轻缓。目标是 Apple visionOS / Stripe / Arc / Raycast 那一类的「贵而克制」，不是暴力撞色。

与 v4 的关系：**结构骨架保留（页面信息架构/功能不变），视觉语言彻底替换**——删除 0 圆角、2px 黑边、硬投影、荧光黄绿、Bento 硬网格；换成玻璃、极光、渐变、柔和阴影、悬浮面板。

---

## 1. 颜色（Light / Dark，均按 WCAG 实测）

### Light
| token | 值 | 用途 |
|---|---|---|
| `--bg` | `#EEF1F8` | 画布底色（其上叠加极光） |
| `--surface` | `rgba(255,255,255,0.58)` | 玻璃面板 |
| `--surface-solid` | `#FFFFFF` | 需要实底的内容（QR/表格悬停/输入 focus） |
| `--surface-2` | `rgba(255,255,255,0.36)` | 次级玻璃 |
| `--glass-border` | `rgba(255,255,255,0.72)` | 玻璃 1px 外高光边 |
| `--border` | `rgba(15,23,42,0.08)` | 细分隔线 |
| `--border-strong` | `rgba(15,23,42,0.14)` | 控件边 |
| `--text` | `#0B1220` | 主文字（近黑蓝，15:1） |
| `--text-secondary` | `#475569` | 次要（7:1） |
| `--text-muted` | `#64748B` | 注脚/占位（4.8:1） |
| `--accent` | `#5B5BF7` | 主色（靛蓝） |
| `--accent-hover` | `#4F46E5` | |
| `--accent-soft` | `rgba(99,102,241,0.12)` | 选中/悬停底 |
| `--accent-2` | `#06B6D4` | 青色辅助（图表/状态/渐变第二色） |
| `--accent-gradient` | `linear-gradient(135deg, #6366F1 0%, #8B5CF6 55%, #22D3EE 100%)` | 主按钮/品牌/高亮词 |
| `--danger` / soft | `#DC2626` / `rgba(220,38,38,0.10)` | |
| `--success` / soft | `#059669` / `rgba(5,150,105,0.10)` | |
| `--warning` / soft | `#D97706` / `rgba(217,119,6,0.12)` | |
| `--on-accent` | `#FFFFFF` | 渐变/主色上的字 |
| `--on-dark` | `#F8FAFC` | 深玻璃上的字 |
| `--dark-panel` | `rgba(10,14,30,0.72)` | 深玻璃面板 |

### Dark
`--bg #060913`、surface `rgba(255,255,255,0.06)`、surface-2 `rgba(255,255,255,0.035)`、glass-border `rgba(255,255,255,0.16)`、border `rgba(255,255,255,0.08)`、border-strong `rgba(255,255,255,0.16)`、text `#F1F5F9`、text-secondary `#CBD5E1`、text-muted `#94A3B8`、accent `#818CF8`、accent-hover `#A5B4FC`、accent-soft `rgba(129,140,248,0.16)`、accent-2 `#22D3EE`、dark-panel `rgba(255,255,255,0.07)`、on-dark `#F8FAFC`。

### 极光背景（画布）
三层径向渐变 + 模糊色团，固定不滚动（fixed pseudo-element）：
- 光球 1：`#6366F1` 22% → transparent，~700px，左上；
- 光球 2：`#22D3EE` 16% → transparent，~560px，右下；
- 光球 3：`#F472B6` 12% → transparent，~520px，右上偏中；
- 叠加一层白色柔光 `radial-gradient(circle at 50% 0%, rgba(255,255,255,.85), transparent 55%)`；
- 暗色时光球透明度 +50%，底色 `#060913`；
- 叠加极淡噪点（SVG data-uri，opacity 0.035）增加真实质感；
- 所有光球 `filter: blur(90px)`；动画 24s 缓慢漂移（reduced-motion 停）。

> 禁止：用纯色平底（玻璃必须透出彩色光）；用高饱和大面积纯色；玻璃完全不透明。

---

## 2. 字体

- **Display / UI：Plus Jakarta Sans**（自托管 variable，`public/fonts/plus-jakarta-sans-var.woff2`，OFL）。标题 700–800、按钮/导航 600。
- **Body / 表格：Inter**（自托管 variable，`public/fonts/inter-var.woff2`，OFL）。正文 400/500。
- **Mono**：系统等宽（kicker/编号/金额/日期/快捷键），中文不进等宽。
- 字阶：12/13/14/15/16/18/22/28/36/48/64；行高 1.45–1.65；标题 `letter-spacing: -0.02 ~ -0.035em`；kicker 大写 `+0.12em`。
- 数字 `font-variant-numeric: tabular-nums`；表格数字右对齐。

---

## 3. 形状 / 玻璃 / 阴影 / 动效

- 圆角：`--radius-sm 12`、`--radius-md 16`、`--radius-lg 20`、`--radius-xl 28`、`--radius-pill 999`。卡片 20、面板 20、弹窗 24–28、按钮/输入 12–14、胶囊 999。
- 玻璃（标准 `.glass`）：`background: var(--surface); backdrop-filter: blur(28px) saturate(160%); -webkit-backdrop-filter: ...; border: 1px solid var(--glass-border); box-shadow: 0 12px 40px rgba(15,23,42,.10), inset 0 1px 0 rgba(255,255,255,.55);`
- 玻璃强（弹窗/浮层）：blur(40px) + 更高不透明度 + `0 24px 80px rgba(15,23,42,.18)`。
- 深玻璃 `.glass-dark`：`background: var(--dark-panel)` + blur + 1px 白边 0.16 + 深阴影；上面文字用 `--on-dark`。
- 阴影只做柔和扩散：`--shadow-1: 0 2px 8px rgba(15,23,42,.06), 0 12px 32px rgba(15,23,42,.08)`；`--shadow-2: 0 8px 24px rgba(15,23,42,.10), 0 24px 64px rgba(15,23,42,.12)`；`--shadow-3: 0 24px 80px rgba(15,23,42,.20)`；禁止硬投影/彩色硬阴影（CTA 可有一层淡 accent 光晕）。
- 动效：hover 180–240ms ease-out（translateY(-2px) + 阴影升级）；按下 120ms scale(.985)；弹层 240–320ms cubic-bezier(.2,.8,.2,1)；Bento 首现 400ms stagger；极光 24s 漂移；`prefers-reduced-motion` 全关。
- 高光：卡片顶部 1px 内高光、按钮顶部 45° 白色 20% 渐变（`::before` 或 background 叠加），这是「玻璃厚度」的关键。

---

## 4. Token 命名（v4 → v5 映射，已用脚本迁移）

| v4 | v5 |
|---|---|
| `--paper` | `--bg` |
| `--sheet` | `--surface` |
| `--panel` | `--surface-2` |
| `--ink` | `--text` |
| `--ink-soft` | `--text-secondary` |
| `--ink-faint` | `--text-muted` |
| `--line` | `--border-strong` |
| `--line-soft` | `--border` |
| `--lime` | `--accent` |
| `--lime-hover` | `--accent-hover` |
| `--lime-wash` | `--accent-soft` |
| `--signal` | `--accent-2` |
| `--on-lime` | `--on-accent` |
| `--on-ink` / `--on-block` | `--on-dark` |
| `--block` | `--dark-panel` |
| `--r-0` | `--radius-lg`（20） |
| `--r-1` | `--radius-sm`（12） |
| `--r-pill` | `--radius-pill` |
| `--bw` | `--border-width`（1px） |

新增：`--surface-solid`、`--glass-border`、`--accent-gradient`、`--radius-md/xl`、`--shadow-glow`、`--aurora-*`、`--glass-blur`。

---

## 5. 组件规格（class 名沿用 v4，实现全部换成玻璃）

- **应用外壳**：极光画布；`.app-rail` 改为**悬浮玻璃栏**（inset 14px、radius 24、glass、宽 264）；`.app-topbar` 改为悬浮玻璃条（margin 14 14 0、radius 16、高 56、sticky）；内容区 padding 24；AI 停靠为悬浮玻璃面板（radius 20、右 14 上 14 下 14）。
- **卡片**：`.tile` / `.panel` / `.sheet` = 玻璃卡（20 圆角、1px 高光边、柔和阴影、内高光）。`.tile--accent`（原 lime）= 靛紫渐变卡 + 白字 + 光晕；`.tile--dark` = 深玻璃卡 + `--on-dark`；`.tile--soft` = 更淡玻璃。
- **按钮**：primary = `--accent-gradient` 白字、12 圆角、柔光阴影、hover 提亮 + translateY(-1px)、active scale(.985)；default = 玻璃白（或暗玻璃）1px 边；text = secondary；danger = 红渐变/实底；所有按钮 focus-visible `0 0 0 4px rgba(99,102,241,.28)`。
- **输入/选择/日期**：玻璃白底（暗色玻璃）、12 圆角、1px `border-strong`、focus 白底 + 3px accent 环；标签 Inter 13 600 secondary；错误红字内联。
- **表格**：`.data-table` 玻璃圆角 20、overflow hidden；表头半透明（`rgba(255,255,255,.35)` / 暗色 `rgba(255,255,255,.05)`）+ 11px mono 大写 secondary + 1px 底线；行 44；hover `--accent-soft`；选中行 accent-soft + 左侧 2px accent；数字右对齐 tabular；操作 hover 显示。
- **分页/标签页/分段**：玻璃底 pill；active 用 accent-soft + accent 字。
- **状态**：圆角 pill（999），浅色 soft 底 + 深字 + 小圆点；success/warning/danger/accent。
- **弹窗**：玻璃强、radius 24–28、标题 PJS 700 24、按钮右对齐；遮罩 `rgba(8,12,28,.42)` + blur(6px)。
- **AI**：悬浮玻璃面板；头部玻璃 + accent 渐变小徽标；用户气泡用 accent-soft 玻璃、AI 输出无底色 15/1.65；运行中 2px 渐变进度条；输入玻璃胶囊。
- **侧栏**：玻璃 rail；品牌为渐变方块 logo；选中项 accent-soft + accent 字 + 左侧 2px accent；库列表 hover glass；底部用户玻璃卡。
- **Landing**：极光 hero；玻璃 pill 导航（居中悬浮）；`lp-display` PJS 800 巨型标题，关键词用 **gradient text**（`background-clip:text`）而非色块；玻璃产品截图卡 + 背后 accent 光晕；功能改为玻璃 Bento/卡片行；深色段 = 深玻璃大圆角面板；FAQ 玻璃行；CTA 渐变按钮 + 光晕；页脚深玻璃圆角面板 + 渐变 wordmark。
- **Auth**：极光背景；左侧玻璃海报 + 渐变标题字；右侧玻璃卡；按钮渐变；移动端单列。
- **欢迎页/赞赏码**：玻璃弹窗（24 圆角）+ 白色 QR 卡（必须纯白）+ 渐变主按钮；文案/状态机不变。
- **移动端**：悬浮玻璃底栏（pill，左右 12、底部 12 + 安全区）；顶部玻璃条；面板单列。

---

## 6. 逐页要求

沿用 v4 的信息架构与全部功能（无新手任务、注册后首屏赞赏码、全部业务逻辑），视觉按 §5 替换：
1. 首页：Bento（大渐变卡 + 深玻璃简报卡 + 3 玻璃小卡 + 待办/最近动态玻璃面板）；空态玻璃 + 渐变图标。
2. 库页：页头玻璃化；工具条玻璃胶囊；表格玻璃；移动卡片玻璃。
3. 编辑器/模板/导入/回收站：玻璃弹窗/面板；步骤条圆形渐变；拖拽区玻璃虚线。
4. 设置/帮助：玻璃索引 + 玻璃内容面板；右侧留白用玻璃辅助卡补（常用入口/提示）。
5. 后台：玻璃 KPI 卡 + 玻璃表格。
6. 登录/注册：见 §5。
7. 落地页：见 §5。
8. AI：见 §5。
9. 欢迎卡：见 §5。

---

## 7. 禁止清单

- 纯平色背景、无模糊的实心白卡、2px 黑边、硬投影、荧光黄绿、0 圆角、网格线过重。
- 大面积高饱和撞色、彩虹渐变、玻璃上放白字（浅色模式）。
- 文字对比度 <4.5:1；玻璃层没有任何实底 fallback（`@supports not (backdrop-filter)` 时用 0.9 不透明底）。
- 改业务逻辑/字段顺序/快捷键/校验；新增依赖；网络字体 CDN。

## 8. 验收

- 双主题 1440×900 + 390×844 截图：登录、落地页、首页、库页、设置、后台、AI、欢迎卡。
- 机械检查：无 `--lime/--paper/--sheet/--ink-soft/--line-soft` 等旧 token；无 2px 硬边/硬投影/0 圆角；无渐变冲突（品牌渐变除外）；对比度检查通过。
- `npx tsc -b && npx eslint src && npx vitest run` 全绿；build 通过；生产部署与 GitHub 推送。
