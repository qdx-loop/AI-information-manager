# v8 · Windows 11 原生应用 —— 实现合同

> 用户提供《前端提示词》，要求：全面遵循（所有界面彻底重做，不要保留旧格式，让人第一眼完全认不出是同一个东西）+
> 自行检索 Windows 11 风格。原文件保存在 `/home/qdx/.dsh/attachments/v1/files/dd/dd7dc6c2.../前端提示词.md`。

## 0. 适配说明
- 提示词的参考技术栈是 Tauri + Vue3 + Element Plus；本项目既有技术栈是 React 18 + Vite + antd v5 + Fluent UI v9。不重写既有业务应用（避免巨大回归），按提示词的**设计语言与交互原则**完整落地；组件库映射为 antd + Fluent v9。
- 若未来迁移 Tauri，本 CSS/结构已按无边框窗口设计（drag region + 8px 圆角 + Mica + 系统工具按钮），可直接复用。

## 1. 强制视觉目标
原生感 > 炫酷；Win11 原生 > 现代网页；克制/秩序/留白/玻璃 > 渐变/霓虹/科技。
第一眼必须像 Windows 11 自带应用，而不是网页套壳。

## 2. 反模式（禁止）
蓝紫渐变背景、大面积渐变、科技 HUD、霓虹高饱和、网页卡片式 Dashboard、Gemini/Web AI 风；关键词黑名单 neon/gradient/futuristic/cyber/tech-ui/dashboard。

## 3. 布局
- 左侧垂直导航 68px（60–72），图标为主，文字仅 hover（title）显示；Acrylic。
- 顶部 40px 可拖拽标题栏 + 右侧工具按钮（搜索 / 主题 / 语言 / 账户）；桌面移除旧 command bar。
- 主体 Mica 内容区；大留白、低密度、中央聚焦。
- 移动端：48px 顶栏 + 固定 Acrylic 底栏；内容单列。

## 4. 材质
- Mica 窗口：`rgba(31,31,31,.72)` + blur(40) saturate(130%)；浅色 `rgba(240,240,240,.70)`。
- Acrylic 导航/标题栏/浮层：blur(24–30) + 半透明 + 噪点。
- 内容层：`rgba(31,31,31,.55)`（浅色 .45）；Card：`rgba(37,37,37,.42)` + 1px 极淡边 + 软阴影。
- 对话框：Acrylic 强层 + Smoke（黑 .45 + blur3）。

## 5. 色彩
- 深色（默认）：#1F1F1F / #252525 / #2B2B2B / #303030 / #FFFFFF / #E6E6E6 / #CFCFCF。
- 强调：#4CC2FF / #3DAEE9 / #5FB3FF（只做 10%）；浅色主题 #0067C0。
- 禁止高饱和紫/蓝、粉紫渐变、蓝紫渐变背景。

## 6. 组件
- Element Plus 二次主题 → antd/Fluent 二次主题：圆角 8–12（默认 8），边框极淡，hover 提亮，active 轻微下沉。
- 搜索框：Win11 系统搜索（半透明、内阴影、圆角、低对比边）。
- 列表：Win11 设置面板（大行高 48、强留白、hover 提亮）。
- 弹窗：Win11 原生对话框（Acrylic、圆角、轻阴影）。
- 首页：Windows Start + Settings 混合；禁止 KPI Dashboard 卡片。
- 所有界面重新构建：外壳/首页/库页/编辑器/模板/导入/回收站/设置/帮助/后台/登录/注册/落地页/AI/欢迎卡/移动端。

## 7. 技术落地
- 保留 React/antd/Fluent v9；FluentProvider 主题、Fluent icons 已接入；Motion/react-resizable-panels/@dnd-kit/Zustand 沿用。
- 图标：Fluent System Icons；窄导航库项用首字母块（可 hover 看全名），管理菜单 hover 仍可用。
- 不改业务逻辑、无新手任务、注册后首屏赞赏码逻辑不变。

## 8. 验收
- 截图首屏为深色 Win11 原生窗口（标题栏 + 图标导航 + Mica + 设置式首页）。
- tsc/eslint/vitest 279/build 全绿；1440×900 + 390×844；明暗双主题；生产 200；GitHub 推送。
