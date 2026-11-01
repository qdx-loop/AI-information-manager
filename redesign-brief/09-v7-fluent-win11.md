# v7 · WINDOWS 11 / FLUENT UI REACT V9 —— 实现合同

> 用户指令：检索 microsoft/fluentui React v9 最新官方规范，全面遵循，做成 Windows 11 现代高级质感（Mica 云母、12px 圆角、细腻分层阴影、Segoe 语义图标）。
> 本文件是 v7 的唯一视觉契约；与 v5/v6 冲突处一律以本文件为准。

## 1. 规范来源（已核实）
- microsoft/fluentui React v9（`@fluentui/react-components` 9.75.0，`@fluentui/react-icons` 2.0.345）与 FluentProvider 主题工厂。
- Windows 11 Mica：https://learn.microsoft.com/en-us/windows/apps/design/style/mica
- Windows 11 Materials（Mica/Acrylic/Smoke）：https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/materials
- Windows 11 Layering & Elevation（1/2/8/16/32/128 层级）：https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/layering
- Windows 11 Typography（Segoe UI Variable type ramp）：https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/typography
- Fluent 2 tokens 直接从已安装主题读取：fontSize/lineHeight、borderRadius（4/8/12）、shadow2/4/8/16/28/64、neutral/brand colors。

## 2. 材质与层级
- 桌面背景：Windows 11 Bloom 风格壁纸（自生成，2560×1440，`public/win11-bloom-dark.jpg`），body 固定 cover。
- 应用窗口：`inset:20px`、12px 圆角、1px 白色轮廓、shadow64；Mica = `rgba(243,243,243,.82)` + `backdrop-filter: blur(64px) saturate(150%)`（暗色 `rgba(32,32,32,.86)`）。
- 层级（Windows 11 文档）：
  - Mica 基底（窗口）
  - Mica Alt 指挥层（标题栏、导航窗格、命令栏）
  - LayerFillColorDefault 内容层（页面 `rgba(255,255,255,.55)` / 暗色 `.045`）
  - Card 层（`rgba(255,255,255,.78)` / 暗色 `rgba(43,43,43,.86)`，1px 轮廓，12px 圆角，shadow2）
  - Flyout 层：Acrylic（blur 30，white .86），shadow16/32
  - Dialog 层：Mica 强层 + Smoke 遮罩（black .35 + blur 4），shadow64
- 不重复叠材质：内容卡不用 backdrop-filter；仅 Mica 窗口与 Acrylic 浮层使用。

## 3. Token
- Color：见 MASTER Project Overrides；light surface #FFFFFF/#FAFAFA/#F5F5F5/#F0F0F0；text #242424/#424242/#616161/#707070；stroke #D1D1D1/#E0E0E0；brand #0067C0 / hover #005A9E；dark bg #202020/#292929/#141414，brand #60CDFF。
- Type：Segoe UI Variable Text/Display；Selawik（OFL）回退；中文 Microsoft YaHei UI/PingFang SC/Noto Sans CJK；ramp 12/14/16/20/28/40/68；标题 semibold 600；正文 400；禁止 bold 大标题（Windows 用 semibold）。
- Radius：控制 4/8；卡片/窗口/弹窗 12（Fluent borderRadius2XLarge，按用户要求）；状态 pill 999。
- Shadow：Fluent shadow2/4/8/16/28/64 原值。
- Motion：Fluent 曲线与 150–250ms；页面转场 200ms。

## 4. 页面
- 外壳：桌面窗口化（壁纸边缘可见）→ 标题栏（应用标 + 名称 + 本地优先状态 + MICA 标签）→ 导航窗格（Mica Alt，Win11 选中条：3px 强调色 + 半透明底）→ 命令栏（面包屑/搜索/主题/语言/头像）→ 内容层。
- 首页：强调色卡片（主指标）+ 深色简报卡 + 3 张 Layer 卡 + 待办/动态卡；空态用 Fluent 强调色方块。
- 库页：Card 层表格（表头 12 semibold、行 40、正文 14）+ 命令条；移动端卡片列表 + 横向工具条。
- 设置/帮助：左索引（选中 = 半透明底 + 3px 强调条）+ 右 Mica 卡。
- 后台：强调色 KPI + 命令条 + Card 表。
- 登录/注册：Windows 11 锁屏式：全屏 Bloom + 居中 Mica 卡（12 圆角 + shadow64）+ Segoe 标题 + Fluent 按钮；移动端单列。
- 落地页：Acrylic nav + Mica hero 卡（真实 v7 截图在 Fluent 窗口框内）+ Mica 功能卡 + 黑色数据主权卡 + Mica FAQ/CTA/联系 + 黑色 footer（Segoe 巨型 wordmark）。
- AI：Mica Alt 右侧可拖宽面板；Fluent 图标；空态；移动端 Acrylic 底部抽屉。
- 欢迎/赞赏码：Mica 弹窗 + 纯白 QR；文案与状态机不变。

## 5. Fluent UI v9 落地
- `FluentProvider`（custom Windows 主题）包裹全应用；`@fluentui/react-icons` 统一图标；antd 继续承担复杂数据组件（Table/Form/Modal/Upload/DatePicker），主题和 CSS 映射至 Fluent tokens（不重复造组件）。
- Fluent 组件使用：Provider/主题、官方 Icons；页面结构以 Fluent 2 token + Windows 11 材质实现；不引入 Tailwind/shadcn。
- 既有 Motion/react-resizable-panels/@dnd-kit 保留：页面转场、AI 拖宽、库拖拽。

## 6. 保留与验收
- 保留：无新手任务、注册后首屏赞赏码与「设置 → 关于与支持」说明、全部业务逻辑/字段/快捷键/校验/导入导出/同步。
- 验收：tsc/eslint/vitest 279/build 全绿；1440×900 + 390×844；明/暗；生产 200；GitHub 推送。
