/**
 * 发送给模型的历史裁剪。
 *
 * 之前的实现把当前会话的全部消息原样塞进每次请求：对话越长、prompt token 越多，
 * 首字延迟和费用都线性上涨；工具调用多轮时同一段历史还会被重复发送多次。
 * 这里保留「最近、且总字符数受控」的一段：旧内容仍完整显示在本地会话里，
 * 只是不再发送给模型。AI 需要旧数据时可通过 list_libraries / search_items 工具检索。
 */
export interface HistoryLimits {
  /** 最多保留多少条消息（默认 24，约 12 轮问答） */
  maxMessages?: number
  /** 历史总字符数预算（默认 24000，约 8k tokens 中文） */
  maxChars?: number
  /** 单条消息最大字符数，超出截断（默认 6000） */
  maxMessageChars?: number
}

export type SimpleHistoryMessage = { role: 'user' | 'assistant'; content: string }

export function trimHistory(
  messages: SimpleHistoryMessage[],
  limits: HistoryLimits = {},
): SimpleHistoryMessage[] {
  const maxMessages = limits.maxMessages ?? 24
  const maxChars = limits.maxChars ?? 24_000
  const maxMessageChars = limits.maxMessageChars ?? 6_000

  const picked: SimpleHistoryMessage[] = []
  let chars = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (!m.content) continue
    if (picked.length >= maxMessages) break
    let content = m.content
    if (content.length > maxMessageChars) content = content.slice(0, maxMessageChars) + '\n…'
    // 至少保留最近一条（即使它单独就超预算），否则模型看不到当前问题
    if (picked.length > 0 && chars + content.length > maxChars) break
    picked.push({ role: m.role, content })
    chars += content.length
  }
  return picked.reverse()
}
