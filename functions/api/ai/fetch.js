// POST /api/ai/fetch — 服务端抓网页：返回清洗后的正文文本（供 AI 工具使用）
// 仅登录买家可用；拒绝内网地址防 SSRF。
import { json, errorJson, requireUser } from '../../lib/_auth'

const MAX_BYTES = 300 * 1024
const MAX_CHARS = 16000

function isPrivateHost(host) {
  try {
    const ip = host.match(/^(\d{1,3}\.){4}$/) ? host.split('.').map(Number) : null
    if (ip) {
      if (ip[0] === 10 || ip[0] === 127 || ip[0] === 0) return true
      if (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31) return true
      if (ip[0] === 192 && ip[1] === 168) return true
      if (ip[0] === 169 && ip[1] === 254) return true
      return false
    }
    return /^(localhost|local|\.localhost|\.local|\.lan)$/i.test(host) || host.endsWith('.local')
  } catch {
    return true
  }
}

function htmlToText(html) {
  return html
    .replace(/\u0000/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<\/?(div|p|br|li|tr|h[1-6]|section|article|blockquote|table|thead|tbody|td|th|ul|ol|figure|summary|details)[^>]*>/gi, '\n')
    .replace(/<td[^>]*>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#\d+;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

export async function onRequestPost({ request, env }) {
  const { error } = await requireUser(request, env)
  if (error) return error

  let body
  try {
    body = await request.json()
  } catch {
    return errorJson('请求格式错误或 JSON 解析失败', 400, 'BAD_BODY')
  }

  const rawUrl = String(body?.url ?? '').trim()
  if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
    return errorJson('无效 URL，需以 http:// 或 https:// 开头', 400, 'BAD_URL')
  }
  const host = new URL(rawUrl).hostname
  if (!host || isPrivateHost(host)) {
    return errorJson('该域名不可抓取（内网/本地域名禁止）', 400, 'BLOCKED_HOST')
  }

  let upstream
  try {
    upstream = await fetch(rawUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        Accept_Language: 'zh-CN,zh;q=0.9',
      },
      redirect: 'follow',
      cf: { cacheTtl: 600, cacheEverything: false },
    })
  } catch {
    return errorJson('抓取失败：网络不可达或目标拒绝', 502, 'FETCH_FAIL')
  }

  if (!upstream.ok) {
    return errorJson(`抓取失败：对方返回 ${upstream.status}`, 502, 'UPSTREAM_ERROR')
  }

  const ct = upstream.headers.get('content-type') || ''
  if (!ct.includes('text/html') && !ct.includes('text/plain') && !ct.includes('application/json')) {
    return errorJson('目标不是网页/文本/JSON', 415, 'BAD_TYPE')
  }

  const buf = await upstream.arrayBuffer()
  if (buf.byteLength > MAX_BYTES) {
    return errorJson(`内容过大（>${MAX_BYTES / 1024}KB）`, 413, 'TOO_LARGE')
  }

  const rawText = new TextDecoder('utf-8', { fatal: false }).decode(buf)
  const extracted = htmlToText(rawText)
  const text = extracted.length > MAX_CHARS ? extracted.slice(0, MAX_CHARS) : extracted

  let title = ''
  const m = /<title[^>]*>([^<]*)<\/title>/i.exec(rawText)
  if (m) title = m[1].trim().slice(0, 200)

  return json({
    url: upstream.url,
    title,
    text,
    textLength: text.length,
    truncated: extracted.length > MAX_CHARS,
  })
}

export async function onRequest() {
  return errorJson('不支持的请求方法', 405, 'METHOD')
}
