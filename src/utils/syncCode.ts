// 同步码加密/解密工具
//
// 安全说明：
// 这是一个轻量混淆方案（XOR + Base64），并非真正的加密。
// 密钥硬编码在前端 bundle 中，理论上可从编译后的 JS 中提取。
// 它的主要作用是避免同步码明文直接暴露 Supabase URL 和 anon key，
// 防止用户在屏幕截图、聊天分享时意外泄露可读凭证。
//
// 真正的安全边界在于 Supabase 的 RLS 策略——由于本项目按用户自有
// Supabase 项目的需求禁用了 RLS，任何拿到同步码的人都能读写该
// Supabase 项目的数据。因此：
//   1. 同步码应像密码一样保管，不要公开或提交到代码仓库
//   2. 仅在受信任的设备之间传递同步码
//   3. 如需更高安全级别，应在 Supabase 侧重新启用 RLS 并按账户隔离

const SECRET_KEY = 'InfoMgmtSync2026'

// 将字符串与密钥进行 XOR 混淆
function xorEncrypt(text: string, key: string): string {
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return result
}

// 生成同步码：加密配置信息
// 格式：cloudUrl|cloudKey|aiBaseUrl|aiApiKey|aiModel
export function encodeSyncCode(config: {
  cloudUrl: string
  cloudKey: string
  aiBaseUrl?: string
  aiApiKey?: string
  aiModel?: string
}): string {
  const raw = [
    config.cloudUrl,
    config.cloudKey,
    config.aiBaseUrl || '',
    config.aiApiKey || '',
    config.aiModel || '',
  ].join('|')
  const encrypted = xorEncrypt(raw, SECRET_KEY)
  // 使用 btoa 对加密后的字符串进行 Base64 编码
  // 先转 UTF-8 安全编码再 base64，避免中文/特殊字符问题
  return btoa(unescape(encodeURIComponent(encrypted)))
}

// 解密同步码
export function decodeSyncCode(code: string): {
  cloudUrl: string
  cloudKey: string
  aiBaseUrl: string
  aiApiKey: string
  aiModel: string
} | null {
  try {
    const encrypted = decodeURIComponent(escape(atob(code.trim())))
    const decrypted = xorEncrypt(encrypted, SECRET_KEY)
    const parts = decrypted.split('|')
    if (parts.length === 2 || parts.length === 5) {
      return {
        cloudUrl: parts[0],
        cloudKey: parts[1],
        aiBaseUrl: parts[2] || '',
        aiApiKey: parts[3] || '',
        aiModel: parts[4] || '',
      }
    }
    return null
  } catch {
    return null
  }
}
