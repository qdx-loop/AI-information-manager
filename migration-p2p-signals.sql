-- 局域网同步的服务端信令表：两台同账号设备自动交换 WebRTC offer/answer。
-- 只存信令（几 KB 的 SDP），库数据/配置仍走 WebRTC 直连，不经过服务器。
CREATE TABLE IF NOT EXISTS p2p_signals (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  role TEXT NOT NULL,               -- 'host'（发起方）| 'guest'（加入方）
  offer TEXT,                        -- 发起方写一次
  answer TEXT,                       -- 加入方写一次
  status TEXT NOT NULL DEFAULT 'waiting',  -- waiting（等对端）| done
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_p2p_signals_account ON p2p_signals(account_id, created_at);

-- 信令 10 分钟自动过期清理由端点处理（过期行对轮询不可见并删除）
