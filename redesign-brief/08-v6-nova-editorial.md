# v6 · 新星编务 NOVA EDITORIAL —— 实现合同

> 用户选择：C. 新星编务 Nova Editorial（shadcn/ui Nova 式现代商业编辑风）+ 保留 antd + 补齐现代库。
> 本文件是 v6 的唯一视觉契约；与 v5 冲突处一律以本文件为准。

## 1. 气质与参照
- 关键词：编务 / 克制 / 高密度留白 / 单一强调 / 印刷秩序 / 产品级完成度。
- 参照：shadcn/ui Nova、Vercel/Linear 的营销与 dashboard、瑞士国际主义网格、财经杂志封面。
- 反例：极光玻璃（v5）、硬边印刷（v4）、米色纸感（v2）、冷灰渐变（v3）；禁止任何「AI 味」渐变/发光/毛玻璃内容卡。

## 2. Tokens（light / dark）
- bg `#FAFAFA` / `#09090B`；surface `#FFFFFF` / `#111113`；surface-2 `#F4F4F5` / `#18181B`
- text `#09090B` / `#FAFAFA`；secondary `#52525B` / `#A1A1AA`；muted `#71717A`
- border `#E4E4E7` / `#27272A`；border-strong `#D4D4D8` / `#3F3F46`
- accent `#2563EB` / `#60A5FA`；accent-soft `#EFF6FF` / `rgba(96,165,250,.14)`
- danger `#DC2626` / `#F87171`；success `#16A34A` / `#4ADE80`；warning `#D97706` / `#FBBF24`
- 主按钮：ink 底 + 白字（dark 反转）；强调色只用于链接、焦点环、图表、选中标记；60-30-10。
- radius：6 / 8 / 10 / 12 / pill；border 1px；shadow：`0 1px 2px rgba(9,9,11,.04)`，浮层 `0 8px 24px rgba(9,9,11,.08)`，弹窗 `0 24px 64px rgba(9,9,11,.16)`。
- 字体：Plus Jakarta Sans（display/标题）+ Inter（正文/UI）+ 系统 mono（kicker/编号/日期）；自托管，无 CDN。
- 字号：display clamp 30–76 / H2 28–40 / 标题 22 / 正文 14–16 / 小字 12 / mono 10–11；正文行高 1.5–1.7，行长 ≤ 68ch。

## 3. 外壳
- 248px 固定白侧栏：品牌区（黑方标 + 名称 + mono 副标）→ 分组 → 库列表（可拖拽 GripVertical，选中为浅蓝底 + 蓝色文字）→ 新建库 → 工具 → AI 入口 → 用户。
- 56px 白色顶栏：面包屑 / 搜索（灰底胶囊）/ 主题 / 语言 / 头像；1px 下边。
- 内容：`#FAFAFA` 画布，`workbench` max 1280，padding 28/32；页头 = kicker + 大标题 + 说明 + 右侧主按钮。
- 移动端：无侧栏；顶栏 + 固定白底 56px 底栏；页面单列。

## 4. 组件
- **Button**：主 = ink 黑底白字；次 = 白底 1px 边；文字 = 蓝链接；危险 = 红；圆角 8；无渐变无发光；focus 3px 蓝环。
- **Card/Panel**：白底、1px 边、radius 10、1px 阴影；`tile--accent` = 纯黑卡（dark 模式反转白卡）+ 蓝数字；`tile--dark` = 深灰黑卡；`tile--soft` = 浅灰卡。
- **Table**：白底；表头浅灰 mono 10px 大写；行 40；hover 浅灰；选中浅蓝 + 左侧 2px 蓝；数字 tabular；状态 pill 22px。
- **Input/Select**：40 高、radius 8、白底、1px 边、focus 蓝环。
- **Modal**：白底、radius 12、1px 边、深阴影；标题 PJS 600 22；footer 上边线。
- **浮层**：轻玻璃（rgba .92 + blur 16）—— 仅 Dropdown/Select/Command/弹窗遮罩，不透内容卡。
- **Landing**：白底 sticky 导航（轻玻璃）+ 12 列编辑式 hero + 黑色截图卡 + 编号功能行 + 纯黑数据主权段 + FAQ + 黑底 footer + 巨型 wordmark；CTA 黑、强调词钴蓝；固定浅色。
- **Auth**：左侧近白海报（细网格、超大标题、编号要点、mono meta）+ 右侧 400px 白卡；分栏; mobile 单列。
- **欢迎/赞赏码**：白卡弹窗，QR 纯白卡面；文案/状态机不动。
- **AI**：右侧可拖宽面板（react-resizable-panels），白底 1px 左边；header 56；空态黑方标；不遮内容。

## 5. Motion
- 页面切换：Motion fade + 4px / 220ms / ease-out；reduced-motion 直接渲染终态。
- hover/focus：150–200ms；禁止大面积弹跳与无限动画。

## 6. 技术约束
- 组件：antd v5 已覆盖的不重写；图标：Lucide（`src/components/common/icons.tsx` 兼容层）；动效：motion/react；AI 侧栏：react-resizable-panels v4（Group/Panel/Separator）；库拖拽：@dnd-kit；状态：Zustand 沿用。
- 不新增运行时字体 CDN；不引入 Tailwind/shadcn 运行时；不复制 shadcn 源码（仅按 Nova 视觉语言 + antd 实现）。
- 保留：无新手任务、注册后首屏赞赏码与「设置 → 关于与支持」说明、全部业务逻辑/字段/快捷键/校验/导入导出/同步。

## 7. 验收
- tsc / eslint / vitest 279 全绿；build 成功；1440×900 + 390×844 截图；深色；生产 200；GitHub 推送。
