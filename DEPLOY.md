# 部署指南（老板版 · 一步一步跟着做）

> 目标：把软件部署到 Cloudflare，得到一个网址。
> 用户打开网址**自己注册**就能用；你打开 `网址/admin` 看数据、处理违规账户、帮用户重置密码。
> 全程免费，只需要注册一个 Cloudflare 账号。

---

## 准备工作（一次性）

1. 注册 Cloudflare 账号：https://dash.cloudflare.com/sign-up
2. 在你的 Fedora 电脑终端里登录 wrangler 命令行工具：

```bash
cd ~/inforation\ manage
npx wrangler login
```

会弹出浏览器让你点「Allow」授权。

---

## 第一步：创建数据库（存账号、限速计数、埋点与配对信令）

```bash
npx wrangler d1 create info-manager
```

命令执行后会输出一段信息，其中 `"database_id": "xxxx..."` 就是数据库 ID。
**本仓库的 `wrangler.toml` 已经填好真实 ID**（`633bb5c3-...`），一般不需要改；
只有你新建了一个数据库时才需要把新 ID 填进 `wrangler.toml` 的 `database_id`。

然后建表：

```bash
npx wrangler d1 execute info-manager --file=./schema.sql --remote
```

`schema.sql` 是幂等的（`CREATE TABLE/INDEX IF NOT EXISTS`），可以安全重跑；
**它只负责新库**。已经部署过的老库要按下面的「迁移清单」逐条执行。

### 迁移清单（老库升级必读，顺序不能乱）

| 顺序 | 文件 | 作用 | 能否重复执行 |
|---|---|---|---|
| 1 | `schema.sql` | 建表/补索引（幂等） | ✅ 可以 |
| 2 | `migration-pwd-epoch.sql` | `accounts.pwd_epoch` 列（改密/重置后吊销旧令牌） | ❌ 只能执行一次 |
| 3 | `migration-p2p-signals.sql` | `p2p_signals` 表（面对面同步的信令中转） | ❌ 只能执行一次 |
| 4 | `migration-free-accounts.sql` | 删 `accounts.expires_at`、加 `contact`（永久免费改造） | ❌ 只能执行一次 |

```bash
# 老库升级：逐条执行，每条只跑一次
npx wrangler d1 execute info-manager --file=./migration-pwd-epoch.sql --remote
npx wrangler d1 execute info-manager --file=./migration-p2p-signals.sql --remote
npx wrangler d1 execute info-manager --file=./migration-free-accounts.sql --remote
```

> ⚠️ 迁移脚本都是裸 `ALTER TABLE`，**不幂等、没有 `schema_migrations` 版本表**：
> 重复执行会报 "duplicate column name" 并中断整批语句。执行前先确认列是否已存在：
> `npx wrangler d1 execute info-manager --remote --command "PRAGMA table_info(accounts)"`
>
> 漏跑 2 的后果：改密/重置密码后旧令牌不会被吊销（代码对缺列是 fail-open 的），
> P2P 信令接口会返回 503。漏跑 3/4 会分别导致信令 503、后台显示旧字段。
> 全新库只跑 `schema.sql` 即可（它已包含 `pwd_epoch`、`contact`、`p2p_signals`）；
> 此时再跑 2/4 会因列已存在而报错——**新库不要跑迁移脚本**。

## 第二步：创建 Pages 项目（先有项目，密码才有地方存）

```bash
npx wrangler pages project create info-manager --production-branch=main
```

## 第三步：设置密钥与环境变量

```bash
# 管理后台的登录密码（自己想一个，别用弱密码；后台无 UI 入口，只能直链 /admin 访问）
npx wrangler pages secret put ADMIN_PASSWORD

# 给登录令牌签名的随机密钥：必须 >= 32 字符，否则所有登录/注册/改密接口
# 一律返回 503 SERVER_MISCONFIGURED（这是刻意的 fail-closed：绝不拿空密钥签名）
npx wrangler pages secret put AUTH_SECRET
```

生成随机密钥偷懒办法：终端运行 `openssl rand -hex 32`，把输出（64 字符）当
`AUTH_SECRET` 用。**改了 AUTH_SECRET 会让全部用户重新登录**（旧令牌签名对不上），
属于预期行为，轮换前最好公告一声。

### Turnstile（注册防机器人，强烈建议配）

```bash
# Cloudflare 控制台 → Turnstile → Add site 拿到 secret 与 sitekey。
# 注意前端 sitekey 已硬编码在 src/config/site.ts，这里只配服务端校验用的 secret；
# 两个都配了才会真正校验，只配一个等于没配（服务端会静默放行）。
npx wrangler pages secret put TURNSTILE_SECRET

# 允许的站点主机名，多个用英文逗号分隔，如：aiim.de5.net,info-manager.pages.dev
# 生产值不要包含 localhost / 127.0.0.1（否则本地调试用的 token 可被重放到线上）
npx wrangler pages secret put TURNSTILE_HOSTNAMES
```

### 平台代管 AI（可选）

配置后用户在「设置 → AI 配置」选"平台提供"即可零配置使用 AI。
主档三件套（缺任一则该档不可用）：

```bash
npx wrangler pages secret put PLATFORM_AI_BASEURL   # 上游地址，如 https://api.deepseek.com/v1
npx wrangler pages secret put PLATFORM_AI_KEY       # 上游 API Key
npx wrangler pages secret put PLATFORM_AI_MODEL     # 统一模型名，如 deepseek-chat
```

备用档（可选，主档连接失败/429/5xx 时自动切换，最多两档）：

```bash
npx wrangler pages secret put PLATFORM_AI_FALLBACK_1_BASEURL
npx wrangler pages secret put PLATFORM_AI_FALLBACK_1_KEY
npx wrangler pages secret put PLATFORM_AI_FALLBACK_1_MODEL
npx wrangler pages secret put PLATFORM_AI_FALLBACK_2_BASEURL
npx wrangler pages secret put PLATFORM_AI_FALLBACK_2_KEY
npx wrangler pages secret put PLATFORM_AI_FALLBACK_2_MODEL
```

### 限速与开关（都是可选变量）

```bash
# 平台 AI：每账号每窗口最多调用次数（默认 120 次 / 1 小时）
npx wrangler pages secret put AI_RATE_MAX        # 如 60
npx wrangler pages secret put AI_RATE_WINDOW_MS  # 如 3600000（1 小时）
# /api/track 埋点：每账号默认 120 次/小时
npx wrangler pages secret put TRACK_RATE_MAX
# /api/ai/fetch 网页抓取：每账号默认 60 次/小时
npx wrangler pages secret put FETCH_RATE_MAX

# 被恶意灌水时，紧急关闭注册（不用重新部署，随时能改回来）
npx wrangler pages secret put REGISTRATION_OPEN  # 填 0 = 关闭注册；删掉这个密钥 = 重新开放
```

> 平台 AI 的密钥只存在服务器端，买家端看不到、拿不走；模型由服务端锁定。
> **务必为该 Key 设置消费限额**（OpenRouter/DeepSeek 等控制台都有），防止被刷。
> 开放注册 + 平台 AI 意味着任何互联网用户注册后就能消耗你的额度：
> 被刷时先 `REGISTRATION_OPEN=0` 关注册，再调低 `AI_RATE_MAX`，最后去上游限额。

每个 `secret put` 命令回车后会提示输入值，粘贴后回车。
`AUTH_SECRET`/`TURNSTILE_*` 这类值只显示一次，建议先记在密码管理器里。

## 第四步：发布上线

```bash
npm run build
npx wrangler pages deploy dist
```

第一次执行会问你项目名，直接回车用默认的 `info-manager` 即可。
成功后会显示一个网址，例如：

```
✨ Deployment complete! https://info-manager.pages.dev
```

- 把网址发给任何人 → 他自己点「注册」就能开始用，不需要你参与 ✅
- **打开 `网址/admin` 输入管理密码 → 你的运营后台** ✅
  后台刻意没有 UI 入口（见 `src/components/auth/AuthPage.tsx` 注释），只能通过书签/直链访问；
  `public/_redirects` 里的 `/* /index.html 200` 负责把 `/admin` 这类深链回退到 SPA，
  否则刷新/直链会 404。部署后自测一次：
  `curl -sI https://<域名>/admin | head -3` 应为 200。

### 安全响应头与 CSP（`public/_headers`）

部署产物包含 `_headers`，会下发 CSP（已放行 Turnstile 的 script/frame、`data:`/`blob:` 图片、
antd 需要的 `style-src 'unsafe-inline'`、以及自定义 AI/Supabase 需要的 `connect-src https:`）、
`X-Frame-Options: DENY`、`Referrer-Policy`、`X-Content-Type-Options: nosniff`、`Permissions-Policy`
（摄像头/麦克风关闭，保留剪贴板）。改 CSP 后务必浏览器走一遍登录/注册/AI 对话/导出，
确认 Console 没有 CSP 报错——**CSP 配错会直接白屏**，这是本项目最容易“部署即挂”的地方。

## 第五步（强烈建议）：绑定自己的域名

`pages.dev` 的网址在国内时快时慢。花约 60 元/年买个域名（阿里云/腾讯云均可），
在 Cloudflare 控制台：**Workers & Pages → info-manager → Custom domains → 添加**，
按提示去域名商那里加一条 CNAME 解析即可。

---

## 日常运营流程（在 /admin 后台操作）

用户是自助注册的，你不需要参与开通。后台只做三件事：

| 情况 | 你的操作 |
|---|---|
| 想知道有多少人在用 | 首页 6 个统计卡片：账户总数 / 启用中 / 今日注册 / 7 天活跃 / 7 天注册 / 已停用 |
| 想看某个用户是否活跃 | 「账户」页筛选「7 天内用过」或「30 天未用」，也可按用户名/联系方式搜索 |
| 有用户刷广告、灌水、传违规内容 | 找到该用户 → 点「停用」→ 对方立刻无法登录（数据仍保留，可随时恢复） |
| 要彻底清掉某个账户 | 点「删除」→ 不可恢复，谨慎 |
| **用户忘记密码**（最常见） | 点「重置密码」→ 留空让它自动生成一个临时密码，复制发给用户 → 提醒用户自己去「设置 → 账户」改掉 |
| 收到灌水投诉 | 紧急关闭注册（见上面第三步的 `REGISTRATION_OPEN`），处理完删掉该密钥即可恢复 |

重置密码弹窗里的密码**只显示这一次**，关闭后无法再查看，务必当场复制。

注意：重置密码会让该用户所有已登录的设备立刻被踢下线（需要用新密码重新登录），这是刻意的——防止别人拿着旧会话继续用。

## 停用 / 重置密码是怎么生效的

- 登录时：服务器直接核对账户状态；
- 使用中：软件每 10 分钟向服务器核实一次，切走窗口再回来也会核实；
- 所以你在后台点了「停用」，用户最迟 10 分钟内被踢下线。
- 改密/重置密码会递增 `pwd_epoch`，该用户所有旧令牌立即失效（老库需已执行
  `migration-pwd-epoch.sql`；漏跑会 fail-open，旧令牌不会立刻失效）。

## 数据备份与恢复（D1 没有时间点恢复，务必做）

D1 免费版**没有自动备份/时间点恢复**，误删 `accounts` 不可逆。建议每天（或至少每周）
导出一次并异地保存：

```bash
# 导出全库为 SQL（--remote 指线上库，不是本地预览库）
npx wrangler d1 export info-manager --remote --output=backup-$(date +%F).sql

# 校验导出文件非空（应能看到 CREATE TABLE / INSERT 语句）
wc -l backup-$(date +%F).sql
```

把这行加进 crontab / 定时任务，并把文件同步到网盘或另一台机器（D1 导出文件里含
用户表哈希与联系方式，按敏感数据保管）。

恢复（先确认目标库是空库或你确实要覆盖；**会与现有数据冲突**）：

```bash
# 恢复到一个新库（最安全）：先 create 新库、改 wrangler.toml 的 database_id 再导入
npx wrangler d1 execute info-manager-restore --remote --file=./backup-2026-10-30.sql

# 恢复前可先导出当前库留底，避免“恢复”变成第二次事故
npx wrangler d1 export info-manager --remote --output=before-restore-$(date +%F).sql
```

密钥轮换预案：`npx wrangler pages secret put AUTH_SECRET` 换新值 → 全部用户重新登录；
想回滚就重新 put 旧值（需自己保存过）。`ADMIN_PASSWORD` 轮换即时生效、无副作用。

## 本地开发调试（给以后的开发者/你自己改东西时看）

```bash
# 终端 1：构建产物 + 启动本地后端（含 D1 本地副本）
npm run build
npx wrangler pages dev dist

# 终端 2：启动前端开发服务器
npm run dev
```

浏览器访问 http://localhost:5173 （/api 会自动转发到本地后端）。
本地库是独立的 SQLite，需要自己跑一次建表与迁移（去掉 `--remote` 即作用于本地库）。

## 常见问题

**Q: 部署后登录报“网络连接失败”？**
A: 先确认已绑定自定义域名（`aiim.de5.net`）。`pages.dev` 在国内时快时慢，绑自有域名才稳定。

**Q: 免费额度会用完吗？**
A: 要看最先打满的是哪一项，Cloudflare 免费档大致是：
- Pages/Workers：每天 10 万次请求；每次请求 CPU 时间上限很低（免费版约 10ms 量级）；
- D1：每天 **10 万次写**、500 万次读、总存储 5GB。

**写额度才是本项目的瓶颈**：登录、注册、限速计数、埋点、AI 调用计数、P2P 轮询清理都会写 D1。
几百个正常用户用不完，但单个脚本刷 `/api/track` 能在几分钟内写满 10 万/日，之后全站登录都会
失败。因此代码里已经给 `/api/track`（默认 120 次/小时/账号）、`/api/ai/fetch`（60 次/小时/账号）、
平台 AI（120 次/小时/账号）和登录/注册都加了 D1 计数限速；上线后建议在 Cloudflare 控制台
盯一下 D1 的日写入量与 Workers CPU 时间（`wrangler pages deployment tail` 可看错误日志）。
另外 PBKDF2 10 万次迭代每次登录约几十毫秒 CPU，免费版若报 1102（CPU 超限），
说明该升级 Workers Paid 或降低迭代次数。

**Q: 数据库里的密码是明文吗？**
A: 不是。存的是 PBKDF2 加盐哈希（10 万次迭代），任何人都看不到原密码。管理员重置密码时也是生成一个新的哈希，明文只在弹窗里显示那一次。

**Q: 用户忘了密码怎么办？**
A: 后台「重置密码」生成临时密码 → 发给用户 → 用户登录后在「设置 → 账户」用旧密码（临时密码）
自行改掉。该自助改密入口此前因后端 SELECT 漏列 `password_hash` 而 100% 报“旧密码不正确”，
现已修复，并有 handler 级回归测试（`src/utils/backendHandlers.test.ts`）。

## 本次改动涉及的文件清单

```
schema.sql                          D1 建表脚本（accounts 已无 expires_at，新增 contact/pwd_epoch）
migration-pwd-epoch.sql             老库升级：加 pwd_epoch（改密吊销旧令牌），不幂等
migration-p2p-signals.sql           老库升级：建 p2p_signals 表，不幂等
migration-free-accounts.sql         老库升级：删 expires_at、加 contact，不幂等
public/_redirects                   SPA 路由回退（修 /admin 直链 404）
public/_headers                     安全响应头（CSP / X-Frame-Options / Referrer-Policy / nosniff / Permissions-Policy）
functions/lib/_auth.js              后端公共库（哈希/令牌/AUTH_SECRET 自检/限速/审计）
functions/lib/ssrf.js               SSRF 判断（补保留段、IPv4-mapped 十六进制、端口白名单）
functions/api/auth/register.js      自助注册（IP 限速 + 用户名去重 + 审计）
functions/api/auth/login.js         登录（大小写不敏感；成功只清 user 桶，不清 IP 桶）
functions/api/auth/password.js      买家自助改密
functions/api/track.js              埋点（新增每账号限速，防写满 D1 配额）
functions/api/ai/fetch.js           抓网页（新增每账号限速 + Content-Length 预检）
functions/api/sync/signal.js        信令中转（长度上限、guest 过期校验、错误信息脱敏）
functions/api/admin/*               后台：登录/列账户/停用启用删除/重置密码/统计/审计
src/lib/serverApi.ts                前端 API 客户端（错误码映射：删 EXPIRED，补 SERVER_MISCONFIGURED/AI_RATE_LIMITED）
src/utils/backendHandlers.test.ts   新增：handler 级集成测试（改密/登录限速/AUTH_SECRET/限速/信令）
src/utils/serverAuth.test.ts        补：password_hash 回归、AUTH_SECRET fail-closed、限速桶
src/utils/ssrfGuard.test.ts         补：审计实测的 SSRF 绕过用例与端口白名单
src/store/authStore.ts              登录态 + register() + 定期与服务器核对
src/components/auth/AuthPage        登录 / 注册双页签
src/components/admin/AdminPage      运营后台（账户 + 审计两个页签）
src/i18n/index.ts                   中英文案（新增注册与运营面板词条）
```

已删除的文件（卖卡/到期机制整体退役）：

```
src/utils/subscription.ts           getSubStatus / daysUntil / graceDaysLeft
src/components/layout/ExpiryBanner.tsx  到期倒计时横幅
```
