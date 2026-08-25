// /api/ai/proxy — 平台代管 AI 转发
//   POST：登录用户把 chat/completions 请求转发给服务端持有的上游 AI（密钥不出服务器）
//   GET ：探测平台 AI 是否已启用（只返回布尔值，不含任何敏感信息）
// 环境变量（wrangler pages secret put）：
//   PLATFORM_AI_BASEURL  如 https://api.deepseek.com/v1
//   PLATFORM_AI_KEY      上游服务的 API Key
//   PLATFORM_AI_MODEL    统一使用的模型名
import { json, errorJson, requireUser } from '../../lib/_auth'

function platformConfigured(env) {
  return !!(env.PLATFORM_AI_BASEURL && env.PLATFORM_AI_KEY && env.PLATFORM_AI_MODEL)
}

export async function onRequestGet({ env }) {
  return json({ enabled: platformConfigured(env) })
}

export async function onRequestPost({ request, env }) {
  const { error } = await requireUser(request, env)
  if (error) return error

  if (!platformConfigured(env)) {
    return errorJson('平台 AI 未配置，请联系管理员', 503, 'AI_NOT_CONFIGURED')
  }

  let body
  try {
    body = await request.json()
  } catch {
    return errorJson('请求格式错误', 400, 'BAD_BODY')
  }
  // 模型由服务端锁定，防止调用方指定任意昂贵模型
  body.model = env.PLATFORM_AI_MODEL

  let upstream
  try {
    upstream = await fetch(`${env.PLATFORM_AI_BASEURL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.PLATFORM_AI_KEY}`,
      },
      body: JSON.stringify(body),
    })
  } catch {
    return errorJson('连接上游 AI 服务失败，请稍后重试', 502, 'UPSTREAM_NETWORK')
  }

  if (!upstream.ok || !upstream.body) {
    const txt = await upstream.text().catch(() => '')
    return errorJson(`上游 AI 返回错误 (${upstream.status}): ${txt.slice(0, 180)}`, 502, 'UPSTREAM_ERROR')
  }

  // 原样透传 SSE 流式响应
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export async function onRequest() {
  return errorJson('不支持的请求方法', 405, 'METHOD')
}
