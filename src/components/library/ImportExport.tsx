import { Button, Modal, Select, App } from 'antd'
import { Fragment, useImperativeHandle, useRef, useState, forwardRef } from 'react'
import { InboxOutlined } from '@ant-design/icons'
import type { FieldDef, Item, FieldValue } from '@/types'
import { itemsToCSV, parseCSV, downloadCSV } from '@/utils/csv'
import { itemsToExcel, parseExcel } from '@/utils/excel'
import { downloadBlob } from '@/utils/csv'
import { useI18n } from '@/i18n'

import { useBackButtonLayer } from '@/utils/backButton'

/** 窄屏时工具栏把这些动作收进「更多」菜单，需要父组件能命令式触发。
 *  导出直接给两种格式，而不是命令式打开一个二级菜单——嵌套菜单在手机上很难点准。 */
export interface ImportExportHandle {
  openImport: () => void
  exportAs: (kind: 'csv' | 'excel') => void
}

interface Props {
  fields: FieldDef[]
  items: Item[]
  onImport: (rows: Record<string, FieldValue>[]) => Promise<void>
}

/**
 * 三步步骤条（v4）：三个 40×40 方形编号块 + 2px ink 连线。
 * 当前步 = lime 底 ink 边；已完成 = ink 底 on-ink 字；未开始 = panel 底。
 */
function StepBar({ current }: { current: 1 | 2 | 3 }) {
  const t = useI18n()
  const steps = [
    { n: '01', label: t('lib.importExport.chooseFile') },
    { n: '02', label: t('lib.importExport.mapTitle') },
    { n: '03', label: t('lib.importExport.import') },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
      {steps.map((s, i) => {
        const state = i + 1 < current ? 'done' : i + 1 === current ? 'now' : 'todo'
        return (
          <Fragment key={s.n}>
            {i > 0 ? <div style={{ flex: '1 1 0%', height: 2, background: 'var(--border-strong)' }} /> : null}
            <div
              aria-current={state === 'now' ? 'step' : undefined}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexShrink: 0 }}
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--t-xs)',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  background: state === 'now' ? 'var(--accent)' : state === 'done' ? 'var(--text)' : 'var(--surface-2)',
                  color: state === 'now' ? 'var(--on-accent)' : state === 'done' ? 'var(--on-dark)' : 'var(--text-secondary)',
                  border: 'var(--border-width) solid var(--border-strong)',
                  boxShadow: state === 'todo' ? 'none' : 'var(--shadow-1)',
                }}
              >
                {s.n}
              </span>
              <span
                className="panel-kicker"
                style={{ color: state === 'now' ? 'var(--text)' : 'var(--text-muted)' }}
              >
                {s.label}
              </span>
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

/**
 * 导入 / 导出（v4 SIGNAL PRESS）。
 *
 * 导入三步：01 选择文件（panel + 2px dashed ink 拖拽区）→ 02 字段映射（左映射表 + 右预览）
 * → 03 完成（大 lime 方块 + 导入条数）。映射/类型转换/逐行写入逻辑与原来完全一致
 * （coerceValue 没有改动）。导出仍是 csv/excel 两个选项。
 */
const ImportExport = forwardRef<ImportExportHandle, Props>(function ImportExport(
  { fields, items, onImport },
  ref,
) {
  // 不复用 antd <Upload> 的 ref：antd 5.29 的 imperative handle 只暴露
  // upload/nativeElement 等，没有 click / openFileDialog，命令式打开文件框会抛
  // "click is not a function"。这里自持一个隐藏 input，桌面按钮和「更多」菜单共用。
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { message } = App.useApp()
  const t = useI18n()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [importing, setImporting] = useState(false)
  const [dragging, setDragging] = useState(false)

  const handleExport = (kind: 'csv' | 'excel') => {
    if (items.length === 0) {
      message.warning(t('lib.importExport.nothing'))
      return
    }
    if (kind === 'csv') {
      const csv = itemsToCSV(items, fields)
      downloadCSV(`导出_${Date.now()}.csv`, csv)
    } else {
      const blob = itemsToExcel(items, fields)
      downloadBlob(`导出_${Date.now()}.xlsx`, blob)
    }
    message.success(t('lib.importExport.exported'))
  }

  const openModal = () => {
    setStep(1)
    setParsedRows([])
    setHeaders([])
    setMapping({})
    setImportedCount(0)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setParsedRows([])
    setHeaders([])
    setMapping({})
    setStep(1)
  }

  useImperativeHandle(ref, () => ({
    openImport: openModal,
    exportAs: (kind) => handleExport(kind),
  }))

  const handleFile = async (file: File) => {
    // 限制文件大小为 10MB，防止超大文件卡死浏览器
    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      message.error(t('lib.importExport.tooLarge'))
      return false
    }
    try {
      const isCsv = file.name.toLowerCase().endsWith('.csv')
      const rows = isCsv ? await parseCSV(file) : await parseExcel(file)
      if (rows.length === 0) {
        message.warning(t('lib.importExport.emptyFile'))
        return false
      }
      const hs = Object.keys(rows[0])
      setHeaders(hs)
      // 自动匹配：列名 === 字段 label 或 key
      const auto: Record<string, string> = {}
      hs.forEach((h) => {
        const matched = fields.find((f) => f.label === h || f.key === h)
        auto[h] = matched ? matched.key : ''
      })
      setMapping(auto)
      setParsedRows(rows)
      setStep(2)
    } catch (e) {
      message.error(t('lib.importExport.parseFailed', { msg: (e as Error).message }))
    }
    return false // 阻止 antd 自动上传
  }

  const buildRows = (): Record<string, FieldValue>[] =>
    parsedRows.map((r) => {
      const obj: Record<string, FieldValue> = {}
      Object.entries(mapping).forEach(([header, fieldKey]) => {
        if (!fieldKey) return
        // 用全部字段而非 visibleFields：文件里可能含有当前被隐藏的列，
        // 静默丢掉整列是用户不会察觉的数据损失。
        const f = fields.find((x) => x.key === fieldKey)
        if (!f) return
        const raw = r[header]
        obj[fieldKey] = coerceValue(f.type, raw)
      })
      return obj
    })

  const confirmImport = async () => {
    if (importing) return
    setImporting(true)
    try {
      // 逐行写入与进度提示由父组件负责（LibraryView.handleImport）
      await onImport(buildRows())
      setImportedCount(parsedRows.length)
      setStep(3)
    } catch {
      // 父组件已经把「已导入 n/total + 原因」报出来了，这里停在映射步让用户重试
    } finally {
      setImporting(false)
    }
  }

  useBackButtonLayer(modalOpen, closeModal)

  // 右侧预览的列：只显示已映射到字段的那些列
  const previewCols = headers
    .filter((h) => mapping[h])
    .map((h) => {
      const f = fields.find((x) => x.key === mapping[h])
      return {
        header: h,
        label: f?.label ?? h,
        numeric: f?.type === 'number' || f?.type === 'rating',
      }
    })

  const importable = parsedRows.length > 0
  const monoHead: React.CSSProperties = {
    background: 'var(--text)',
    color: 'var(--on-dark)',
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '10px 12px',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          // 选完同一个文件要能再次触发 change
          e.target.value = ''
          if (f) void handleFile(f)
        }}
      />

      <Modal
        title={t('lib.importExport.import')}
        open={modalOpen}
        onCancel={closeModal}
        footer={null}
        width={step === 2 ? 880 : 540}
        style={{ maxWidth: 'calc(100vw - 24px)' }}
        destroyOnHidden
      >
        <div className="page-kicker" style={{ marginBottom: 12 }}>{t('lib.importExport.kicker')}</div>
        <StepBar current={step} />

        {step === 1 && (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const f = e.dataTransfer.files?.[0]
              if (f) void handleFile(f)
            }}
            className="panel"
            style={{
              border: '2px dashed var(--border-strong)',
              background: dragging ? 'var(--accent-soft)' : 'var(--surface-2)',
              padding: '44px 20px',
              textAlign: 'center',
              boxShadow: 'none',
              cursor: 'pointer',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <InboxOutlined style={{ fontSize: 40, color: 'var(--text-muted)' }} aria-hidden />
            <div className="page-sub" style={{ fontSize: 'var(--t-sm)', margin: '12px 0 16px' }}>
              {t('lib.importExport.dropHint')}
            </div>
            <Button type="primary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
              {t('lib.importExport.chooseFile')}
            </Button>
            <div className="field-hint" style={{ marginTop: 16 }}>
              {t('lib.importExport.tooLarge')}
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* 左：文件列 → 库字段 的对应表（行 40 + 1px line-soft） */}
            <div className="panel" style={{ flex: '1 1 360px', minWidth: 0 }}>
              <div className="panel-head">
                <span className="panel-kicker">{t('lib.importExport.mapTitle')}</span>
                <span className="table-count">{t('lib.importExport.mapIntro', { n: parsedRows.length })}</span>
              </div>
              <div className="panel-body" style={{ padding: 0 }}>
                {headers.map((h) => (
                  <div
                    key={h}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      minHeight: 40,
                      padding: '6px 12px',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <span
                      style={{ flex: '1 1 0%', minWidth: 0, fontSize: 'var(--t-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={h}
                    >
                      {h}
                    </span>
                    <Select
                      size="small"
                      style={{ width: 184, flexShrink: 0 }}
                      value={mapping[h]}
                      onChange={(v) => setMapping({ ...mapping, [h]: v })}
                      options={[
                        { label: t('lib.importExport.skip'), value: '' },
                        ...fields.map((f) => ({ label: f.label, value: f.key })),
                      ]}
                      allowClear
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 右：预览账表（ink 表头 + 40 行 + 数字右对齐） */}
            <div style={{ flex: '1 1 340px', minWidth: 0 }}>
              <div className="panel-kicker" style={{ marginBottom: 8 }}>{t('lib.importExport.preview')}</div>
              {previewCols.length === 0 ? (
                <p className="field-hint">{t('lib.importExport.skip')}</p>
              ) : (
                <div className="data-table">
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        {previewCols.map((c) => (
                          <th
                            key={c.header}
                            style={{ ...monoHead, textAlign: c.numeric ? 'right' : 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 4).map((r, ri) => (
                        <tr key={ri}>
                          {previewCols.map((c) => (
                            <td
                              key={c.header}
                              style={{
                                padding: '9px 12px',
                                fontSize: 'var(--t-sm)',
                                color: 'var(--text)',
                                textAlign: c.numeric ? 'right' : 'left',
                                fontFamily: c.numeric ? 'var(--font-mono)' : undefined,
                                fontVariantNumeric: c.numeric ? 'tabular-nums' : undefined,
                                borderBottom: '1px solid var(--border)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {r[c.header] == null ? '' : String(r[c.header])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="empty-state" style={{ padding: '24px 0 8px' }}>
            <div
              className="empty-mark"
              style={{ width: 72, height: 72, fontSize: 'var(--t-xl)', fontVariantNumeric: 'tabular-nums' }}
              aria-hidden
            >
              {importedCount}
            </div>
            <h3 className="empty-title">{t('lib.importExport.imported', { n: importedCount })}</h3>
          </div>
        )}

        {/* 底部操作：上一步是文字项；导入/完成是 lime 主按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
          {step === 2 ? (
            <Button type="text" onClick={() => setStep(1)}>
              {t('common.back')}
            </Button>
          ) : null}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {step === 3 ? (
              <Button type="primary" onClick={closeModal}>{t('common.close')}</Button>
            ) : (
              <>
                <Button onClick={closeModal}>{t('common.cancel')}</Button>
                {step === 2 ? (
                  <Button type="primary" loading={importing} disabled={!importable} onClick={confirmImport}>
                    {t('lib.importExport.confirmN', { n: parsedRows.length })}
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
})

/** 导出仅为测试：导入是数据进入应用的唯一入口，静默损坏不可逆 */
export const coerceValueForTest = coerceValue

function coerceValue(type: FieldDef['type'], raw: unknown): FieldValue {
  if (raw === null || raw === undefined || raw === '') return null
  switch (type) {
    case 'number':
    case 'rating': {
      // 原来直接 Number(raw)。用户表格里写着「约5000」「1,200」「1200元」时
      // 结果是 NaN，而 NaN 会被写进 IndexedDB（显示为空白），
      // 经云同步 JSONB 序列化后变成 null —— 数值信息彻底丢失且不可恢复。
      const n = typeof raw === 'number' ? raw : parseLooseNumber(raw)
      return Number.isFinite(n) ? n : null
    }
    case 'checkbox':
      return raw === true || raw === '是' || raw === 'true' || raw === 1 || raw === '1'
    case 'date':
      return coerceDate(raw)
    default:
      return String(raw)
  }
}

/**
 * 容忍千分位、空格、货币符号和中文数量单位；无法解析时返回 NaN。
 *
 * 用户自己的表格里出现「约5000」「1,200」「1200元」「1.2万」是很常见的，
 * 原来的 `Number(raw)` 对这些一律返回 NaN。
 */
function parseLooseNumber(raw: unknown): number {
  if (typeof raw === 'number') return raw
  let s = String(raw).trim()
  // 全角数字 / 全角逗号 / 各种空白（含全角空格）
  s = s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  s = s.replace(/，/g, ',').replace(/[\s\u3000]/g, '')
  // 千分位逗号：只在合法分组（1,200 / 1,234,567）时去掉
  s = s.replace(/\d{1,3}(?:,\d{3})+(?:\.\d+)?/g, (m) => m.replace(/,/g, ''))
  // 还剩逗号说明不是合法分组（例如「1,2」），判为无法解析而不是截成 1
  if (s.includes(',')) return Number.NaN
  // 货币与百分号
  s = s.replace(/[¥￥$€£%]/g, '')
  // 中文数量单位：作为倍率；其余（元/个/件/次/人民币/约/起…）直接丢掉
  let mult = 1
  if (/亿/.test(s)) mult = 1e8
  else if (/万/.test(s)) mult = 1e4
  else if (/千/.test(s)) mult = 1e3
  s = s.replace(/[亿万千]/g, '')
  // 只留首个数字（含小数点和负号），丢掉「起」「左右」这类尾巴
  const m = s.match(/^[^0-9.+-]*(-?[0-9]+(?:\.[0-9]+)?)/)
  if (!m) return Number.NaN
  const n = Number(m[1])
  return Number.isFinite(n) ? n * mult : Number.NaN
}

/**
 * 把各种形态的日期输入规整成 'YYYY-MM-DD'。
 *
 * 两个必须处理的坑：
 * 1. xlsx 不加 cellDates 时给的是 **Excel 序列号**（45900）。`new Date(45900)`
 *    得到 1970-01-01，整列日期静默变成 1970 年。现在 excel.ts 已开启
 *    cellDates，但用户也可能粘贴纯数字，所以这里仍要兜住序列号。
 * 2. 用本地时区格式化。原来用 toISOString()（UTC），东八区 00:00 的日期
 *    会被写成前一天 —— 用户填 2026-10-05 存成 2026-10-04。
 */
function coerceDate(raw: unknown): FieldValue {
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null
    return localISODate(raw)
  }
  if (typeof raw === 'number') {
    // Excel 序列号：1900 历法，且 Excel 误把 1900 当闰年（1900-02-29 不存在）
    if (raw > 0 && raw < 2958466) return localISODate(excelSerialToDate(raw))
    return null
  }
  const s = String(raw).trim()
  if (!s) return null
  // '2026-10-05' / '2026/10/5' / '2026.10.5' / '2026年10月5日'
  const m = s.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/)
  if (m) {
    const [, y, mo, d] = m
    const dt = new Date(Number(y), Number(mo) - 1, Number(d))
    if (Number.isNaN(dt.getTime())) return null
    return localISODate(dt)
  }
  // 其它可解析的写法（如 2026-10-05T00:00:00Z）
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : localISODate(d)
}

function excelSerialToDate(serial: number): Date {
  // Excel 序列号 1 = 1900-01-01；Excel 虚构了 1900-02-29，所以 60 之后要减一天
  const days = serial >= 60 ? serial - 1 : serial
  return new Date(Date.UTC(1899, 11, 30) + days * 86400000)
}

/** 按本地时区取 YYYY-MM-DD（不能用 toISOString，那是 UTC，会把东八区的午夜变成前一天） */
function localISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default ImportExport
