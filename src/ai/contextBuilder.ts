import type { Library, FieldDef, Item } from '@/types'
import type { AIScope } from '@/types'

export interface LibraryContext {
  library: Library
  fields: FieldDef[]
  items: Item[]
}

const MAX_ITEMS_PER_LIB = 200
const MAX_FIELD_VALUE_LEN = 500

// 将管理库数据序列化为 AI 上下文（结构化文本）
export function buildContext(
  scope: AIScope,
  contexts: LibraryContext[],
  currentLibraryId: string | null,
): string {
  const selected =
    scope === 'all'
      ? contexts
      : contexts.filter((c) => c.library.id === currentLibraryId)

  if (selected.length === 0) {
    return '当前没有可访问的管理库数据。'
  }

  const blocks = selected.map((c) => {
    const visibleFields = c.fields.filter((f) => f.visible)
    const schema = visibleFields
      .map((f) => {
        const extra =
          f.type === 'select' ? `（可选值: ${f.options.join('/')})` : ''
        return `- ${f.label} (${f.key}, 类型: ${f.type}${f.required ? ', 必填' : ''})${extra}`
      })
      .join('\n')

    const truncated = c.items.slice(0, MAX_ITEMS_PER_LIB)
    const rows = truncated
      .map((it, idx) => {
        const vals = visibleFields
          .map((f) => {
            const v = it.fields[f.key]
            const s = v === null || v === undefined ? '' : String(v)
            return `${f.label}=${s.length > MAX_FIELD_VALUE_LEN ? s.slice(0, MAX_FIELD_VALUE_LEN) + '…' : s}`
          })
          .join(', ')
        return `  [${idx + 1}] id=${it.id} ${vals}`
      })
      .join('\n')

    const note =
      c.items.length > MAX_ITEMS_PER_LIB
        ? `\n（注：该库共 ${c.items.length} 条，仅展示最近 ${MAX_ITEMS_PER_LIB} 条）`
        : ''

    return `## 管理库: ${c.library.name} (id=${c.library.id}, 分类: ${c.library.category})
字段模板:
${schema || '  (无字段)'}
条目数据 (共 ${c.items.length} 条):
${rows || '  (无条目)'}${note}`
  })

  return blocks.join('\n\n')
}

export const SYSTEM_PROMPT = `你是一个信息管理应用的 AI 助手。你可以基于用户的管理库数据回答问题、检索、统计、分析，并具备完整的管理能力。

规则：
1. 回答时引用条目请在括号中附带其 id，例如「张三 (id=abc123)」。
2. 当用户要求新增/修改/删除条目时，必须调用 execute_item_action 工具，系统会弹出确认窗由用户确认后执行。
3. 检索或统计结果中，如需帮用户定位某条目，调用 locate_item 工具。
4. 不要编造不存在的数据；如信息不足请说明。
5. 用中文回答。
6. 你拥有长期记忆能力。系统会在每次对话时把你之前保存的记忆提供给你。当用户表达了值得记住的偏好、习惯、常用操作或重要信息时，请调用 save_memory 工具将其保存，以便在未来的对话中使用。记忆应简洁、条目化，避免冗余。
7. 你可以管理管理库：新建、重命名、删除、修改分类。调用 execute_library_action 工具，经用户确认后执行。
8. 你可以管理字段模板：新增字段、修改字段、删除字段。调用 execute_template_action 工具，经用户确认后执行。例如用户说「加一个性别字段，下拉选择，选项男和女」，你应调用 execute_template_action 并传入 action=addField, label=性别, type=select, options=["男","女"]。`
