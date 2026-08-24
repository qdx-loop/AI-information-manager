import type { FieldDef, FieldType } from '@/types'

// AI 写入操作的工具定义（function calling 标准格式）
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

// 搜索条目工具：AI 主动检索数据，而不是依赖注入的全量上下文
export const SEARCH_ITEMS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'search_items',
    description:
      '在管理库中按关键词搜索条目（对所有字段值做包含匹配）。适合查找特定记录、筛选数据。返回匹配条目及其 id。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词（对字段值做不区分大小写的包含匹配）' },
        libraryId: { type: 'string', description: '限定搜索的管理库 ID。不传则搜索全部管理库' },
        fieldKey: { type: 'string', description: '可选，只在该字段中搜索' },
        limit: { type: 'number', description: '最多返回条数，默认 20，最大 50' },
      },
    },
  },
}

// 统计工具：计数 / 分组统计 / 求和 / 平均
export const STAT_ITEMS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'stat_items',
    description:
      '对管理库条目做统计分析：总条数、按某字段的分组计数、数值字段的求和/平均。比逐条阅读数据更准确高效。',
    parameters: {
      type: 'object',
      properties: {
        libraryId: { type: 'string', description: '目标管理库 ID。不传则对全部管理库分别统计' },
        groupByField: { type: 'string', description: '分组统计的字段 key（如需按性别分组计数）' },
        op: {
          type: 'string',
          enum: ['count', 'sum', 'avg'],
          description: 'count=计数(默认), sum=求和, avg=平均（sum/avg 需提供 valueField）',
        },
        valueField: { type: 'string', description: 'sum/avg 的目标数值字段 key' },
        filterText: { type: 'string', description: '可选，先按关键词过滤再统计' },
      },
    },
  },
}

// 管理库总览工具
export const LIST_LIBRARIES_TOOL = {
  type: 'function' as const,
  function: {
    name: 'list_libraries',
    description:
      '列出全部管理库的名称、ID、分类、字段模板与条目数。当不确定数据在哪、或需要跨库操作时先调用它。',
    parameters: { type: 'object', properties: {} },
  },
}

// 结构化记忆工具：支持单条增删改，不再整体覆盖
export const SAVE_MEMORY_TOOL = {
  type: 'function' as const,
  function: {
    name: 'save_memory',
    description:
      '管理你的长期记忆（用户偏好、习惯、重要备注等），记忆在所有未来对话中可见。支持新增、修改、删除单条，避免重复记忆。',
    parameters: {
      type: 'object',
      properties: {
        op: {
          type: 'string',
          enum: ['add', 'update', 'remove', 'replaceAll'],
          description: 'add=新增, update=按编号修改, remove=按编号删除, replaceAll=整体替换（慎用）',
        },
        texts: {
          type: 'array',
          items: { type: 'string' },
          description: 'add/replaceAll 时为记忆内容列表；update 时传 [编号, 新内容]；remove 时传要删除的编号字符串',
        },
      },
      required: ['op'],
    },
  },
}

// 图表生成工具：AI 构建图表配置（本质是让 AI 写声明式配置代码），前端渲染并可下载
export const CREATE_CHART_TOOL = {
  type: 'function' as const,
  function: {
    name: 'create_chart',
    description:
      '根据数据生成统计图表（柱状图、折线图、饼图、散点图等），渲染给用户查看，用户可以下载为图片。适合展示统计、对比、趋势类结果。调用前先用统计工具拿到准确数据。',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '图表标题（同时用作下载文件名）' },
        option: {
          type: 'object',
          description:
            '图表配置对象。常见写法：柱状/折线 {"xAxis":{"type":"category","data":["一月","二月"]},"yAxis":{"type":"value"},"series":[{"type":"bar","data":[100,200]}]}；饼图 {"series":[{"type":"pie","data":[{"name":"男","value":10},{"name":"女","value":8}]}]}。可加 legend、color 等美化字段。不要包含 tooltip 以外的交互项。',
          additionalProperties: true,
        },
      },
      required: ['title', 'option'],
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
  SEARCH_ITEMS_TOOL,
  STAT_ITEMS_TOOL,
  LIST_LIBRARIES_TOOL,
  CREATE_CHART_TOOL,
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
      if (f.type === 'number') {
        const n = v === '' || v === null ? NaN : Number(v)
        coerced[f.key] = Number.isNaN(n) ? null : n
      }
      else if (f.type === 'rating') {
        const n = v === '' || v === null ? NaN : Number(v)
        coerced[f.key] = Number.isNaN(n) ? 0 : n
      }
      else if (f.type === 'checkbox') coerced[f.key] = v === true || v === 'true' || v === '是' || v === 1 || v === '1'
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
