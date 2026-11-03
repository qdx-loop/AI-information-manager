import type { ReactNode } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Text,
  Tooltip,
} from '@fluentui/react-components'
import { ChevronLeftRegular, ChevronRightRegular, DismissRegular } from '@fluentui/react-icons'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/i18n'

/**
 * 表单字段标签（Fluent）：14/20 正文色 + 必填星号。
 *
 * 新代码优先使用 Fluent `Field` / `Label`；该组件保留给少数非 Field 场景。
 */
export function LabelText({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className="lib-label">
      <span>{label}</span>
      {required ? (
        <span className="lib-label-req" aria-hidden>
          *
        </span>
      ) : null}
    </span>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   库页共享的 Fluent 对话框 / 分页小件。
   全部使用 @fluentui/react-components 的 Dialog、Button、Text —— 不自绘控件。
   ══════════════════════════════════════════════════════════════════════════ */

/** 统一的 Fluent Dialog 外壳：标题 + 可滚动内容 + 右下角动作区。 */
export function LibDialog({
  open,
  onClose,
  title,
  children,
  actions,
  width = 'min(560px, calc(100vw - 32px))',
  contentClassName = 'lib-dialog-content',
  closeLabel,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  actions?: ReactNode
  width?: number | string
  contentClassName?: string
  closeLabel?: string
}) {
  const t = useI18n()
  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) onClose()
      }}
    >
      <DialogSurface className="lib-dialog-surface" style={{ width, maxWidth: 'calc(100vw - 32px)' }}>
        <DialogBody
          className="lib-dialog-body"
          style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, overflow: 'hidden' }}
        >
          <div className="lib-dialog-head">
            <DialogTitle>{title}</DialogTitle>
            <Tooltip content={closeLabel ?? t('common.close')} relationship="label">
              <Button
                appearance="subtle"
                size="small"
                aria-label={closeLabel ?? t('common.close')}
                onClick={onClose}
                icon={<DismissRegular />}
              />
            </Tooltip>
          </div>
          <DialogContent className={contentClassName}>{children}</DialogContent>
          {actions ? <DialogActions>{actions}</DialogActions> : null}
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

/** Fluent 二次确认框（替代 antd modal.confirm）：取消在左、确认在右。 */
export function LibConfirm({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmText,
  cancelText,
  danger = false,
  confirming = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: ReactNode
  body?: ReactNode
  confirmText?: string
  cancelText?: string
  danger?: boolean
  confirming?: boolean
}) {
  const t = useI18n()
  return (
    <LibDialog
      open={open}
      onClose={onClose}
      title={title}
      width="min(460px, calc(100vw - 32px))"
      actions={
        <div className="lib-dialog-footer">
          <span className="lib-dialog-footer-spacer" />
          <Button appearance="secondary" onClick={onClose} disabled={confirming}>
            {cancelText ?? t('common.cancel')}
          </Button>
          <Button
            appearance="primary"
            onClick={onConfirm}
            disabled={confirming}
            style={
              danger
                ? {
                    backgroundColor: 'var(--colorStatusDangerBackground3)',
                    color: 'var(--colorNeutralForegroundOnBrand)',
                  }
                : undefined
            }
          >
            {confirmText ?? t('common.confirm')}
          </Button>
        </div>
      }
    >
      {body ? <div className="lib-confirm-body">{body}</div> : null}
    </LibDialog>
  )
}

/** 状态栏 / 移动端共用的 Fluent 分页（上一页 / 第 N 页 / 下一页）。 */
export function LibPager({
  page,
  pageCount,
  onChange,
  compact = false,
}: {
  page: number
  pageCount: number
  onChange: (page: number) => void
  compact?: boolean
}) {
  const lt = useLibText()
  const total = Math.max(1, pageCount)
  return (
    <span className="lib-pager">
      <Tooltip content={lt('pager.prev')} relationship="label">
        <Button
          appearance="subtle"
          size="small"
          icon={<ChevronLeftRegular />}
          aria-label={lt('pager.prev')}
          disabled={page <= 1}
          onClick={() => onChange(Math.max(1, page - 1))}
        />
      </Tooltip>
      <Text size={200} className="lib-status-page">
        {lt('status.page', { p: Math.min(page, total), total })}
      </Text>
      <Tooltip content={lt('pager.next')} relationship="label">
        <Button
          appearance="subtle"
          size="small"
          icon={<ChevronRightRegular />}
          aria-label={lt('pager.next')}
          disabled={page >= total}
          onClick={() => onChange(Math.min(total, page + 1))}
          className={compact ? 'lib-pager-compact' : undefined}
        />
      </Tooltip>
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
  'filter.fieldPlaceholder': { zh: '筛选字段', en: 'Filter field' },
  'sort.none': { zh: '默认顺序', en: 'Default order' },
  'sort.placeholder': { zh: '排序', en: 'Sort' },
  'search.clear': { zh: '清除搜索', en: 'Clear search' },
  'search.hint': { zh: '搜索条目（Ctrl+F）', en: 'Search items (Ctrl+F)' },

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
  'sel.deleteConfirm': { zh: '删除', en: 'Delete' },

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
  'editor.updatedAt': { zh: '最后修改', en: 'Last modified' },

  /* 字段设置编辑器 */
  'tpl.dragHint': { zh: '拖动左侧手柄调整字段顺序', en: 'Drag the handle to reorder fields' },
  'tpl.name': { zh: '字段名', en: 'Field name' },
  'tpl.type': { zh: '类型', en: 'Type' },
  'tpl.options': { zh: '选项', en: 'Options' },
  'tpl.optionsPlaceholder': { zh: '输入选项后回车', en: 'Type an option and press Enter' },
  'tpl.cols': { zh: '必填 / 显示', en: 'Required / Visible' },
  'tpl.removeField': { zh: '删除字段', en: 'Remove field' },
  'tpl.emptyHint': {
    zh: '还没有字段。先添加要记录的列，然后保存在库页里就能录入。',
    en: 'No fields yet. Add the columns you want to record, save, then start entering items.',
  },

  /* 模板中心 */
  'center.choose': { zh: '选择模板', en: 'Choose a template' },
  'center.preview': { zh: '模板预览', en: 'Template preview' },
  'center.fieldsCount': { zh: '{n} 个字段', en: '{n} fields' },
  'center.loading': { zh: '正在创建管理库…', en: 'Creating library…' },
  'center.create': { zh: '用此模板新建', en: 'Create with this template' },
  'center.newName': { zh: '管理库名称', en: 'Library name' },

  /* 导入 / 导出 */
  'import.step': { zh: '第 {n} 步，共 3 步', en: 'Step {n} of 3' },
  'import.choose': { zh: '选择文件', en: 'Choose file' },
  'import.map': { zh: '字段映射', en: 'Field mapping' },
  'import.done': { zh: '导入完成', en: 'Import complete' },
  'import.supported': {
    zh: '支持 .csv / .xlsx / .xls，单个文件最大 10 MB',
    en: 'Supports .csv / .xlsx / .xls, up to 10 MB per file',
  },
  'import.preview': { zh: '预览', en: 'Preview' },
  'import.parseRows': { zh: '已解析 {n} 行', en: '{n} rows parsed' },
  'import.skipCol': { zh: '不导入此列', en: 'Skip this column' },

  /* 回收站 */
  'trash.search': { zh: '搜索回收站', en: 'Search Recycle Bin' },
  'trash.remaining': { zh: '剩余 {n} 天', en: '{n} days left' },
  'trash.restore': { zh: '还原', en: 'Restore' },
  'trash.purge': { zh: '永久删除', en: 'Delete permanently' },
  'trash.purgeTitle': { zh: '永久删除这一项？', en: 'Delete this item permanently?' },
  'trash.purgeBody': {
    zh: '永久删除后无法恢复，也不会进入回收站。',
    en: 'Permanently deleted items cannot be restored.',
  },

  /* 库选择（移动端） */
  'picker.title': { zh: '管理库', en: 'Libraries' },
  'picker.new': { zh: '新建管理库', en: 'New library' },
  'picker.current': { zh: '当前库', en: 'Current' },
  'picker.empty': { zh: '还没有管理库，从创建第一个开始吧', en: 'No libraries yet — create your first one' },

  /* 通用补充 */
  'lib.fields': { zh: '字段', en: 'Fields' },
  'lib.none': { zh: '无', en: 'None' },
  'lib.optional': { zh: '可选', en: 'Optional' },
  'form.required': { zh: '此项为必填', en: 'This field is required' },
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
 * 但不写入共享 i18n 字典 —— 库页独有的少量界面词只属于这一页。
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
