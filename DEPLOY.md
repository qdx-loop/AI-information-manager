# 部署指南（老板版 · 一步一步跟着做）

> 目标：把软件部署到 Cloudflare，得到一个网址。
> 用户打开网址登录使用；你打开 `网址/admin` 卖卡、续费、停用。
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

然后建表：

```bash
npx wrangler d1 execute info-manager --file=./schema.sql --remote
```

## 第二步：创建 Pages 项目（先有项目，密码才有地方存）

```bash
npx wrangler pages project create info-manager --production-branch=main
```

## 第三步：设置两个密码

```bash
# 管理后台的登录密码（自己想一个，别用弱密码）
npx wrangler pages secret put ADMIN_PASSWORD

# 给登录令牌签名的随机密钥（随便一长串乱码即可）
npx wrangler pages secret put AUTH_SECRET
```

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

- 把 `https://info-manager.pages.dev` 发给买家 → 他注册不了，只能用你发的账号登录 ✅
- 打开 `https://info-manager.pages.dev/admin` 输入管理密码 → 你的卖卡后台 ✅

## 第五步（强烈建议）：绑定自己的域名

`pages.dev` 的网址在国内时快时慢。花约 60 元/年买个域名（阿里云/腾讯云均可），
在 Cloudflare 控制台：**Workers & Pages → info-manager → Custom domains → 添加**，
按提示去域名商那里加一条 CNAME 解析即可。

---

## 日常卖卡流程（在 /admin 后台操作）

| 买家需求 | 你的操作 |
|---|---|
| 买体验卡 | 点「卖卡 · 生成账号」→ 选"体验卡(3天)" → 复制用户名密码发给买家 |
| 买月/季/年卡 | 同上，选对应卡种 |
| 续费 | 找到该用户的行 → 点「续费」→ 选时长。未到期的在原时间上累加，不亏天数 |
| 用户闹脾气想退款 | 点「停用」→ 对方立刻无法登录 |
| 用户忘记密码 | 点「改密」→ 设置新密码告诉对方 |
| 查看谁快到期 | 表格里橙色标签就是 3 天内到期的 |

注意：生成账号时弹出的密码**只显示这一次**，务必当场复制发给买家。

## 到期/停用是怎么生效的

- 登录时：服务器核对到期时间，过期直接拒绝；
- 使用中：软件每分钟自查一次、每 10 分钟向服务器核实一次，切走窗口再回来也会核实；
- 所以你在后台点了「停用」或改了到期时间，用户最迟 10 分钟内被踢下线。

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
A: 多半是没绑域名、pages.dev 被墙。换网络试一下，或按第五步绑自己的域名。

**Q: 免费额度会用完吗？**
A: Cloudflare 免费档每天 10 万次请求、数据库每天 500 万次读取。几百个用户随便用都用不完。

**Q: 数据库里的密码是明文吗？**
A: 不是。存的是 PBKDF2 加盐哈希（10万次迭代），连你也看不到买家原密码，只能重置。

## 本次改动涉及的文件清单

```
functions/lib/_auth.js          后端公共库（哈希/令牌/卡种）
functions/api/auth/*            登录/状态核对/改密
functions/api/admin/*           后台登录/列账号/生成账号/续费停用等
schema.sql                      D1 建表脚本
wrangler.toml                   Cloudflare 配置
src/lib/serverApi.ts            前端 API 客户端
src/store/authStore.ts          登录态 + 到期自动踢下线
src/components/auth/AuthPage    登录页（已移除自由注册）
src/components/admin/AdminPage  管理后台页面（新）
src/components/settings/*       账户页改走服务器；记忆编辑器结构化
src/components/layout/Sidebar   显示到期日
src/ai/memory.ts                结构化 AI 记忆（新）
src/ai/tools.ts                 新增搜索/统计/库总览工具
src/ai/contextBuilder.ts        新系统提示词 + 预览式上下文
src/components/ai/AIPanel.tsx   Agent 循环升级至 15 步 + 执行过程展示
```
