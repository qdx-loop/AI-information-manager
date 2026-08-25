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
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new Error('网络连接失败，请检查网络后重试')
  }

  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => '')
    let msg = txt.slice(0, 200)
    try {
      msg = (JSON.parse(txt) as { error?: string }).error ?? msg
    } catch {
      /* 非 JSON 响应，保留原文 */
    }
    throw new Error(`AI 请求失败 (${res.status})${msg ? `: ${msg}` : ''}`)
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
  return {
    role: 'assistant',
    content: content || null,
    reasoning_content: reasoningContent || null,
    tool_calls: toolCalls.length ? toolCalls : undefined,
  }
}
