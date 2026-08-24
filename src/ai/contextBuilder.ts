import type { Library, FieldDef, Item } from '@/types'
import type { AIScope } from '@/types'

export interface LibraryContext {
  library: Library
  fields: FieldDef[]
  items: Item[]
}

const PREVIEW_ROWS_PER_LIB = 15 // 预览模式：每个库最多直接展示的条数
const MAX_FIELD_VALUE_LEN = 200

function schemaLine(fields: FieldDef[]): string {
  const visible = fields.filter((f) => f.visible)
  return (
    visible
      .map((f) => `${f.label}(${f.key}:${f.type}${f.type === 'select' ? ':' + f.options.join('/') : ''})`)
      .join(', ') || '(无字段)'
  )
}

function rowText(fields: FieldDef[], it: Item): string {
  const visible = fields.filter((f) => f.visible)
  const vals = visible
    .map((f) => {
      const v = it.fields[f.key]
      const s = v === null || v === undefined ? '' : String(v)
      return `${s.length > MAX_FIELD_VALUE_LEN ? s.slice(0, MAX_FIELD_VALUE_LEN) + '…' : s}`
    })
    .join(' | ')
  return `[id=${it.id}] ${vals}`
}

/**
 * 构建注入提示词的数据上下文（预览式）：
 * - 全部管理库的总览（名称/ID/分类/字段/条目数）
 * - 目标库的前 N 条数据预览
 * 更大数据量交给 AI 调用 search_items / stat_items / list_libraries 检索，
 * 避免“每次对话塞入全部数据”导致的慢、贵、答不准问题。
 */
export function buildContext(
  scope: AIScope,
  contexts: LibraryContext[],
  currentLibraryId: string | null,
): string {
  if (contexts.length === 0) {
    return '当前没有任何管理库数据。用户尚未创建管理库。'
  }

  const overview = contexts
    .map((c) => {
      const live = c.items.filter((i) => !i.deletedAt)
      return `- ${c.library.name} (id=${c.library.id}, 分类=${c.library.category || '无'}, 共${live.length}条)\n  字段: ${schemaLine(c.fields)}`
    })
    .join('\n')

  const selected =
    scope === 'all' ? contexts : contexts.filter((c) => c.library.id === currentLibraryId)

  const previews = (selected.length > 0 ? selected : [contexts[0]])
    .map((c) => {
      const live = c.items.filter((i) => !i.deletedAt)
      const rows = live.slice(0, PREVIEW_ROWS_PER_LIB).map((it, idx) => `  ${idx + 1}. ${rowText(c.fields, it)}`)
      const note =
        live.length > PREVIEW_ROWS_PER_LIB
          ? `\n  …(共 ${live.length} 条，仅预览前 ${PREVIEW_ROWS_PER_LIB} 条；更多请调用 search_items 或 stat_items)`
          : ''
      return `### 管理库「${c.library.name}」(id=${c.library.id}) 数据预览:\n${rows.join('\n') || '  (空库)'}${note}`
    })
    .join('\n\n')

  return `## 管理库总览（共 ${contexts.length} 个）\n${overview}\n\n${previews}`
}

export const SYSTEM_PROMPT = `你是「信息管理助手」，一个具备完整数据操作能力的智能体（Agent）。用户通过自然语言让你查询、统计、整理、增删改他们的管理库数据。

# 工作方式
1. 先思考需要什么信息，再行动：不确定有哪些库、字段结构或数据位置时，先调用 list_libraries / search_items / stat_items 查清，不要凭猜测回答。
2. 回答检索、统计类问题时优先使用工具获取准确结果，禁止编造数据；引用条目时附带 id，例如「张三 (id=abc123)」。
3. 复杂任务（涉及多步写入）先用一小段话向用户列出你的执行计划，然后逐步执行。
4. 所有写操作（新增/修改/删除条目、建库、改模板）都会弹出确认窗由用户把关，你只负责发起。

# 可用能力
- search_items：关键词搜索条目
- stat_items：计数 / 分组统计 / 数值求和平均
- list_libraries：查看全部管理库结构与数量
- execute_item_action：条目增删改
- locate_item：在界面中定位高亮某条目
- execute_library_action：新建/重命名/删除/改分类管理库
- execute_template_action：增删改字段模板
- save_memory：维护你的长期记忆（add 新增 / update 按编号修改 / remove 按编号删除）
- create_chart：把统计结果绘制成图表展示给用户（柱状/折线/饼图等），用户可下载图片。统计、对比、占比类问题回答时优先配一张图表

# 附件处理
用户消息可能携带附件：
- Excel/CSV 表格：内容以「[附件 Excel/CSV 表格]」文本块提供。可按用户要求分析数据、生成图表，或把数据录入到指定管理库（录入前先确认字段能对上模板）。
- 图片：仅当所接入模型具备视觉能力时可见；若你无法理解图片，请如实告知用户当前模型不支持看图。

# 记忆
系统会在对话开始时提供你此前保存的记忆（带编号）。当用户表达值得长期记住的偏好、习惯或信息时，调用 save_memory(op=add)。发现记忆过时或重复时，主动用 update/remove 清理。

# 规则
- 用中文回答，简洁专业。
- 字段 key 请使用字段模板括号中的英文名，不要用中文显示名。
`
