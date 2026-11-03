import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogSurface,
  DialogTitle,
  Text,
  Tooltip,
} from '@fluentui/react-components'
import { AddRegular, FolderAddRegular, FolderRegular } from '@fluentui/react-icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useLibraryStore } from '@/store/libraryStore'
import type { Library } from '@/types'
import { useI18n } from '@/i18n'
import { consumeTopOverlay, useBackButtonLayer } from '@/utils/backButton'
import CreateLibraryDialog from './CreateLibraryDialog'
import { useLibText } from './labels'

/**
 * 「管理库」标签的点开目标 —— 手机上的库切换面板（v10 Fluent Dialog · 底部面板）。
 *
 * 完整库树 + 当前库高亮 + 就地新建；选中后等面板关闭再导航（先消费返回栈顶，
 * 避免 useBackButtonLayer cleanup 里那次异步 history.back() 撤销导航）。
 */
export default function LibraryPickerSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const t = useI18n()
  const lt = useLibText()
  const navigate = useNavigate()
  const location = useLocation()
  const { libraries, currentLibraryId } = useLibraryStore()
  const [creating, setCreating] = useState(false)
  const [pending, setPending] = useState<string | null>(null)

  useBackButtonLayer(open, onClose)

  /** 按分类分组 + 父子缩进；没有分类的库归到「未分类」，不再落进无标题分组 */
  const groups = useMemo(() => {
    const sorted = [...libraries].sort((a, b) => a.sortOrder - b.sortOrder)
    const byParent = new Map<string | null, Library[]>()
    for (const l of sorted) {
      const key = l.parentId ?? null
      byParent.set(key, [...(byParent.get(key) ?? []), l])
    }
    const rows: { lib: Library; depth: number }[] = []
    const walk = (pid: string | null, depth: number) => {
      for (const l of byParent.get(pid) ?? []) {
        rows.push({ lib: l, depth })
        walk(l.id, depth + 1)
      }
    }
    walk(null, 0)
    // 父库被删过、找不到的孤儿库也要露出来，否则用户在手机上就"库不见了"
    const seen = new Set(rows.map((r) => r.lib.id))
    for (const l of sorted) if (!seen.has(l.id)) rows.push({ lib: l, depth: 0 })

    const map = new Map<string, { lib: Library; depth: number }[]>()
    for (const r of rows) {
      const key = r.lib.category?.trim() || t('libPicker.uncategorized')
      map.set(key, [...(map.get(key) ?? []), r])
    }
    return Array.from(map.entries())
  }, [libraries, t])

  useEffect(() => {
    if (open || !pending) return
    navigate(`/library/${pending}`, { replace: true })
    setPending(null)
  }, [open, pending, navigate])

  const go = (id: string) => {
    consumeTopOverlay() // 关这一层，但别回退历史
    setPending(id)
    onClose()
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(_, data) => {
          if (!data.open) onClose()
        }}
      >
        <DialogSurface className="lib-picker-surface" aria-label={lt('picker.title')}>
          <DialogBody>
            <DialogTitle>{lt('picker.title')}</DialogTitle>
            <div className="lib-picker-body">
              {libraries.length === 0 ? (
                <div className="lib-picker-empty">
                  <FolderAddRegular fontSize={28} />
                  <Text size={300}>{lt('picker.empty')}</Text>
                  <Button appearance="primary" onClick={() => setCreating(true)}>
                    {t('home.createFirst')}
                  </Button>
                </div>
              ) : (
                <>
                  {groups.map(([cat, rows]) => (
                    <div key={cat}>
                      <div className="lib-picker-group">{cat}</div>
                      {rows.map(({ lib, depth }) => {
                        const on = currentLibraryId === lib.id || location.pathname === `/library/${lib.id}`
                        return (
                          <Button
                            key={lib.id}
                            appearance="subtle"
                            className={`lib-picker-item${on ? ' is-active' : ''}`}
                            aria-current={on ? 'page' : undefined}
                            icon={<FolderRegular />}
                            onClick={() => go(lib.id)}
                          >
                            <span style={{ marginLeft: depth * 16 }}>{lib.name}</span>
                            {on ? <span className="lib-picker-current">{lt('picker.current')}</span> : null}
                          </Button>
                        )
                      })}
                    </div>
                  ))}
                  <Tooltip content={lt('picker.new')} relationship="label">
                    <Button
                      appearance="secondary"
                      className="lib-picker-add"
                      icon={<AddRegular />}
                      onClick={() => setCreating(true)}
                    >
                      {lt('picker.new')}
                    </Button>
                  </Tooltip>
                </>
              )}
            </div>
            <DialogActions>
              <Button appearance="secondary" onClick={onClose}>
                {t('common.close')}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      <CreateLibraryDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false)
          onClose()
        }}
      />
    </>
  )
}
