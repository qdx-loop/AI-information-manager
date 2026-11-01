# Page Override: Landing（公开落地页）

> 覆盖 `../MASTER.md`。海报式、固定浅色（不跟随系统暗色）。

## 结构（按顺序）
1. `lp-nav`（72px，paper 底 + 2px ink 底边）：lime 方块 brand + mono 导航 + EN + lime 注册按钮。
2. `lp-hero` 12 列：左 7（kicker + `lp-display` 巨型 Outfit 800 44–88 + `<em>` lime 底块 + `lp-lede` + 双 CTA + mono 注脚）右 5（`.lp-shot` 2px ink + shadow-3 + ink 顶栏三点 + 图注）。
3. `lp-marquee`：lime 底、mono 大写、两段轨道无缝平移 26s；reduced-motion 停。
4. `lp-section` 功能：`lp-section-head` + 4 条 `lp-feature-row`（编号 / 标题 / 说明），不用卡片网格。
5. `lp-deep`：ink 底 + lime 编号 + 三条数据主权事实。
6. FAQ：`lp-faq-item` 编号 + 上下 1px 线。
7. `lp-close`：大标题 + lime CTA。
8. `lp-contact` + `lp-footer`：`.lp-wordmark` 巨大 lime 字 + 版权/支持入口。

## 禁止
- 渐变、柔和阴影、圆角卡片、编号卡片网格、衬线、emoji、米色/白色大面积空白（每段必须有墨色/ lime 块压住）。
