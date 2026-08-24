// AI 对话附件处理：Excel/CSV 解析为文本表格，图片转为 base64
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { newId } from '@/utils/id'

export interface Attachment {
  id: string
  kind: 'image' | 'table'
  name: string
  /** 图片的 base64 dataURL（kind=image 时有效） */
  dataUrl?: string
  /** 表格的文本摘要，注入到消息中（kind=table 时有效） */
  summary?: string
}

const IMAGE_MAX_BYTES = 4 * 1024 * 1024 // 4MB，超过提示压缩后上传
const TABLE_MAX_ROWS = 200
const TABLE_MAX_COLS = 40
const CELL_MAX_LEN = 120

function truncateCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim()
  return s.length > CELL_MAX_LEN ? s.slice(0, CELL_MAX_LEN) + '…' : s
}

// 把二维数组渲染成 | 分隔的紧凑表格文本
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
    lines.push(`…(共 ${totalRows} 行，仅提供前 ${TABLE_MAX_ROWS} 行；其余数据请让用户分批提供或自行说明)`)
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
    // 最多取前 3 个工作表，防止超大文件撑爆上下文
    const sheets = wb.SheetNames.slice(0, 3)
    const parts: string[] = []
    const metas: string[] = []
    for (const sheetName of sheets) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
        header: 1,
        defval: '',
      })
      const t = rowsToTable(rows, sheetName)
      parts.push(t.text)
      metas.push(`${sheetName}(${t.rowCount}行×${t.colCount}列)`)
    }
    if (wb.SheetNames.length > 3) {
      parts.push(`…(另有 ${wb.SheetNames.length - 3} 个工作表未展示)`)
    }
    blocks = parts
    meta = metas.join(', ')
  }

  return `[附件 Excel/CSV 表格：${file.name}，${meta}]\n${blocks.join('\n\n')}`
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

/** 解析用户上传的文件为 AI 可用的附件；不支持的类型抛错 */
export async function processAttachment(file: File): Promise<Attachment> {
  const lower = file.name.toLowerCase()

  if (file.type.startsWith('image/')) {
    if (file.size > IMAGE_MAX_BYTES) {
      throw new Error(`图片「${file.name}」超过 4MB，请压缩后再上传`)
    }
    return { id: newId(), kind: 'image', name: file.name, dataUrl: await readAsDataUrl(file) }
  }

  if (lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return { id: newId(), kind: 'table', name: file.name, summary: await parseSpreadsheet(file) }
  }

  throw new Error(`暂不支持「${file.name}」：目前支持图片(jpg/png/webp)、Excel(xlsx/xls) 和 CSV 文件`)
}
