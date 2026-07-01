import type { FieldDef, FieldType } from '@/types'

// AI 写入操作的工具定义（OpenAI function calling 格式）
export const ITEM_ACTION_TOOL = {
  type: 'function' as const,
  function: {
    name: 'execute_item_action',
    description:
      '对管理库条目执行新增、修改或删除操作。调用前请确保已了解目标管理库的字段模板。所有操作会经用户确认后执行。',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'delete'],
          description: '操作类型：create=新增, update=修改, delete=删除',
        },
        libraryId: { type: 'string', description: '目标管理库 ID' },
        itemId: { type: 'string', description: 'update/delete 时必填，目标条目 ID' },
        fields: {
          type: 'object',
          description: 'create/update 时必填，字段键值对。必须使用字段模板中的 key（括号中的英文名），不要使用 label（中文显示名）',
          additionalProperties: true,
        },
        reason: { type: 'string', description: '执行该操作的理由（展示给用户）' },
      },
      required: ['action', 'libraryId'],
    },
  },
}

// 定位条目工具：AI 调用后前端高亮对应行
export const LOCATE_ITEM_TOOL = {
  type: 'function' as const,
  function: {
    name: 'locate_item',
    description: '在列表中高亮并定位到指定条目，便于用户查看。可在回答检索/统计结果后调用。',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: '要定位的条目 ID' },
      },
      required: ['itemId'],
    },
  },
}

// 保存记忆工具：AI 主动记录值得记住的信息
export const SAVE_MEMORY_TOOL = {
  type: 'function' as const,
  function: {
    name: 'save_memory',
    description:
      '将信息保存到长期记忆中。保存的内容会在未来的所有对话中提供给你。适合记录用户偏好、常用操作习惯、重要备注等。传入的内容会完全替换当前记忆，请在调用时把已有记忆和新信息合并后再传入完整内容。',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: '完整的记忆内容（条目化、简洁），将替换之前的全部记忆',
        },
      },
      required: ['content'],
    },
  },
}

// 管理库操作工具：创建/重命名/删除/改分类
export const LIBRARY_ACTION_TOOL = {
  type: 'function' as const,
  function: {
    name: 'execute_library_action',
    description:
      '对管理库执行创建、重命名、删除或修改分类操作。所有操作会经用户确认后执行。',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'rename', 'delete', 'setCategory'],
          description: 'create=新建管理库, rename=重命名, delete=删除, setCategory=修改分类',
        },
        libraryId: { type: 'string', description: 'rename/delete/setCategory 时必填，目标管理库 ID' },
        name: { type: 'string', description: 'create/rename 时的管理库名称' },
        category: { type: 'string', description: 'create/setCategory 时的分类名称' },
        reason: { type: 'string', description: '执行该操作的理由（展示给用户）' },
      },
      required: ['action'],
    },
  },
}

// 字段模板操作工具：新增/修改/删除字段
export const TEMPLATE_ACTION_TOOL = {
  type: 'function' as const,
  function: {
    name: 'execute_template_action',
    description:
      '对管理库的字段模板执行新增、修改或删除字段操作。例如添加「性别」下拉字段、修改字段类型等。所有操作会经用户确认后执行。',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['addField', 'updateField', 'deleteField'],
          description: 'addField=新增字段, updateField=修改字段, deleteField=删除字段',
        },
        libraryId: { type: 'string', description: '目标管理库 ID' },
        fieldId: { type: 'string', description: 'updateField/deleteField 时必填，目标字段 ID' },
        label: { type: 'string', description: '字段显示名（如「性别」「姓名」）' },
        type: {
          type: 'string',
          enum: ['text', 'textarea', 'number', 'date', 'select', 'checkbox', 'rating'],
          description: '字段类型：text=文本, textarea=多行文本, number=数字, date=日期, select=下拉单选, checkbox=复选框, rating=评分',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'select 类型时的选项列表（如 ["男","女"]）',
        },
        required: { type: 'boolean', description: '是否必填' },
        visible: { type: 'boolean', description: '是否可见' },
        reason: { type: 'string', description: '执行该操作的理由（展示给用户）' },
      },
      required: ['action', 'libraryId'],
    },
  },
}

export const ALL_TOOLS = [
  ITEM_ACTION_TOOL,
  LOCATE_ITEM_TOOL,
  SAVE_MEMORY_TOOL,
  LIBRARY_ACTION_TOOL,
  TEMPLATE_ACTION_TOOL,
]

export interface ItemAction {
  action: 'create' | 'update' | 'delete'
  libraryId: string
  itemId?: string
  fields?: Record<string, unknown>
  reason?: string
}

// 校验并规范化 AI 返回的 action 参数
export function parseItemAction(args: unknown, fields: FieldDef[]): ItemAction | null {
  const a = args as Record<string, unknown>
  if (!a || typeof a.action !== 'string' || typeof a.libraryId !== 'string') return null
  const action = a.action as ItemAction['action']
  if (!['create', 'update', 'delete'].includes(action)) return null

  const result: ItemAction = {
    action,
    libraryId: a.libraryId,
    itemId: typeof a.itemId === 'string' ? a.itemId : undefined,
    fields:
      a.fields && typeof a.fields === 'object'
        ? (a.fields as Record<string, unknown>)
        : undefined,
    reason: typeof a.reason === 'string' ? a.reason : undefined,
  }

  // 类型强制转换：按字段模板把字符串值转成对应类型
  if (result.fields) {
    const coerced: Record<string, unknown> = { ...result.fields }

    // 将 AI 可能用字段标签（label）作为 key 的情况，映射回真正的 field key
    for (const f of fields) {
      if (coerced[f.label] !== undefined && coerced[f.key] === undefined) {
        coerced[f.key] = coerced[f.label]
        delete coerced[f.label]
      }
    }

    for (const f of fields) {
      const v = coerced[f.key]
      if (v === undefined) continue
      if (f.type === 'number') coerced[f.key] = v === '' ? null : Number(v)
      else if (f.type === 'rating') coerced[f.key] = v === '' ? 0 : Number(v)
      else if (f.type === 'checkbox') coerced[f.key] = v === true || v === 'true' || v === '是' || v === 1
      else if (f.type === 'date') coerced[f.key] = typeof v === 'string' ? v : String(v)
      else coerced[f.key] = v === null ? null : String(v)
    }
    result.fields = coerced
  }

  return result
}

// —————— 管理库操作 ——————

export interface LibraryAction {
  action: 'create' | 'rename' | 'delete' | 'setCategory'
  libraryId?: string
  name?: string
  category?: string
  reason?: string
}

export function parseLibraryAction(args: unknown): LibraryAction | null {
  const a = args as Record<string, unknown>
  if (!a || typeof a.action !== 'string') return null
  const action = a.action as LibraryAction['action']
  if (!['create', 'rename', 'delete', 'setCategory'].includes(action)) return null
  return {
    action,
    libraryId: typeof a.libraryId === 'string' ? a.libraryId : undefined,
    name: typeof a.name === 'string' ? a.name : undefined,
    category: typeof a.category === 'string' ? a.category : undefined,
    reason: typeof a.reason === 'string' ? a.reason : undefined,
  }
}

// —————— 字段模板操作 ——————

export interface TemplateAction {
  action: 'addField' | 'updateField' | 'deleteField'
  libraryId: string
  fieldId?: string
  label?: string
  type?: FieldType
  options?: string[]
  required?: boolean
  visible?: boolean
  reason?: string
}

export function parseTemplateAction(args: unknown): TemplateAction | null {
  const a = args as Record<string, unknown>
  if (!a || typeof a.action !== 'string' || typeof a.libraryId !== 'string') return null
  const action = a.action as TemplateAction['action']
  if (!['addField', 'updateField', 'deleteField'].includes(action)) return null
  return {
    action,
    libraryId: a.libraryId,
    fieldId: typeof a.fieldId === 'string' ? a.fieldId : undefined,
    label: typeof a.label === 'string' ? a.label : undefined,
    type: typeof a.type === 'string' ? (a.type as FieldType) : undefined,
    options: Array.isArray(a.options) ? (a.options as string[]) : undefined,
    required: typeof a.required === 'boolean' ? a.required : undefined,
    visible: typeof a.visible === 'boolean' ? a.visible : undefined,
    reason: typeof a.reason === 'string' ? a.reason : undefined,
  }
}
