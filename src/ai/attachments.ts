import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { newId } from '@/utils/id'

export interface Attachment {
  id: string
  kind: 'image' | 'table' | 'text'
  name: string
  /** 图片的 base64 dataURL */
  dataUrl?: string
  /** 表格或文本内容的文本摘要，注入到消息中 */
  summary?: string
}

const IMAGE_MAX_BYTES = 4 * 1024 * 1024 // 4MB
const TEXT_MAX_BYTES = 2 * 1024 * 1024 // 2MB 文本截断读取
const TABLE_MAX_ROWS = 200
const TABLE_MAX_COLS = 40
const CELL_MAX_LEN = 120

const IMAGE_EXTS = /\.(png|jpe?g|webp|gif|bmp|avif)$/i
const TABLE_EXTS = /\.(csv|xlsx|xls|xlsm|xlsb|ods)$/i
// 文本类扩展白名单（UTF-8 读取）
const TEXT_EXTS = /\.(txt|md|markdown|json|jsonl|log|xml|svg|yaml|yml|ini|conf|toml|css|scss|less|js|jsx|ts|tsx|py|java|c|h|cpp|cs|go|rs|php|rb|swift|kt|sql|sh|bash|ps1|bat|env|gitignore|editorconfig|csv\.txt)$/i

function truncateCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim()
  return s.length > CELL_MAX_LEN ? s.slice(0, CELL_MAX_LEN) + '…' : s
}

function rowsToTable(rows: unknown[][], sheetLabel?: string): { text: string; rowCount: number; colCount: number } {
  if (rows.length === 0) return { text: `${sheetLabel ? `[工作表:${sheetLabel}] ` : ''}(空表)`, rowCount: 0, colCount: 0 }
  const cols = Math.min(Math.max(...rows.map((r) => r.length)), TABLE_MAX_COLS)
  const header = rows[0].length > 0 ? rows[0] : rows[1] ?? []
  const colNames = Array.from({ length: cols }, (_, i) => truncateCell(header[i]) || `列${i + 1}`)
  const bodyStart = rows[0].length > 0 ? 1 : 2
  const body = rows.slice(bodyStart, bodyStart + TABLE_MAX_ROWS)
  const lines: string[] = []
  if (sheetLabel) lines.push(`[工作表:${sheetLabel}]`)
  lines.push(`列名: ${colNames.join(' | ')}`)
  for (const r of body) {
    lines.push(Array.from({ length: cols }, (_, i) => truncateCell(r[i])).join(' | '))
  }
  const totalRows = rows.length - bodyStart
  if (totalRows > TABLE_MAX_ROWS) {
    lines.push(`…(共 ${totalRows} 行，仅提供前 ${TABLE_MAX_ROWS} 行)`)
  }
  return { text: lines.join('\n'), rowCount: totalRows, colCount: cols }
}

async function parseSpreadsheet(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  let blocks: string[] = []
  let meta = ''
  if (name.endsWith('.csv')) {
    const text = await file.text()
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true })
    const t = rowsToTable(parsed.data as unknown[][])
    blocks.push(t.text)
    meta = `${t.rowCount} 行 × ${t.colCount} 列`
  } else {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const sheets = wb.SheetNames.slice(0, 3)
    const parts: string[] = []
    const metas: string[] = []
    for (const sheetName of sheets) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: '' })
      const t = rowsToTable(rows, sheetName)
      parts.push(t.text)
      metas.push(`${sheetName}(${t.rowCount}行×${t.colCount}列)`)
    }
    if (wb.SheetNames.length > 3) parts.push(`…(另有 ${wb.SheetNames.length - 3} 个工作表未展示)`)
    blocks = parts
    meta = metas.join(', ')
  }
  return `[表格附件：${file.name}，${meta}]\n${blocks.join('\n\n')}`
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

/** 通用附件：图片 / 表格 / 任意文本文件。不支持的类型给出明确提示。 */
export async function processAttachment(file: File): Promise<Attachment> {
  const name = file.name.toLowerCase()

  if (file.type.startsWith('image/') || IMAGE_EXTS.test(name)) {
    if (file.size > IMAGE_MAX_BYTES) throw new Error(`图片「${file.name}」超过 4MB，请压缩后再上传`)
    return { id: newId(), kind: 'image', name: file.name, dataUrl: await readAsDataUrl(file) }
  }

  if (TABLE_EXTS.test(name)) {
    return { id: newId(), kind: 'table', name: file.name, summary: await parseSpreadsheet(file) }
  }

  // 任意文本类文件：截断读取内容注入
  if (TEXT_EXTS.test(name) || (file.type.startsWith('text/') && !file.type.includes('csv'))) {
    if (file.size > TEXT_MAX_BYTES) throw new Error(`文本文件「${file.name}」超过 2MB，请拆分后再上传`)
    const text = await file.text()
    return {
      id: newId(),
      kind: 'text',
      name: file.name,
      summary: `[文本附件：${file.name}，${text.length} 字符]\n${text}`,
    }
  }

  throw new Error(`暂不支持「${file.name}」的类型。支持：图片、表格(Excel/CSV)、文本文件(txt/md/json/log/代码等)。`)
}
