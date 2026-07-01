import { Button, Dropdown, Upload, Modal, Select, App } from 'antd'
import { ImportOutlined, ExportOutlined } from '@ant-design/icons'
import { useState } from 'react'
import type { MenuProps } from 'antd'
import type { FieldDef, Item, FieldValue } from '@/types'
import { itemsToCSV, parseCSV, downloadCSV } from '@/utils/csv'
import { itemsToExcel, parseExcel } from '@/utils/excel'
import { downloadBlob } from '@/utils/csv'

interface Props {
  fields: FieldDef[]
  items: Item[]
  onImport: (rows: Record<string, FieldValue>[]) => Promise<void>
}

export default function ImportExport({ fields, items, onImport }: Props) {
  const { message } = App.useApp()
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [modalOpen, setModalOpen] = useState(false)

  const visibleFields = fields.filter((f) => f.visible)

  const handleExport = (kind: 'csv' | 'excel') => {
    if (items.length === 0) {
      message.warning('没有可导出的数据')
      return
    }
    if (kind === 'csv') {
      const csv = itemsToCSV(items, fields)
      downloadCSV(`导出_${Date.now()}.csv`, csv)
    } else {
      const blob = itemsToExcel(items, fields)
      downloadBlob(`导出_${Date.now()}.xlsx`, blob)
    }
    message.success('已导出')
  }

  const exportMenu: MenuProps = {
    items: [
      { key: 'csv', label: '导出 CSV' },
      { key: 'excel', label: '导出 Excel' },
    ],
    onClick: ({ key }) => handleExport(key as 'csv' | 'excel'),
  }

  const handleFile = async (file: File) => {
    try {
      const isCsv = file.name.toLowerCase().endsWith('.csv')
      const rows = isCsv ? await parseCSV(file) : await parseExcel(file)
      if (rows.length === 0) {
        message.warning('文件无数据')
        return false
      }
      const hs = Object.keys(rows[0])
      setHeaders(hs)
      // 自动匹配：列名 === 字段 label 或 key
      const auto: Record<string, string> = {}
      hs.forEach((h) => {
        const matched = visibleFields.find((f) => f.label === h || f.key === h)
        auto[h] = matched ? matched.key : ''
      })
      setMapping(auto)
      setParsedRows(rows)
      setModalOpen(true)
    } catch (e) {
      message.error('解析失败：' + (e as Error).message)
    }
    return false // 阻止 antd 自动上传
  }

  const confirmImport = async () => {
    const rows: Record<string, FieldValue>[] = parsedRows.map((r) => {
      const obj: Record<string, FieldValue> = {}
      Object.entries(mapping).forEach(([header, fieldKey]) => {
        if (!fieldKey) return
        const f = visibleFields.find((x) => x.key === fieldKey)
        if (!f) return
        const raw = r[header]
        obj[fieldKey] = coerceValue(f.type, raw)
      })
      return obj
    })
    await onImport(rows)
    setModalOpen(false)
    setParsedRows([])
    message.success(`已导入 ${rows.length} 条`)
  }

  return (
    <>
      <Upload beforeUpload={handleFile} showUploadList={false} accept=".csv,.xlsx,.xls">
        <Button icon={<ImportOutlined />}>导入</Button>
      </Upload>
      <Dropdown menu={exportMenu}>
        <Button icon={<ExportOutlined />}>导出</Button>
      </Dropdown>

      <Modal
        title="字段映射"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={confirmImport}
        width={520}
      >
        <p style={{ color: '#999', marginBottom: 12 }}>
          共解析到 {parsedRows.length} 行，请将文件列对应到管理库字段：
        </p>
        {headers.map((h) => (
          <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ flex: 1, fontWeight: 500 }}>{h}</span>
            <Select
              style={{ flex: 2 }}
              value={mapping[h]}
              onChange={(v) => setMapping({ ...mapping, [h]: v })}
              options={[
                { label: '— 不导入 —', value: '' },
                ...visibleFields.map((f) => ({ label: f.label, value: f.key })),
              ]}
              allowClear
            />
          </div>
        ))}
      </Modal>
    </>
  )
}

function coerceValue(type: FieldDef['type'], raw: unknown): FieldValue {
  if (raw === null || raw === undefined || raw === '') return null
  switch (type) {
    case 'number':
      return Number(raw)
    case 'checkbox':
      return raw === true || raw === '是' || raw === 'true' || raw === 1 || raw === '1'
    case 'rating':
      return Number(raw)
    case 'date': {
      const d = new Date(raw as string)
      return isNaN(d.getTime()) ? String(raw) : d.toISOString().slice(0, 10)
    }
    default:
      return String(raw)
  }
}
