-- Cloudflare D1 建表脚本（权限层数据库）
-- 执行方式：npx wrangler d1 execute info-manager --file=./schema.sql --remote

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL DEFAULT '',
  expires_at INTEGER NOT NULL,          -- 到期时间戳（毫秒）
  disabled INTEGER NOT NULL DEFAULT 0,  -- 1=已停用
  created_at INTEGER NOT NULL,
  last_login INTEGER
);

CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username);

-- 登录限速（固定窗口计数；仅失败才计数，成功即清零）
-- 已部署过的环境需重跑一次本文件完成迁移：
--   npx wrangler d1 execute info-manager --file=./schema.sql --remote
CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,          -- 'admin:<ip>' 或 'user:<username>:<ip>'
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL  -- 窗口起始时间戳（毫秒）
);
