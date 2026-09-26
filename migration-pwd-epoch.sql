-- 迁移：为已部署环境的 accounts 表添加 pwd_epoch 列（改密吊销旧令牌）。
-- 仅需执行一次；代码对缺失该列的旧库 fail-open（视为 0，不阻断登录）。
-- 执行方式：npx wrangler d1 execute info-manager --file=./migration-pwd-epoch.sql --remote
ALTER TABLE accounts ADD COLUMN pwd_epoch INTEGER NOT NULL DEFAULT 0;
