# Page Override: App（工作台 / 库 / 设置 / 帮助 / 后台 / AI）

> 覆盖 `../MASTER.md`。与 `redesign-brief/06-v4-signal-press.md` 同步。

## 结构
- 外壳：264px ink rail + 64px paper topbar + 可滚动画布；页面根 `.workbench`（max 1440，pad 28/36）。
- 每页必须有 `page-kicker`（mono 大写）+ `page-title`（Outfit 800 30–40）+ `page-sub`；操作放 `page-head-actions`。
- 首页用 Bento：`.bento` + `.tile`（lime 主 tile 7 列、ink 简报 tile 5 列、指标 tile、panel 两栏）。
- 库页：`.toolbar` 三组 + `.data-table`（表头 ink、行 40、hover lime-wash、状态 `.status-pill`）。
- 设置/帮助：编号 `.index-row` 索引 panel + 内容 panel；后台：bento tile + 紧凑黑头表。
- AI：ink 头 + 3px lime 底边；用户消息 lime-wash 硬边块；输入 40 + lime 发送方块。

## 禁止
- 无 panel 包裹的裸内容；>2px 圆角；柔和阴影；lime 小号正文；表格行 hover 位移；行高 <32 或 >44（数据表 40）。
- 不要出现「新手任务/引导清单」；欢迎卡只在注册后一次性出现。

## 状态
- 空态：`.empty-state` + `.empty-mark`（lime 方块 + 2px ink）+ `.empty-title`（800 24）+ `.empty-body` + `.empty-actions`。
- 错误：panel 内 `.empty-state` + 重试按钮；离线：top 下 lime bar。
- 移动：单列；表格横向滚动或卡片；底部 60px ink tabs。
