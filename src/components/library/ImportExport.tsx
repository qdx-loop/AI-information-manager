import { Fragment, useImperativeHandle, useRef, useState, forwardRef } from 'react'
import { Button, Dropdown, Option, Text, Tooltip } from '@fluentui/react-components'
import { App } from 'antd'
import { ArrowImportRegular, ArrowLeftRegular, CheckmarkCircleRegular, MailInboxRegular } from '@fluentui/react-icons'
import type { FieldDef, Item, FieldValue } from '@/types'
import { itemsToCSV, parseCSV, downloadCSV } from '@/utils/csv'
import { itemsToExcel, parseExcel } from '@/utils/excel'
import { downloadBlob } from '@/utils/csv'
import { useI18n } from '@/i18n'
import { useBackButtonLayer } from '@/utils/backButton'
import { LibDialog, useLibText } from './labels'

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

/** 三步步骤指示（Fluent）：功能性步骤序号 + 连接线。 */
function StepBar({ current }: { current: 1 | 2 | 3 }) {
  const t = useI18n()
  const steps = [t('lib.importExport.chooseFile'), t('lib.importExport.mapTitle'), t('lib.importExport.import')]
  return (
    <div className="lib-steps">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3
        const isCurrent = n === current
        return (
          <Fragment key={label}>
            {i > 0 ? <span className="lib-step-line" aria-hidden /> : null}
            <span className={`lib-step${isCurrent ? ' is-current' : ''}`} aria-current={isCurrent ? 'step' : undefined}>
              <Text size={200} weight={isCurrent ? 'semibold' : 'regular'}>
                {n}. {label}
              </Text>
            </span>
          </Fragment>
        )
      })}
    </div>
  )
}

/**
 * 导入 / 导出（v10 Fluent Dialog）。
 *
 * 导入三步：1 选择文件（拖放区）→ 2 字段映射（左映射列表 + 右预览表）→ 3 完成。
 * 映射/类型转换/逐行写入逻辑与原来完全一致（coerceValue 没有改动）。
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
  const lt = useLibText()
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
    return false // 阻止浏览器默认行为
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

  const footer =
    step === 2 ? (
      <div className="lib-dialog-footer">
        <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={() => setStep(1)}>
          {t('common.back')}
        </Button>
        <span className="lib-dialog-footer-spacer" />
        <Button appearance="secondary" onClick={closeModal}>
          {t('common.cancel')}
        </Button>
        <Button appearance="primary" disabled={!importable || importing} onClick={confirmImport}>
          {importing ? t('common.loading') : t('lib.importExport.confirmN', { n: parsedRows.length })}
        </Button>
      </div>
    ) : step === 3 ? (
      <div className="lib-dialog-footer">
        <span className="lib-dialog-footer-spacer" />
        <Button appearance="primary" onClick={closeModal}>
          {t('common.close')}
        </Button>
      </div>
    ) : (
      <div className="lib-dialog-footer">
        <span className="lib-dialog-footer-spacer" />
        <Button appearance="secondary" onClick={closeModal}>
          {t('common.cancel')}
        </Button>
      </div>
    )

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

      <LibDialog
        open={modalOpen}
        onClose={closeModal}
        title={t('lib.importExport.import')}
        width={step === 2 ? 'min(920px, calc(100vw - 32px))' : 'min(560px, calc(100vw - 32px))'}
        actions={footer}
      >
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
            className={`lib-dropzone${dragging ? ' is-drag' : ''}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="lib-dropzone-icon" aria-hidden>
              <MailInboxRegular fontSize={22} />
            </span>
            <Text weight="semibold">{t('lib.importExport.dropHint')}</Text>
            <Text size={200} style={{ color: 'var(--w-text-3)' }}>
              {lt('import.supported')}
            </Text>
            <Button
              appearance="primary"
              icon={<ArrowImportRegular />}
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
            >
              {t('lib.importExport.chooseFile')}
            </Button>
          </div>
        )}

        {step === 2 && (
          <>
            <Text size={200} className="lib-dialog-sub">
              {t('lib.importExport.mapIntro', { n: parsedRows.length })}
            </Text>
            <div className="lib-import-cols">
              {/* 左：文件列 → 库字段 的对应列表 */}
              <div className="lib-map-panel">
                <div className="lib-map-head">
                  <Text size={200} weight="semibold">
                    {t('lib.importExport.mapTitle')}
                  </Text>
                  <Text size={200}>{headers.length}</Text>
                </div>
                <div className="lib-map-scroll">
                  {headers.map((h) => {
                    const mappedKey = mapping[h] ?? ''
                    const mappedLabel =
                      fields.find((x) => x.key === mappedKey)?.label ?? lt('import.skipCol')
                    return (
                      <div key={h} className="lib-map-row">
                        <span className="lib-map-src" title={h}>
                          {h}
                        </span>
                        <div className="lib-map-select">
                          <Dropdown
                            size="small"
                            value={mappedLabel}
                            selectedOptions={mappedKey ? [mappedKey] : []}
                            placeholder={lt('import.skipCol')}
                            aria-label={`${h} → ${t('lib.importExport.mapTitle')}`}
                            onOptionSelect={(_, data) =>
                              setMapping({ ...mapping, [h]: data.optionValue ?? '' })
                            }
                          >
                            <Option value="" text={lt('import.skipCol')}>
                              {lt('import.skipCol')}
                            </Option>
                            {fields.map((f) => (
                              <Option key={f.key} value={f.key} text={f.label}>
                                {f.label}
                              </Option>
                            ))}
                          </Dropdown>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 右：预览（中性表头 + 30 行高 + 数字右对齐） */}
              <div className="lib-map-panel">
                <div className="lib-map-head">
                  <Text size={200} weight="semibold">
                    {lt('import.preview')}
                  </Text>
                  <Text size={200}>{lt('import.parseRows', { n: parsedRows.length })}</Text>
                </div>
                {previewCols.length === 0 ? (
                  <Text size={200} className="lib-dialog-sub" style={{ padding: '16px 12px', margin: 0 }}>
                    {t('lib.importExport.skip')}
                  </Text>
                ) : (
                  <div className="lib-preview-scroll">
                    <table className="lib-preview-table">
                      <thead>
                        <tr>
                          {previewCols.map((c) => (
                            <th key={c.header} className={c.numeric ? 'is-num' : undefined}>
                              {c.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.slice(0, 20).map((r, ri) => (
                          <tr key={ri}>
                            {previewCols.map((c) => (
                              <td key={c.header} className={c.numeric ? 'is-num' : undefined}>
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
          </>
        )}

        {step === 3 && (
          <div className="lib-import-done">
            <span className="lib-import-done-icon" aria-hidden>
              <Tooltip content={t('lib.importExport.imported', { n: importedCount })} relationship="description">
                <CheckmarkCircleRegular fontSize={40} />
              </Tooltip>
            </span>
            <Text size={400} weight="semibold">
              {t('lib.importExport.imported', { n: importedCount })}
            </Text>
          </div>
        )}
      </LibDialog>
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
 *    得到 1970-01-01，整列日期静默变成 1970 年。
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
