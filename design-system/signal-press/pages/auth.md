# Page Override: Auth（登录 / 注册）

> 覆盖 `../MASTER.md`。

- 布局：`.auth-page` grid 5fr/6fr；左 `.auth-poster`（ink 底、paper 字、lime rail-mark、mono kicker、Outfit 800 40–64 标题含 `<em>` lime 高亮、3 条 mono 说明、底部 mono 版权）；右 `.auth-form-side` 居中 `.auth-card`（400、sheet、2px ink、shadow-3、0 圆角、28 padding）。
- 表单：标签可见（mono 11 大写）；输入 40；主按钮 48 全宽 lime；Tabs 方块化（lime 选中）；错误 12 danger 内联 + aria-live；Turnstile 未就绪不占位，仅提交时提示。
- 品牌只出现一次（左海报），右卡不重复 logo。
- 注册成功：`markWelcomePending()` → `navigate('/')`；不弹成功 toast。
- 移动 ≤960：单列；海报压缩（标题 32–44、说明隐藏）；表单卡去阴影但保留 2px 边。
