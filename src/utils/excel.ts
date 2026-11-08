import * as XLSX from 'xlsx'
import type { FieldDef, Item } from '@/types'

export function itemsToExcel(items: Item[], fields: FieldDef[]): Blob {
  const visibleFields = fields.filter((f) => f.visible)
  const header = visibleFields.map((f) => f.label)
  const rows = items.map((it) =>
    visibleFields.map((f) => formatValue(it.fields[f.key])),
  )
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '数据')
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([buf], { type: 'application/octet-stream' })
}

export function parseExcel(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        // cellDates: true —— 日期单元格必须读成 JS Date。
        // 不加这一句时 xlsx 返回的是 **Excel 序列号**（如 45900 表示某年某日），
        // 后面 coerceValue 的 `new Date(45900)` 会得到 1970-01-01，
        // 于是导入的日期列**整列变成 1970-01-01**，而且导入显示成功、无任何警告。
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        // raw: true —— 保留单元格的原始类型：
        //   数字是 number（不变成 "4,800.00"/"52%"）、布尔是 boolean（不变成 "TRUE"）、
        //   日期由 cellDates 转成 Date（不变成 "10/28/26" 这种依赖区域格式的字符串）。
        // 之前用 raw:false 会把所有值格式化成显示字符串：复选框 "TRUE" 被 coerceValue
        // 当成 false、百分比 52% 被当成 52、日期格式不统一，属于会静默损坏数据的 bug。
        // defval: '' 仍让空格子统一成空字符串，方便映射界面处理。
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: true })
        resolve(json)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

function formatValue(v: unknown): unknown {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? '是' : '否'
  return v
}
