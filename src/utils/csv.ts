import Papa from 'papaparse'
import type { FieldDef, Item } from '@/types'

// 导出条目为 CSV 字符串
export function itemsToCSV(items: Item[], fields: FieldDef[]): string {
  const visibleFields = fields.filter((f) => f.visible)
  const header = visibleFields.map((f) => f.label)
  const rows = items.map((it) =>
    visibleFields.map((f) => formatValueForExport(it.fields[f.key])),
  )
  return Papa.unparse([header, ...rows])
}

// 解析 CSV 文件 → 行对象数组
export function parseCSV(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data),
      error: (err) => reject(err),
    })
  })
}

export function downloadCSV(filename: string, csv: string) {
  // 加 BOM 防止 Excel 中文乱码
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(filename, blob)
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function formatValueForExport(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s: string
  if (typeof v === 'boolean') s = v ? '是' : '否'
  else if (typeof v === 'object') s = JSON.stringify(v)
  else s = String(v)
  // 防 CSV 公式注入：以公式起始符开头的值前加单引号，Excel 打开不会执行（红队报告）
  if (/^[=+@\t\r]|^-[^0-9.]/.test(s)) return `'${s}`
  return s
}
