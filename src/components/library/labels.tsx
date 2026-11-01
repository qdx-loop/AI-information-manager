import { useAppStore } from '@/store/appStore'

/**
 * 表单字段标签（v9 Win11）：14/20 正文色 + 必填小圆点。
 *
 * Win11 原生对话框从不使用大写英文小标签，也不使用彩色方块；
 * 这里只保留「标签 + 必填指示」这一层语义，视觉全部交给控件本身。
 */
export function LabelText({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className="lib-label">
      <span className="lib-label-text">{label}</span>
      {required ? <span className="lib-label-req" aria-hidden /> : null}
    </span>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   页面内新增文案。
   规范：优先复用 i18n key；确实没有的短文案写在这里，按 settings.language
   做 zh/en 分支 —— 不改 src/i18n/**（共享文件，由 Lead 统一维护）。
   ══════════════════════════════════════════════════════════════════════════ */
const LOCAL = {
  /* 命令栏 / 地址条 / 筛选行 */
  'nav.back': { zh: '后退', en: 'Back' },
  'nav.up': { zh: '上一级', en: 'Up one level' },
  'nav.refresh': { zh: '刷新', en: 'Refresh' },
  'view.details': { zh: '详细信息', en: 'Details' },
  'filter.all': { zh: '全部字段', en: 'All fields' },
  'sort.none': { zh: '默认顺序', en: 'Default order' },
  'search.clear': { zh: '清除搜索', en: 'Clear search' },
  'search.hint': { zh: '搜索条目（Ctrl+F）', en: 'Search items (Ctrl+F)' },
  'cmd.fields': { zh: '字段', en: 'Fields' },
  'cmd.more': { zh: '更多', en: 'More' },

  /* 状态栏 / 选择 */
  'status.total': { zh: '共 {n} 项', en: '{n} items' },
  'status.selected': { zh: '已选 {n} 项', en: '{n} selected' },
  'status.page': { zh: '第 {p} 页，共 {total} 页', en: 'Page {p} of {total}' },
  'status.perPage': { zh: '每页 {n} 项', en: '{n} per page' },
  'pager.prev': { zh: '上一页', en: 'Previous page' },
  'pager.next': { zh: '下一页', en: 'Next page' },
  'sel.all': { zh: '全选', en: 'Select all' },
  'sel.clear': { zh: '清除选择', en: 'Clear selection' },
  'sel.pin': { zh: '置顶', en: 'Pin' },
  'sel.unpin': { zh: '取消置顶', en: 'Unpin' },
  'sel.delete': { zh: '删除', en: 'Delete' },
  'sel.deleteTitle': { zh: '删除选中的 {n} 条记录？', en: 'Delete the {n} selected records?' },
  'sel.deleteBody': {
    zh: '删除后可以在回收站里恢复。',
    en: 'They can be restored from the Recycle Bin afterwards.',
  },
  'sel.deleted': { zh: '已删除 {n} 条', en: 'Deleted {n} items' },
  'sel.deletedFailed': { zh: '批量删除失败：{msg}', en: 'Bulk delete failed: {msg}' },
  'sel.pinned': { zh: '已置顶 {n} 条', en: 'Pinned {n} items' },
  'sel.unpinned': { zh: '已取消置顶 {n} 条', en: 'Unpinned {n} items' },
  'sel.pinFailed': { zh: '批量置顶失败：{msg}', en: 'Bulk pin failed: {msg}' },

  /* 表格 */
  'table.col.pin': { zh: '置顶', en: 'Pin' },
  'table.actions': { zh: '操作', en: 'Actions' },
  'table.focus': { zh: '定位到条目', en: 'Item located' },

  /* 条目编辑器 */
  'editor.details': { zh: '条目详情', en: 'Item details' },
  'editor.reminder': { zh: '提醒', en: 'Reminder' },
  'editor.reminderDesc': {
    zh: '到期当天会发系统通知；重复提醒会在每个周期再次提醒。',
    en: 'A system notification fires on the due date; repeating reminders fire again each cycle.',
  },
  'editor.deleteItem': { zh: '删除条目', en: 'Delete item' },

  /* 字段模板编辑器 */
  'tpl.dragHint': { zh: '拖动左侧手柄调整字段顺序', en: 'Drag the handle to reorder fields' },
  'tpl.name': { zh: '字段名', en: 'Field name' },
  'tpl.type': { zh: '类型', en: 'Type' },
  'tpl.options': { zh: '选项', en: 'Options' },
  'tpl.cols': { zh: '必填 / 显示', en: 'Required / Visible' },
  'tpl.emptyHint': { zh: '还没有字段。先添加要记录的列，然后保存在库页里就能录入。', en: 'No fields yet. Add the columns you want to record, save, then start entering items.' },

  /* 模板中心 */
  'center.choose': { zh: '选择模板', en: 'Choose a template' },
  'center.preview': { zh: '模板预览', en: 'Template preview' },
  'center.fieldsCount': { zh: '{n} 个字段', en: '{n} fields' },
  'center.category': { zh: '分类', en: 'Category' },
  'center.blank': { zh: '空白模板', en: 'Blank template' },
  'center.blankDesc': { zh: '从一个空库开始，字段稍后自己配置。', en: 'Start from an empty library and add fields later.' },
  'center.create': { zh: '用此模板新建', en: 'Create with this template' },
  'center.newName': { zh: '管理库名称', en: 'Library name' },

  /* 导入 / 导出 */
  'import.step': { zh: '第 {n} 步，共 3 步', en: 'Step {n} of 3' },
  'import.choose': { zh: '选择文件', en: 'Choose file' },
  'import.map': { zh: '字段映射', en: 'Field mapping' },
  'import.done': { zh: '导入完成', en: 'Import complete' },
  'import.supported': { zh: '支持 .csv / .xlsx / .xls，单个文件最大 10 MB', en: 'Supports .csv / .xlsx / .xls, up to 10 MB per file' },
  'import.preview': { zh: '预览', en: 'Preview' },
  'import.parseRows': { zh: '已解析 {n} 行', en: '{n} rows parsed' },
  'import.skipCol': { zh: '不导入此列', en: 'Skip this column' },

  /* 回收站 */
  'trash.search': { zh: '搜索回收站', en: 'Search Recycle Bin' },
  'trash.remaining': { zh: '剩余 {n} 天', en: '{n} days left' },
  'trash.restore': { zh: '还原', en: 'Restore' },
  'trash.purge': { zh: '永久删除', en: 'Delete permanently' },
  'trash.opened': { zh: '回收站', en: 'Recycle Bin' },

  /* 库选择（移动端） */
  'picker.new': { zh: '新建管理库', en: 'New library' },
  'picker.current': { zh: '当前库', en: 'Current' },

  /* 通用补充 */
  'lib.fields': { zh: '字段', en: 'Fields' },
  'lib.itemsUnit': { zh: '条', en: 'items' },
  'lib.none': { zh: '无', en: 'None' },
  'lib.optional': { zh: '可选', en: 'Optional' },
} as const

export type LibTextKey = keyof typeof LOCAL

type Vars = Record<string, string | number>

function interpolate(s: string, vars?: Vars): string {
  if (!vars) return s
  let out = s
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v))
  return out
}

/**
 * 库页本地文案：`const lt = useLibText(); lt('status.total', { n: 12 })`
 *
 * 语言跟随 settings.language（zh/en），与 i18n 的 t() 同一来源，
 * 但不写入共享 i18n 字典 —— 库页独有的少量 Win11 界面词只属于这一页。
 */
export function useLibText(): (key: LibTextKey, vars?: Vars) => string {
  const lang = useAppStore((s) => s.settings.language)
  const dict = lang === 'en' ? 'en' : 'zh'
  return (key: LibTextKey, vars?: Vars) => interpolate(LOCAL[key][dict], vars)
}

/** 非 Hook 版本（只在已知语言时用，组件内请优先 useLibText） */
export function libText(lang: 'zh' | 'en' | undefined, key: LibTextKey, vars?: Vars): string {
  return interpolate(LOCAL[key][lang === 'en' ? 'en' : 'zh'], vars)
}

