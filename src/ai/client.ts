import type { ChatMessage, ToolCall } from './types'

export interface ChatOptions {
  baseUrl: string
  apiKey: string
  model: string
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

// OpenAI 兼容 chat completions 流式调用
export async function chat({
  baseUrl,
  apiKey,
  model,
  messages,
  tools,
  signal,
  onText,
  onReasoning,
}: ChatOptions): Promise<ChoiceMessage> {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools: tools && tools.length ? tools : undefined,
      stream: true,
    }),
    signal,
  })

  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => '')
    throw new Error(`AI 请求失败 (${res.status}): ${txt.slice(0, 200)}`)
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
        // 捕获思考过程（DeepSeek 等模型使用 reasoning_content 字段）
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
            if (tc.function?.name) existing.function.name += tc.function.name
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
