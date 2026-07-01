# Web 端信息管理应用 — 实施计划

## 一、总览 (Summary)

从零搭建一个 Web 端信息管理应用，支持账户体系、管理库 + 字段模板、条目 CRUD/搜索/筛选/排序/回收站/导入导出、AI 深度集成（读 + 写带确认）、本地存储与云端 Supabase 直连双模式、本地备份恢复。

**技术栈（已与用户确认）**
- 前端：React 18 + Vite + TypeScript
- UI 库：Ant Design v5（成熟、中文友好、内置暗色主题，契合用户对视觉一致性的偏好）
- 状态管理：Zustand
- 路由：React Router v6
- 本地存储：Dexie.js（IndexedDB 封装）
- 云端存储：@supabase/supabase-js（用户自填 Project URL + anon key，浏览器直连）
- 拖拽：@dnd-kit/core + @dnd-kit/sortable
- CSV：papaparse；Excel：xlsx（SheetJS）
- 日期：dayjs
- AI：fetch 调用 OpenAI 兼容 `/chat/completions`（base_url + api_key + model 可配置）
- 密码哈希：Web Crypto API（PBKDF2-SHA256，无额外依赖）

**部署目标**：纯静态 SPA，可部署到 Cloudflare Pages（契合用户既有部署偏好）。

---

## 二、当前状态分析 (Current State Analysis)

- 工作目录 `c:\Users\qdx\Desktop\inforation manage` 为**空目录**，属于全新项目。
- 无既有代码、配置、依赖需兼容。
- 无既有项目记忆（memory 目录下无此项目记录）。
- 因此本计划为「从零搭建」，无需考虑迁移或向后兼容。

---

## 三、架构设计 (Architecture)

### 3.1 存储抽象层（核心设计）

定义统一 `DataProvider` 接口，两个实现，按当前存储模式切换。业务层只依赖接口，不感知存储介质。

```ts
// src/types/dataProvider.ts
export interface DataProvider {
  // 账户
  registerAccount(username, password): Promise<Account>;
  loginAccount(username, password): Promise<Account>;
  listAccounts(): Promise<Account[]>;
  updatePassword(accountId, newPassword): Promise<void>;
  deleteAccount(accountId): Promise<void>;
  // 管理库
  listLibraries(accountId): Promise<Library[]>;
  createLibrary(lib): Promise<Library>;
  renameLibrary(id, name): Promise<void>;
  deleteLibrary(id): Promise<void>;          // 软删除→回收站
  restoreLibrary(id): Promise<void>;
  purgeLibrary(id): Promise<void>;           // 永久删除
  reorderLibraries(accountId, orderedIds): Promise<void>;
  // 字段模板
  getTemplate(libId): Promise<FieldDef[]>;
  saveTemplate(libId, fields): Promise<void>;
  cloneTemplate(srcLibId, dstLibId): Promise<void>;
  // 条目
  listItems(libId): Promise<Item[]>;
  createItem(item): Promise<Item>;
  updateItem(item): Promise<void>;
  deleteItem(id): Promise<void>;             // 软删除→回收站
  restoreItem(id): Promise<void>;
  purgeItem(id): Promise<void>;
  pinItem(id, pinned): Promise<void>;
  reorderItems(libId, orderedIds): Promise<void>;
  // 回收站
  listTrash(accountId): Promise<TrashEntry[]>;
  // 备份/恢复（仅本地模式有意义，云端靠 Supabase 自身）
  exportAll(accountId): Promise<BackupBlob>;
  importAll(accountId, blob): Promise<void>;
}
```

- `LocalDataProvider`：基于 Dexie（IndexedDB），所有表带 `accountId` 字段做账户隔离。
- `SupabaseDataProvider`：基于 @supabase/supabase-js，表结构镜像本地，用 `account_id` 列隔离；RLS 策略由用户在其 Supabase 项目自行配置（文档提供 SQL 脚本）。
- 工厂 `getProvider(mode, config)` 返回当前实现。

### 3.2 数据模型（TypeScript 接口）

```ts
Account      { id, username, passwordHash, salt, createdAt }
Library      { id, accountId, name, category, sortOrder, deletedAt? }
FieldDef     { id, libraryId, key, label, type, options?, required?, visible, sortOrder }
  // type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'rating'
  // options?: string[] (用于 select)；rating 1-5 星
Item         { id, libraryId, accountId, fields: Record<fieldKey, value>, pinned, sortOrder, createdAt, updatedAt, deletedAt? }
TrashEntry   { kind: 'library'|'item', record: Library|Item, deletedAt }
Settings     { storageMode: 'local'|'cloud', cloud: {url, anonKey}, ai: {baseUrl, apiKey, model, scope} }
```

### 3.3 账户体系策略

- **本地模式**：账户存 IndexedDB，密码用 PBKDF2 + 随机 salt 哈希；登录后 `accountId` 存 sessionStorage（刷新保持登录）。数据按 `accountId` 隔离。
- **云端模式**：账户作为数据同步到 Supabase `accounts` 表（用户名 + 密码哈希）。开启云存储后，任意设备登录同一账户即可拉取其全部数据。
  - 注意：不使用 Supabase Auth（因其要求 email），改用自建 `accounts` 表 + 密码哈希。用户拥有自己的 Supabase 项目，安全由其负责；我们在文档中提供 RLS 建议 SQL。
- 「同步所有账户与数据」：云端模式下，当前浏览器内已有的所有账户 + 数据全量上传到 Supabase，并支持从云端拉取覆盖本地（首次开启时弹确认）。

### 3.4 AI 集成策略

- **配置**：设置页填 `baseUrl` / `apiKey` / `model` / 作用域（单库 / 全部）。
- **上下文构建**（`ai/contextBuilder.ts`）：将选定作用域内所有管理库的字段模板 + 条目数据序列化为结构化 JSON（裁剪超长内容，带 token 预估），作为 system prompt 注入。
- **调用**：`ai/client.ts` 用 fetch 调用 `{baseUrl}/chat/completions`，stream 可选。
- **能力划分**：
  - **只读能力**（问答/检索/统计/分析）：AI 直接返回文本/表格/列表。
  - **写入能力**（新增/修改/删除条目）：通过 OpenAI **function calling**，定义工具 `execute_item_action`，参数含 `{action, libraryId, itemId?, fields?}`。AI 调用工具 → 前端解析 → **弹出确认弹窗**展示将要执行的操作 → 用户确认 → 调 `DataProvider` 执行。
- **界面联动**：AI 返回检索结果时附带条目 `itemId`，前端高亮列表中对应行并滚动定位；点击 AI 结果中的条目引用直接跳转。

### 3.5 项目目录结构

```
src/
  main.tsx
  App.tsx
  router.tsx
  types/
    index.ts                 # 全部 TS 接口
    dataProvider.ts          # DataProvider 接口
  db/
    dexie.ts                 # Dexie 实例 + schema
    localProvider.ts         # LocalDataProvider
    supabaseProvider.ts      # SupabaseDataProvider
    providerFactory.ts       # getProvider()
    supabaseSchema.sql       # 供用户执行的建表 SQL（文档资源）
    backup.ts                # 本地备份/恢复（JSON）
  store/
    authStore.ts             # 当前账户
    appStore.ts              # 存储模式 + 设置
    libraryStore.ts          # 库/字段/条目状态 + actions
  ai/
    client.ts                # OpenAI 兼容 fetch 客户端
    contextBuilder.ts        # 数据→上下文
    tools.ts                 # function-calling 工具定义 + 解析
  utils/
    crypto.ts                # PBKDF2 哈希
    csv.ts                   # papaparse 封装
    excel.ts                 # xlsx 封装
    id.ts                    # uuid
  components/
    auth/LoginPage.tsx
    auth/RegisterPage.tsx
    layout/AppShell.tsx      # 侧边栏 + 主区域 + AI 抽屉
    layout/Sidebar.tsx       # 库列表/分类/回收站入口/设置
    library/LibraryToolbar.tsx   # 搜索/筛选/排序/导入导出/新建
    library/LibraryTable.tsx     # 条目表格（含置顶/编辑/删除）
    library/ItemEditor.tsx       # 新建/编辑条目弹窗（按模板动态渲染字段）
    library/TemplateEditor.tsx   # 字段模板配置（增删改/拖拽排序/显隐）
    library/TrashBin.tsx         # 回收站
    library/ImportExport.tsx     # CSV/Excel 导入导出
    fields/                      # 各字段类型渲染组件
      TextField.tsx, NumberField.tsx, DateField.tsx,
      SelectField.tsx, CheckboxField.tsx, RatingField.tsx
    ai/AIPanel.tsx               # 聊天 + 作用域选择 + 联动
    ai/ConfirmActionModal.tsx    # AI 写入操作确认弹窗
    settings/SettingsPage.tsx    # 账户/存储/AI/备份恢复
  styles/index.css
```

---

## 四、实施步骤 (Proposed Changes)

按依赖顺序分阶段，每阶段产出可运行/可验证成果。

### 阶段 0：项目脚手架
- `npm create vite@latest . -- --template react-ts` 初始化。
- 安装依赖：`antd @ant-design/icons zustand react-router-dom dexie @supabase/supabase-js @dnd-kit/core @dnd-kit/sortable papaparse xlsx dayjs uuid` + 类型 `@types/papaparse @types/uuid`。
- 配置 `vite.config.ts`（路径别名 `@`→`src`）、`tsconfig.json`、Ant Design `ConfigProvider`（中文 + 主题）。
- 建立目录骨架（空文件占位）。

### 阶段 1：类型 + 存储抽象层
- 实现 `types/`、`db/dexie.ts`、`db/localProvider.ts`（完整 CRUD + 软删除 + 回收站 + 排序）。
- 实现 `utils/crypto.ts`（PBKDF2）。
- 实现 `db/providerFactory.ts`（local 分支先通；cloud 分支占位）。
- 单测/手测：注册→登录→新建库→新建字段→新建条目→删除→回收站→恢复。

### 阶段 2：账户 + 布局 + 路由
- `store/authStore.ts`、`LoginPage`/`RegisterPage`、`AppShell` + `Sidebar`。
- 路由守卫：未登录跳登录页。
- 账户管理 UI（在设置页：新增/删除账户、改密码）。

### 阶段 3：管理库 + 字段模板
- `Sidebar` 库列表：新建/重命名/删除/分类/拖拽排序（dnd-kit）。
- `TemplateEditor`：字段增删改/重命名/拖拽排序/显隐切换；模板一键复用到新库（`cloneTemplate`）。
- 7 种字段类型渲染组件（`components/fields/*`）。

### 阶段 4：条目数据管理
- `LibraryToolbar`：关键词搜索（跨所有可见字段）、条件筛选（按字段+值）、自定义排序、置顶。
- `LibraryTable`：表格展示（动态列来自模板可见字段）、行内编辑/删除、置顶按钮。
- `ItemEditor`：按模板动态表单，保存校验 `required`。
- `TrashBin`：恢复/永久删除。
- `ImportExport`：CSV（papaparse）、Excel（xlsx）双向；导入时字段映射 UI。

### 阶段 5：回收站已含于阶段 1/4，此处补全批量操作与回收站自动清理策略（30 天后提示永久删除，但不自动清，遵循用户手动）。

### 阶段 6：AI 集成
- `ai/client.ts`：OpenAI 兼容 chat 调用（支持流式渲染）。
- `ai/contextBuilder.ts`：单库/全部库上下文构建。
- `ai/tools.ts`：`execute_item_action` 工具定义 + 参数校验。
- `AIPanel`：聊天 UI、作用域切换、消息流式展示、检索结果带条目引用 chip。
- `ConfirmActionModal`：展示 action 详情（新增/修改/删除 + 目标库 + 字段值差异），确认后执行。
- 界面联动：AI 返回 `itemId` 时，触发 `libraryStore.focusItem(id)` → 表格高亮 + 滚动。

### 阶段 7：云端存储（Supabase）
- `db/supabaseProvider.ts`：实现 `DataProvider` 全部方法。
- 设置页：存储模式开关；开启云端时填 `url` + `anonKey`，校验连通性。
- 首次开启：本地全量数据上传 → 后续写入双写或仅云端（默认切到云端为唯一源）。
- 提供 `supabaseSchema.sql`（建表 + 索引 + RLS 建议）作为应用内「帮助」页展示，供用户复制到其 Supabase 项目执行。

### 阶段 8：本地备份恢复
- `db/backup.ts`：`exportAll` → JSON 文件下载；`importAll` → 文件选择 + 解析 + 覆盖确认。
- 设置页入口。

### 阶段 9：打磨与通用要求
- 响应式适配（Ant Design Grid）。
- 暗/亮主题切换（appStore + ConfigProvider theme）。
- 空状态、加载态、错误提示（Ant Design message/Result）。
- 关键操作二次确认（删除库、永久删除、清空回收站）。

---

## 五、关键设计决策与假设 (Assumptions & Decisions)

1. **UI 库选 Ant Design v5**：用户偏好视觉一致性，AntD 提供统一设计语言 + 内置暗色主题 + 中文本地化，适合管理类应用。（未问用户，作为合理技术决策。）
2. **账户不用 Supabase Auth**：需求明确「用户名+密码」（非 email），且要求「同步所有账户」→ 账户本身是数据。改用自建 `accounts` 表 + PBKDF2 哈希。安全责任在用户自有的 Supabase 项目。
3. **存储抽象层为单一源**：业务层不直接碰 Dexie/Supabase，便于双模式切换与未来扩展。
4. **AI 写操作强制确认**：通过 function calling 让 AI 输出结构化 action，前端弹窗展示后人工确认执行，满足「写入类操作必须确认」。
5. **回收站为软删除**：`deletedAt` 字段，列表查询默认过滤 `deletedAt=null`；回收站单独查 `deletedAt!=null`。永久删除才物理删除。
6. **导入导出字段映射**：导入时若列名与字段 label/key 不匹配，弹映射 UI 让用户手动对应，避免数据错位。
7. **AI 上下文裁剪**：单次上下文超长时按条目 `createdAt` 倒序截断并提示「仅最近 N 条已接入」。
8. **不引入后端服务**：纯前端 SPA + 用户自备 Supabase，符合静态部署与「云数据库直连」要求。
9. **密码哈希用 PBKDF2**：Web Crypto 原生支持，无依赖；迭代次数 100k，salt 16 字节随机。

---

## 六、验证步骤 (Verification)

每个阶段完成后执行：

1. **类型与构建**：`npm run build` 无 TS 报错。
2. **本地模式端到端**（阶段 1-5 完成后）：
   - 注册账户 A → 登录 → 新建库「联系人」+ 字段模板（姓名/电话/生日/标签/星标/备注）→ 新建 3 条 → 搜索「张」→ 筛选星标≥4 → 置顶一条 → 删除一条 → 回收站恢复 → 导出 CSV → 清空后导入回填。
   - 注销 → 注册账户 B → 确认看不到 A 的数据（账户隔离）。
3. **AI 集成**（阶段 6 完成后）：
   - 配置 baseUrl/apiKey/model（用 DeepSeek 或 OpenAI 测试）。
   - 单库提问「电话以 138 开头的联系人有几位」→ 返回数字 + 条目引用 → 点击引用定位到表格行。
   - 让 AI「新增一条姓名=测试 电话=000 的联系人」→ 弹确认窗 → 确认 → 表格出现新行。
   - 让 AI 删除某条 → 弹确认 → 确认 → 条目进回收站。
4. **云端模式**（阶段 7 完成后）：
   - 用自有 Supabase 项目填入 url + anonKey → 执行 schema SQL → 开启云端 → 本地数据上传成功 → 换浏览器/隐身窗口登录同账户 → 数据可见 → 新增条目 → 回原浏览器刷新 → 数据同步。
5. **备份恢复**（阶段 8 完成后）：导出 JSON → 删除若干库/条目 → 导入 JSON → 数据回到导出时状态。
6. **通用体验**：暗/亮主题切换无残留色；移动端窄屏侧边栏可折叠；所有删除操作有二次确认。

---

## 七、不在本次范围内（澄清边界）

- 不做服务端渲染（SSR）。
- 不做多用户协作 / 权限共享（单用户自有数据）。
- 不做 AI 模型本地微调或向量数据库（仅用上下文注入）。
- 不做移动端原生打包（仅 Web 响应式）。
- Supabase RLS 由用户在其项目自行配置，应用仅提供建议 SQL。
