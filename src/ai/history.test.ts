import { describe, it, expect } from 'vitest'
import { trimHistory } from './history'

const msg = (content: string, role: 'user' | 'assistant' = 'user') => ({ role, content })

describe('AI 历史裁剪', () => {
  it('对话很长时只发送最近的消息', () => {
    const history = Array.from({ length: 40 }, (_, i) => msg(`第${i}条`))
    const out = trimHistory(history, { maxMessages: 6 })
    expect(out).toHaveLength(6)
    expect(out[0].content).toBe('第34条')
    expect(out[5].content).toBe('第39条')
  })

  it('总字符预算会截断更旧的内容，但至少保留最近一条', () => {
    const history = [msg('a'.repeat(100)), msg('b'.repeat(100)), msg('c'.repeat(100))]
    const out = trimHistory(history, { maxMessages: 24, maxChars: 150 })
    expect(out).toHaveLength(1)
    expect(out[0].content).toBe('c'.repeat(100))

    const out2 = trimHistory(history, { maxMessages: 24, maxChars: 250 })
    expect(out2.map((m) => m.content.length)).toEqual([100, 100])
  })

  it('单条超长回答会被截断，避免一条消息撑爆预算', () => {
    const out = trimHistory([msg('x'.repeat(10_000))], { maxMessageChars: 120 })
    expect(out[0].content.length).toBe(122) // 120 + '\n…'
  })

  it('默认保留顺序不变，空内容消息跳过', () => {
    const out = trimHistory([msg('你好'), msg(''), msg('在吗', 'assistant')])
    expect(out.map((m) => m.content)).toEqual(['你好', '在吗'])
  })
})
