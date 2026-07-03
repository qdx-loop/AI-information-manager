// 同步码加密/解密工具
// 使用 XOR + Base64 混淆加密，配合固定密钥

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
