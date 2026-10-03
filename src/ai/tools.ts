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
          description:
            'create/update 时必填，字段键值对。必须使用字段模板中的 key（括号中的英文名），不要使用 label（中文显示名）。' +
            '例外：如果目标库**一个字段都没有**（用户还没配置模板），优先用 execute_template_action 先加上合适的字段；' +
            '如果用户明确只想留一段文字，就写进保留键 __text（纯文本），这样能存下来而不会因为没有字段可用而失败。',
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

// 图表生成工具：AI 只负责「给什么数据」，外观由前端的 house style 统一处理，
// 所以这里的描述要引导 AI 给出「语义正确」的数据，而不是纠结样式。
export const CREATE_CHART_TOOL = {
  type: 'function' as const,
  function: {
    name: 'create_chart',
    description: [
      '根据数据生成统计图表，渲染给用户查看，用户可以下载为图片。',
      '调用前先用统计工具拿到准确数据。',
      '',
      '你只需要提供数据与语义，配色/字体/网格线等样式由系统统一套用，',
      '不要自己写 color、itemStyle、label、grid、tooltip 等样式字段（写了也会被覆盖）。',
      '',
      '选图规则：',
      '- 分类之间的对比 → 柱状图；随时间变化的趋势 → 折线图；',
      '  构成占比（类别不超过 5 个）→ 饼图；两个连续变量的相关性 → 散点图。',
      '- 类目超过 12 个时不要画图，改用文字列出或只画 Top 8。',
      '- 多系列对比最多 5 个系列：配色必须做到色盲可辨，超过 5 个读者就分不清了。',
      '- 饼图的类别最多 5 个，更细的部分归到「其他」。',
      '',
      '务必遵守：',
      '- 数值一律用纯数字（不要带单位、货币符号、千分位），单位写在 yAxis.name 上。',
      '- 类目名要短（6 个字以内）；需要更详细的说明写进标题。',
      '- 时间趋势必须按时间先后排序。',
      '- 占比对比优先给出数值本身，前端会自动算百分比。',
      '- 如果数据量很小（少于 4 个数值），直接用文字回答，不要画图。',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '图表标题（同时用作下载文件名），要能独立看懂，例如「各城市客户数（2026 年 9 月）」' },
        option: {
          type: 'object',
          description: [
            '图表数据配置。',
            '柱状/折线：{"xAxis":{"type":"category","data":["北京","上海"],"name":"城市"},"yAxis":{"type":"value","name":"客户数"},"series":[{"type":"bar","name":"客户数","data":[12,8]}]}',
            '饼图：{"series":[{"type":"pie","name":"占比","data":[{"name":"已成交","value":12},{"name":"待跟进","value":8}]}]}',
            '多系列对比：series 数组放多个对象，每个带 name。',
            '只需要提供 data / name / type 这些数据字段。',
          ].join('\n'),
          additionalProperties: true,
        },
      },
      required: ['title', 'option'],
    },
  },
}

// 抓取网页工具：联网获取内容并做摘要/对比
export const FETCH_URL_TOOL = {
  type: 'function' as const,
  function: {
    name: 'fetch_url',
    description:
      '抓取指定网页的正文内容（纯文本提取、前约 16000 字），用于联网查询资料、文章摘要、对比信息。仅支持 http(s) 公网地址，不接受内网 IP。',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '要抓取的目标网址，必须以 http:// 或 https:// 开头' },
      },
      required: ['url'],
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
        parentId: { type: 'string', description: '仅 create 时可选：父管理库 ID（不传则创建为顶级库）' },
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
  FETCH_URL_TOOL,
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
  parentId?: string
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
    parentId: typeof a.parentId === 'string' ? a.parentId : undefined,
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
