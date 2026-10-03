// 「用 AI 建议字段」：当一个管理库还没有任何字段时，
// 让用户不用自己想「该记哪些维度」。
//
// 这是本产品最该有、但一直没有的功能：用户卡住的不是「不会用」，
// 而是「不知道该建什么字段」。所以入口要放在零字段的空状态里，
// 而不是让人去聊天面板里自己想怎么提问。
//
// 设计取舍：
// - 用一次普通的补全（不走 tool-calling），模型只需回一段 JSON，容错更好、延迟更低
// - 建议**不直接写入**：先给用户看，可以逐条删掉不要的，再确认
// - 失败必须看得见：这里失败等于功能不存在，不能静默
import type { ChatOptions } from './client'
import { chat } from './client'

/** 建议字段的中间形态（还没分配 id / sortOrder） */
export interface DraftField {
  label: string
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'rating'
  options?: string[]
  required: boolean
}

const TYPE_RE = /^(text|textarea|number|date|select|checkbox|rating)$/

const SYSTEM = `你是一个帮助非技术用户设计信息记录字段的助手。
用户会告诉你一个管理库的用途，你给出这个库最值得记录的字段。

要求：
1. 3 到 6 个字段，不要更多。用户是普通办公人员，不是数据库工程师。
2. 第 1 个字段必须是用来当标题的短文本（text），比如「客户名称」「产品名」「标题」。
3. 字段名用中文，口语化，不要数据库术语（不要"创建时间""状态码"这类，除非确实需要）。
4. 只给真正会被填写或筛选的字段。不要为了显得完整而加字段。
5. 最多一个 select 类型，选项不超过 6 个。
6. 只输出 JSON，不要任何解释文字、不要 markdown 代码块。

输出格式：
{"fields":[{"label":"字段名","type":"text","required":true,"options":[]}]}`

/**
 * 根据库名与用途生成字段建议。
 *
 * @param libraryName 库名（如「客户管理」）
 * @param hint 用户补充的用途说明（可为空）
 */
export async function draftFields(
  opts: Pick<ChatOptions, 'baseUrl' | 'apiKey' | 'model' | 'viaProxy'>,
  libraryName: string,
  hint = '',
  signal?: AbortSignal,
): Promise<DraftField[]> {
  const userMsg = hint.trim()
    ? `管理库名称：${libraryName}\n我要记的东西：${hint.trim()}`
    : `管理库名称：${libraryName}\n我要记的东西：${libraryName}`

  const res = await chat({
    ...opts,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: userMsg },
    ],
    // 只回一小段 JSON，不需要长输出
    maxTokens: 600,
    signal,
  })

  const raw = (res.content ?? '').trim()
  const parsed = extractJSON(raw)
  if (!parsed) {
    throw new Error('AI 返回的内容无法解析，请重试')
  }
  const fields = normalize(parsed.fields)
  if (fields.length === 0) {
    throw new Error('AI 没有给出可用的字段建议，请重试')
  }
  return fields
}

/** 模型经常会在 JSON 外面套 ```json 或加一句「以下是建议：」，这里都能捞出来 */
function extractJSON(text: string): { fields?: unknown } | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const candidates = [fenced?.[1], text]
  for (const c of candidates) {
    if (!c) continue
    const start = c.indexOf('{')
    const end = c.lastIndexOf('}')
    if (start === -1 || end <= start) continue
    try {
      const o = JSON.parse(c.slice(start, end + 1)) as { fields?: unknown }
      if (o && typeof o === 'object') return o
    } catch {
      /* 试下一个候选 */
    }
  }
  return null
}

function normalize(raw: unknown): DraftField[] {
  if (!Array.isArray(raw)) return []
  const out: DraftField[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const label = String(o.label ?? '').trim()
    // 字段名是必需的，也是用户唯一会看的东西；空的就丢掉
    if (!label || label.length > 20) continue
    if (seen.has(label)) continue
    seen.add(label)
    const type = TYPE_RE.test(String(o.type)) ? (String(o.type) as DraftField['type']) : 'text'
    // select 却没有选项的话，模型这一条基本是废的，退化成文本更诚实
    const options = Array.isArray(o.options)
      ? o.options.map((x) => String(x).trim()).filter(Boolean).slice(0, 6)
      : []
    out.push({
      label,
      type: type === 'select' && options.length === 0 ? 'text' : type,
      options: type === 'select' ? options : undefined,
      // 第一条必须是标题字段，所以第一个字段一律必填
      required: out.length === 0 ? true : o.required === true,
    })
    if (out.length >= 6) break
  }
  // 确保第一个是短文本标题：模型经常给第一个字段也安排 textarea
  if (out.length > 0 && out[0].type === 'textarea') out[0].type = 'text'
  return out
}