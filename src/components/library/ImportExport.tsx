import { Button, Dropdown, Upload, Modal, Select, App } from 'antd'
import { ImportOutlined, ExportOutlined } from '@ant-design/icons'
import { useState } from 'react'
import type { MenuProps } from 'antd'
import type { FieldDef, Item, FieldValue } from '@/types'
import { itemsToCSV, parseCSV, downloadCSV } from '@/utils/csv'
import { itemsToExcel, parseExcel } from '@/utils/excel'
import { downloadBlob } from '@/utils/csv'
import { useI18n } from '@/i18n'

interface Props {
  fields: FieldDef[]
  items: Item[]
  onImport: (rows: Record<string, FieldValue>[]) => Promise<void>
}

export default function ImportExport({ fields, items, onImport }: Props) {
  const { message } = App.useApp()
  const t = useI18n()
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [modalOpen, setModalOpen] = useState(false)

  const visibleFields = fields.filter((f) => f.visible)

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
    message.success('已导出')
  }

  const exportMenu: MenuProps = {
    items: [
      { key: 'csv', label: t('lib.importExport.exportCsv') },
      { key: 'excel', label: t('lib.importExport.exportExcel') },
    ],
    onClick: ({ key }) => handleExport(key as 'csv' | 'excel'),
  }

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
        const matched = visibleFields.find((f) => f.label === h || f.key === h)
        auto[h] = matched ? matched.key : ''
      })
      setMapping(auto)
      setParsedRows(rows)
      setModalOpen(true)
    } catch (e) {
      message.error(t('lib.importExport.parseFailed', { msg: (e as Error).message }))
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
    message.success(t('lib.importExport.imported', { n: rows.length }))
  }

  return (
    <>
      <Upload beforeUpload={handleFile} showUploadList={false} accept=".csv,.xlsx,.xls">
        <Button icon={<ImportOutlined />}>{t('lib.importExport.import')}</Button>
      </Upload>
      <Dropdown menu={exportMenu}>
        <Button icon={<ExportOutlined />}>{t('lib.importExport.export')}</Button>
      </Dropdown>

      <Modal
        title={t('lib.importExport.mapTitle')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={confirmImport}
        width={520}
      >
        <p style={{ color: 'var(--ant-color-text-secondary)', marginBottom: 12 }}>
          {t('lib.importExport.mapIntro', { n: parsedRows.length })}
        </p>
        {headers.map((h) => (
          <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ flex: 1, fontWeight: 500 }}>{h}</span>
            <Select
              style={{ flex: 2 }}
              value={mapping[h]}
              onChange={(v) => setMapping({ ...mapping, [h]: v })}
              options={[
                { label: t('lib.importExport.skip'), value: '' },
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
