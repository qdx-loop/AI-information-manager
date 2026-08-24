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
