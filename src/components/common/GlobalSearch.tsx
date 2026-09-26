import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Input, List, Typography, Tag, App } from 'antd'
import type { InputRef } from 'antd'
import { SearchOutlined, AppstoreOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useLibraryStore } from '@/store/libraryStore'
import { getProvider } from '@/db/providerFactory'
import { useI18n } from '@/i18n'
import type { Item } from '@/types'

const { Text } = Typography

interface Hit {
  item: Item
  libraryId: string
  libraryName: string
  matched: string // 命中的片段预览
}

/**
 * 全局搜索（Ctrl/Cmd + K）：跨所有管理库按关键词搜条目。
 * 打开时一次性拉取所有库条目（本地 IndexedDB，量大也可接受；命中后跳转目标库并高亮）。
 */
export default function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp()
  const t = useI18n()
  const navigate = useNavigate()
  const libraries = useLibraryStore((s) => s.libraries)
  const focusItem = useLibraryStore((s) => s.focusItem)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<InputRef>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setHits([])
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open])

  const doSearch = useCallback(
    async (keyword: string) => {
      const kw = keyword.trim().toLowerCase()
      if (!kw) return setHits([])
      setLoading(true)
      try {
        const out: Hit[] = []
        for (const lib of libraries) {
          let items: Item[] = []
          try {
            items = await getProvider().listItems(lib.id)
          } catch {
            continue
          }
          for (const it of items) {
            const hitField = Object.entries(it.fields).find(([, v]) =>
              v != null && String(v).toLowerCase().includes(kw),
            )
            if (hitField) {
              out.push({ item: it, libraryId: lib.id, libraryName: lib.name, matched: String(hitField[1]).slice(0, 40) })
            }
            if (out.length >= 50) break // 命中上限，防止极端卡顿
          }
          if (out.length >= 50) break
        }
        setHits(out)
      } catch (e) {
        message.error((e as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [libraries, message],
  )

  // 输入防抖 250ms
  useEffect(() => {
    const timer = setTimeout(() => { void doSearch(q) }, 250)
    return () => clearTimeout(timer)
  }, [q, doSearch])

  const go = (h: Hit) => {
    focusItem(h.item.id)
    navigate(`/library/${h.libraryId}`)
    onClose()
  }

  const list = useMemo(() => hits.slice(0, 30), [hits])

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      title={<Text><SearchOutlined style={{ marginRight: 8, color: '#0D9488' }} />{t('gsearch.title')}</Text>}
      styles={{ body: { paddingTop: 8 } }}
    >
      <Input
        ref={inputRef}
        size="large"
        placeholder={t('gsearch.placeholder')}
        prefix={<SearchOutlined style={{ color: '#999' }} />}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        allowClear
      />
      <div style={{ marginTop: 12, maxHeight: 360, overflow: 'auto' }}>
        {q.trim() === '' ? (
          <Text type="secondary" style={{ fontSize: 12 }}>{t('gsearch.hint')}</Text>
        ) : loading ? (
          <Text type="secondary">{t('common.loading')}</Text>
        ) : list.length === 0 ? (
          <Text type="secondary">{t('gsearch.empty')}</Text>
        ) : (
          <List
            size="small"
            dataSource={list}
            renderItem={(h) => (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => go(h)}
              >
                <List.Item.Meta
                  avatar={<AppstoreOutlined style={{ fontSize: 18, color: '#0D9488', marginTop: 4 }} />}
                  title={<Text>{h.item.fields[Object.keys(h.item.fields)[0]] ?? '—'}</Text>}
                  description={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <Tag color="teal" style={{ marginRight: 6 }}>{h.libraryName}</Tag>
                      {h.matched}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </Modal>
  )
}
