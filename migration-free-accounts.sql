-- 迁移：去掉卖卡/到期机制，改为自助注册的永久免费账户
-- 执行方式：npx wrangler d1 execute info-manager --file=./migration-free-accounts.sql --remote
--
-- 背景：产品从「按卡种收费」改为「自助注册 + 永久免费」。因此：
--   1. expires_at 失去意义（所有账户永不过期），整列删除，
--      避免留下无人读写的死字段被后续代码误用。
--   2. 新增 contact，供管理员识别用户 / 必要时联系（如忘记密码、改邮箱）。
--
-- 安全说明：expires_at 未建索引、非主键、非唯一，SQLite 的 DROP COLUMN 是纯元数据
-- 操作，不重写表数据。若目标 SQLite 版本不支持该语句，本条会报错并回滚，
-- 此时功能不受任何影响（代码已不读该列），补 DROP COLUMN 即可。

ALTER TABLE accounts ADD COLUMN contact TEXT;

ALTER TABLE accounts DROP COLUMN expires_at;
