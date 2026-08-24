// AI 模块共用类型
export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

// 多模态消息内容段（文本 / 图片）
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  // 纯文本；含图片时使用 ContentPart 数组（需模型具备视觉能力）
  content: string | null | ContentPart[]
  tool_calls?: ToolCall[]
  tool_call_id?: string
}
