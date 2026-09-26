// /api/ai/proxy — 平台代管 AI 转发（多供应商自动降级）
//   POST：登录用户把 chat/completions 请求转发给服务端持有的上游 AI（密钥不出服务器）
//   GET ：探测平台 AI 是否已启用（只返回布尔值，不含任何敏感信息）
//
// 供应商链（按顺序尝试，失败自动切换下一个）：
//   主：  PLATFORM_AI_BASEURL / _KEY / _MODEL          （如 OpenRouter openrouter/free）
//   备1： PLATFORM_AI_FALLBACK_1_BASEURL / _KEY / _MODEL（如 Agnes 2.5）
//   备2： PLATFORM_AI_FALLBACK_2_BASEURL / _KEY / _MODEL（如 Agnes 2.0）
//
// 切换策略（第一性原则：优先可用性，同时不滥用重试）：
//   - 连接失败 / 429 / 5xx → 立即切换下一个供应商（每档只试一次，绝不重试同一档）
//   - 4xx（参数/鉴权错误）→ 不切换，原样报错（切了也一样错）
//   - 一旦某档开始返回流（拿到 200 响应头），透传时不再回溯切换
//   - 全部档位失败 → 返回最后一个失败原因
import { json, errorJson, requireUser, checkWindowCount } from '../../lib/_auth'

// 读取一档供应商配置；任一字段缺失则该档不可用
function providerAt(env, idx) {
  const p = idx === 0
    ? { base: env.PLATFORM_AI_BASEURL, key: env.PLATFORM_AI_KEY, model: env.PLATFORM_AI_MODEL }
    : {
        base: env[`PLATFORM_AI_FALLBACK_${idx}_BASEURL`],
        key: env[`PLATFORM_AI_FALLBACK_${idx}_KEY`],
        model: env[`PLATFORM_AI_FALLBACK_${idx}_MODEL`],
      }
  if (!p.base || !p.key || !p.model) return null
  return { base: String(p.base).replace(/\/$/, ''), key: String(p.key), model: String(p.model) }
}

// 可用供应商列表（按优先级）
function providers(env) {
  const list = []
  for (let i = 0; i < 3; i++) {
    const p = providerAt(env, i)
    if (p) list.push(p)
  }
  return list
}

function platformConfigured(env) {
  return providers(env).length > 0
}

export async function onRequestGet({ env }) {
  return json({ enabled: platformConfigured(env) })
}

export async function onRequestPost({ request, env }) {
  try {
    const { account, error } = await requireUser(request, env)
    if (error) return error

    const chain = providers(env)
    if (chain.length === 0) {
      return errorJson('平台 AI 未配置，请联系管理员', 503, 'AI_NOT_CONFIGURED')
    }

    // 按用户限速：防止单账户无限烧平台 AI 额度（可用 AI_RATE_MAX / AI_RATE_WINDOW_MS 调整，默认 120 次/小时）
    const maxCount = Number(env.AI_RATE_MAX) > 0 ? Number(env.AI_RATE_MAX) : 120
    const windowMs = Number(env.AI_RATE_WINDOW_MS) > 0 ? Number(env.AI_RATE_WINDOW_MS) : 3600_000
    const limit = await checkWindowCount(env, `ai:${account.id}`, maxCount, windowMs)
    if (!limit.allowed) {
      return errorJson(`AI 调用过于频繁，请约 ${limit.waitMin} 分钟后再试`, 429, 'AI_RATE_LIMITED')
    }

    let body
    try {
      body = await request.json()
    } catch {
      return errorJson('请求格式错误', 400, 'BAD_BODY')
    }

    // 逐档尝试：失败原因可切换的（连接/429/5xx）换下一档；不可切换的（4xx 参数错）直接返回
    let lastFail = { status: 502, brief: '无可用上游' }
    for (const p of chain) {
      let upstream
      let fetchErr = null
      try {
        upstream = await fetch(`${p.base}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${p.key}`,
            // 普通浏览器 UA：部分上游网关的 CF 防火墙会拦截无 UA 的服务器流量
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({ ...body, model: p.model }), // 模型由服务端按档位锁定
          cf: { cacheTtl: 0, cacheEverything: false },
        })
      } catch (e) {
        fetchErr = e
      }

      if (fetchErr) {
        console.error(`[ai-proxy] ${p.base} 连接失败:`, String(fetchErr?.message ?? fetchErr))
        lastFail = { status: 502, brief: '上游连接失败' }
        continue // 切下一档
      }

      if (upstream.ok && upstream.body) {
        // 成功：原样透传 SSE 流式响应
        return new Response(upstream.body, {
          status: 200,
          headers: {
            'Content-Type': upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        })
      }

      const status = upstream.status
      // 408/429/401/403/5xx 都是"该档自身的问题"（限流/凭证失效/服务挂），切换下一档
      if ([408, 429, 401, 403].includes(status) || status >= 500) {
        const txt = await upstream.text().catch(() => '')
        console.error(`[ai-proxy] ${p.base} ${status}（切换备用）:`, txt.replace(/<[^>]+>/g, ' ').slice(0, 120))
        lastFail = { status, brief: status === 429 ? '上游限流' : status === 401 || status === 403 ? '上游凭证失效' : `上游 ${status}` }
        continue
      }

      // 其余 4xx（参数/请求体错误）切了也一样错，直接返回
      if (status >= 400 && status < 500) {
        const txt = await upstream.text().catch(() => '')
        console.error(`[ai-proxy] ${p.base} ${status}:`, txt.replace(/<[^>]+>/g, ' ').slice(0, 120))
        return errorJson(`AI 服务返回错误（${status}），请稍后重试或联系管理员`, status, 'UPSTREAM_ERROR')
      }
    }

    // 全部档位失败
    const friendly =
      lastFail.status === 429
        ? 'AI 服务当前繁忙，请稍等 1-2 分钟再试'
        : 'AI 服务暂时不可用，请稍后重试'
    return errorJson(friendly, 502, lastFail.status === 429 ? 'UPSTREAM_RATE_LIMITED' : 'UPSTREAM_ERROR')
  } catch (e) {
    // 兜底：任何未捕获异常（D1 偶发错误等）都返回 JSON，避免 CF 边缘渲染出 HTML 502 页
    console.error('[ai-proxy] 未捕获异常:', e?.message ?? e, e?.stack ?? '')
    return errorJson('AI 服务暂时不可用，请稍后重试（若持续失败请联系管理员）', 500, 'PROXY_INTERNAL')
  }
}

export async function onRequest() {
  return errorJson('不支持的请求方法', 405, 'METHOD')
}
