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

## 第一步：创建数据库（存账号和到期时间）

```bash
npx wrangler d1 create info-manager
```

命令执行后会输出一段信息，找到 `"database_id": "xxxx..."` 这一串，
把它填进项目根目录的 `wrangler.toml` 文件里（替换 REPLACE_WITH_YOUR_D1_DATABASE_ID）。

然后建表（已有部署也请重跑一次，会新增登录限速所需的表）：

```bash
npx wrangler d1 execute info-manager --file=./schema.sql --remote
```

**老数据库升级（2026-09 改成免费自助注册必做）**：删掉 `expires_at` 列、新增 `contact` 列。
不跑这条也能用（代码已不读该列），但后台会一直显示老账户的过期时间：

```bash
npx wrangler d1 execute info-manager --file=./migration-free-accounts.sql --remote
```

## 第二步：创建 Pages 项目（先有项目，密码才有地方存）

```bash
npx wrangler pages project create info-manager --production-branch=main
```

## 第三步：设置密钥

```bash
# 管理后台的登录密码（自己想一个，别用弱密码）
npx wrangler pages secret put ADMIN_PASSWORD

# 给登录令牌签名的随机密钥（随便一长串乱码即可）
npx wrangler pages secret put AUTH_SECRET

# ——以下三个可选——配置后用户即可在「设置 → AI 配置」选"平台提供"，零配置使用 AI：
npx wrangler pages secret put PLATFORM_AI_BASEURL   # 上游地址，如 https://api.deepseek.com/v1
npx wrangler pages secret put PLATFORM_AI_KEY       # 上游 API Key
npx wrangler pages secret put PLATFORM_AI_MODEL     # 统一模型名，如 deepseek-chat
```

被恶意灌水时，紧急关闭注册（不用重新部署，随时能改回来）：

```bash
npx wrangler pages secret put REGISTRATION_OPEN     # 填 0 = 关闭注册；删掉这个密钥 = 重新开放
```

> 平台 AI 的密钥只存在服务器端，买家端看不到、拿不走；模型由服务端锁定。
> 建议为该 Key 设置消费限额，防止被刷。

每个命令回车后会提示输入值，粘贴后回车。

生成随机密钥偷懒办法：终端运行

```bash
openssl rand -hex 32
```

把输出复制下来当 AUTH_SECRET 用。

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
- 打开 `网址/admin` 输入管理密码 → 你的运营后台 ✅

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

## 本地开发调试（给以后的开发者/你自己改东西时看）

```bash
# 终端 1：启动本地后端（含 D1 本地副本）
npx wrangler pages dev dist

# 终端 2：启动前端开发服务器
npm run dev
```

浏览器访问 http://localhost:5173 （/api 会自动转发到本地后端）。

## 常见问题

**Q: 部署后登录报“网络连接失败”？**
A: 先确认已绑定自定义域名（`aiim.de5.net`）。`pages.dev` 在国内时快时慢，绑自有域名才稳定。

**Q: 免费额度会用完吗？**
A: Cloudflare 免费档每天 10 万次请求、数据库每天 500 万次读取。几百个用户随便用都用不完。

**Q: 数据库里的密码是明文吗？**
A: 不是。存的是 PBKDF2 加盐哈希（10 万次迭代），任何人都看不到原密码。管理员重置密码时也是生成一个新的哈希，明文只在弹窗里显示那一次。

## 本次改动涉及的文件清单

```
schema.sql                          D1 建表脚本（accounts 已无 expires_at，新增 contact）
migration-free-accounts.sql         老库升级：删 expires_at、加 contact
functions/lib/_auth.js              后端公共库（哈希/令牌/注册校验/限速/审计）
functions/api/auth/register.js      自助注册（IP 限速 + 用户名去重 + 审计）
functions/api/auth/login.js         登录（大小写不敏感）
functions/api/auth/password.js      买家自助改密
functions/api/admin/*               后台：登录/列账户/停用启用删除/重置密码/统计/审计
src/lib/serverApi.ts                前端 API 客户端（含 apiRegister / adminAccountOp）
src/store/authStore.ts              登录态 + register() + 定期与服务器核对
src/components/auth/AuthPage        登录 / 注册双页签
src/components/admin/AdminPage      运营后台（重写：账户 + 审计两个页签）
src/i18n/index.ts                   中英文案（新增注册与运营面板词条）
```

已删除的文件（卖卡/到期机制整体退役）：

```
src/utils/subscription.ts           getSubStatus / daysUntil / graceDaysLeft
src/components/layout/ExpiryBanner.tsx  到期倒计时横幅
```
