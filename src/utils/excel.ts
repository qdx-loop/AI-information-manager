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
        // raw: false + defval: '' —— 数字保持数字，日期按 cellDates 的 Date 透传，
        // 空格子统一成 ''（而不是 undefined），使映射界面能一致地处理。
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false })
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
