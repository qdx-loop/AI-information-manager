import type { ChatMessage, ToolCall } from './types'
import { API_BASE, getToken } from '@/lib/serverApi'

export interface ChatOptions {
  baseUrl?: string
  apiKey?: string
  model?: string
  /** 平台代管模式：走 /api/ai/proxy，密钥与模型由服务端决定（买家零配置） */
  viaProxy?: boolean
  messages: ChatMessage[]
  tools?: unknown[]
  signal?: AbortSignal
  onText?: (delta: string) => void
  onReasoning?: (delta: string) => void
  /** 上限输出 token 数（标题生成等轻量任务用，省额度/加快返回） */
  maxTokens?: number
}

interface ChoiceMessage {
  role: 'assistant'
  content: string | null
  reasoning_content?: string | null
  tool_calls?: ToolCall[]
}

// 通用 chat/completions 流式调用（业界标准格式；支持直连与平台代理两种通道）
export async function chat({
  baseUrl,
  apiKey,
  model,
  viaProxy,
  messages,
  tools,
  signal,
  onText,
  onReasoning,
  maxTokens,
}: ChatOptions): Promise<ChoiceMessage> {
  if (!viaProxy && (!baseUrl || !apiKey || !model)) {
    throw new Error('AI 配置不完整：请填写服务地址、API Key 与模型名')
  }
  const url = viaProxy
    ? `${API_BASE}/api/ai/proxy`
    : `${baseUrl!.replace(/\/$/, '')}/chat/completions`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const payload: Record<string, unknown> = {
    messages,
    tools: tools && tools.length ? tools : undefined,
    stream: true,
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
  }
  if (viaProxy) {
    // 代理模式：携带买家自己的登录令牌做身份核验（密钥由服务端持有）
    const token = getToken()
    if (!token) throw new Error('登录已失效，请重新登录后再使用 AI')
    headers.Authorization = `Bearer ${token}`
  } else {
    headers.Authorization = `Bearer ${apiKey!}`
    payload.model = model!
  }

  let res: Response
  // CF 边缘偶发瞬时 502/503（平台抖动，与上游无关）：静默重试一次可消除大部分体验问题。
  // 仅对 502/503/504 重试；429（真限流）与其余 4xx 重试无意义。
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    })
    if ([502, 503, 504].includes(res.status)) {
      const first = await res.text().catch(() => '')
      // 只有 CF 网关错误页（无 JSON 结构）才重试；我们自己的 JSON 错误（已含上游降级结果）不重试
      if (!first.trim().startsWith('{')) {
        await new Promise((r) => setTimeout(r, 500))
        res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal,
        })
      }
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new Error('网络连接失败，请检查网络后重试')
  }

  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => '')
    let msg = ''
    let code = ''
    try {
      const parsed = JSON.parse(txt) as { error?: string; code?: string }
      msg = parsed.error ?? ''
      code = parsed.code ?? ''
    } catch {
      /* 非 JSON 响应（如网关 HTML 错误页）——不把原文甩给用户 */
    }
    // 按错误码给出可读提示；未知/HTML 响应统一收口为简洁文案
    const friendly: Record<string, string> = {
      AI_RATE_LIMITED: msg || 'AI 调用过于频繁，请稍后再试',
      UPSTREAM_RATE_LIMITED: msg || 'AI 服务当前繁忙，请稍等 1-2 分钟再试',
      UPSTREAM_NETWORK: msg || '连接上游 AI 服务失败，请稍后重试',
      UPSTREAM_ERROR: msg || 'AI 服务暂时不可用，请稍后重试',
      PROXY_INTERNAL: msg || 'AI 服务暂时不可用，请稍后重试',
      AI_NOT_CONFIGURED: msg || '平台 AI 未配置，请联系管理员',
    }
    const final = code ? (friendly[code] ?? (msg || 'AI 服务异常，请稍后重试')) : (msg || 'AI 服务异常，请稍后重试')
    throw new Error(`AI 请求失败 (${res.status}): ${final}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  let content = ''
  let reasoningContent = ''
  const toolCallMap = new Map<number, ToolCall>()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta
        if (!delta) continue
        if (typeof delta.content === 'string' && delta.content) {
          content += delta.content
          onText?.(delta.content)
        }
        // 捕获思考过程（部分推理模型使用 reasoning_content 字段）
        if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
          reasoningContent += delta.reasoning_content
          onReasoning?.(delta.reasoning_content)
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx: number = tc.index ?? 0
            const existing = toolCallMap.get(idx) ?? {
              id: '',
              type: 'function' as const,
              function: { name: '', arguments: '' },
            }
            if (tc.id) existing.id = tc.id
            if (tc.function?.name) existing.function.name = tc.function.name
            if (tc.function?.arguments) existing.function.arguments += tc.function.arguments
            toolCallMap.set(idx, existing)
          }
        }
      } catch {
        // 跳过非 JSON 行
      }
    }
  }

  const toolCalls = Array.from(toolCallMap.values()).filter((t) => t.function.name)

  // EOF 健康检查：流正常结束必须"有话说完（content）或要调工具（tool_calls）"。
  // 两者皆空 = 流被异常截断（上游断流/网关中断），绝不能静默返回——否则 UI 表现为
  // "正在输出突然终止、无任何报错"。抛出明确错误，由上层展示并可重试。
  if (!content && !reasoningContent && toolCalls.length === 0) {
    throw new Error('AI 响应中断（流被提前断开），请重试')
  }

  // tool_calls 存在但 arguments JSON 解析不全（流中途断在参数里）也是截断：补齐再校验
  for (const tc of toolCalls) {
    try {
      JSON.parse(tc.function.arguments || '{}')
    } catch {
      throw new Error('AI 工具调用参数不完整（流被提前断开），请重试')
    }
  }

  return {
    role: 'assistant',
    content: content || null,
    reasoning_content: reasoningContent || null,
    tool_calls: toolCalls.length ? toolCalls : undefined,
  }
}
