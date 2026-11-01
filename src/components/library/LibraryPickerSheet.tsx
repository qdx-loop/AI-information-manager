import { useEffect, useMemo, useState } from 'react'
import { Button, Drawer } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { useLibraryStore } from '@/store/libraryStore'
import type { Library } from '@/types'
import { useI18n } from '@/i18n'
import { consumeTopOverlay, useBackButtonLayer } from '@/utils/backButton'
import CreateLibraryDialog from './CreateLibraryDialog'

/**
 * 「管理库」标签的点开目标 —— 手机上的库切换面板。
 *
 * 之前这个标签是死按钮：
 *   if (!location.pathname.startsWith('/library/')) navigate('/')
 * 在首页时 pathname 不是 /library/，于是导航到当前页，等于什么都没发生；
 * 而冷启动下唯一能进库页的入口在汉堡抽屉里，所以这个标签从冷启动**永远亮不起来**。
 * 更矛盾的是作者的本意是「已经在库里就别跳走」，但这同时意味着它**永远无法切库** ——
 * 而切库恰恰是它在手机上唯一的职责（侧边栏收进了抽屉）。
 *
 * 现在点开是这个底部抽屉：完整库树 + 当前库高亮 + 就地新建。
 * 「主目的地一个都不许藏」是当初引入底栏的理由，切库就不该再藏回抽屉里。
 *
 * 视觉（v4）：一行一个库（44px 索引行），当前库 = lime-wash 底 + 3px ink 左条；
 * 分组用 mono kicker，不放图标（库列表不需要图标）。
 */
export default function LibraryPickerSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const t = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const { libraries, currentLibraryId } = useLibraryStore()
  const [creating, setCreating] = useState(false)
  // 选中的库。等弹层完全关闭之后再跳，并先消费掉栈顶，
  // 否则 useBackButtonLayer cleanup 里那次异步 history.back() 会把导航撤销掉。
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
    consumeTopOverlay()          // 关这一层，但别回退历史
    setPending(id)
    onClose()
  }

  return (
    <>
      {/* 自己铺一层可点的遮罩，而不是用 Drawer 自带的 mask。
          Drawer 的 mask z-index 1000 > 底栏 880，会把底栏盖住 —— 那等于底栏又失效了，
          而底栏存在的理由就是「主目的地一个都不许藏」。面板本身压到 870，
          让底栏（880）始终可点。 */}
      {open && (
        <div
          onClick={onClose}
          aria-hidden
          style={{ position: 'fixed', inset: 0, zIndex: 869, background: 'var(--overlay)' }}
        />
      )}
      <Drawer
        placement="bottom"
        open={open}
        onClose={onClose}
        mask={false}
        zIndex={870}
        height="72vh"
        title={t('app.group.libraries')}
        styles={{ body: { padding: 12 }, wrapper: { zIndex: 870 } }}
      >
        {libraries.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 12px' }}>
            <div className="empty-mark" aria-hidden>+</div>
            <h3 className="empty-title">{t('home.empty')}</h3>
            <div className="empty-actions">
              <Button type="primary" onClick={() => setCreating(true)}>
                {t('home.createFirst')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {groups.map(([cat, rows]) => (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div className="panel-kicker" style={{ padding: '4px 4px 8px' }}>{cat}</div>
                <div className="panel" style={{ overflow: 'hidden' }}>
                {rows.map(({ lib, depth }) => {
                  const on = currentLibraryId === lib.id || location.pathname === `/library/${lib.id}`
                  return (
                    <button
                      key={lib.id}
                      type="button"
                      onClick={() => go(lib.id)}
                      aria-current={on ? 'page' : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        minHeight: 44,
                        padding: `8px 12px 8px ${12 + depth * 16}px`,
                        margin: 0,
                        // v4 索引行：1px line-soft 行线，选中 = lime-wash 底 + 左侧 3px ink 条
                        border: 0,
                        borderBottom: '1px solid var(--line-soft)',
                        borderLeft: on ? '3px solid var(--line)' : '3px solid transparent',
                        borderRadius: 0,
                        background: on ? 'var(--lime-wash)' : 'transparent',
                        font: 'inherit',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: 'inherit',
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          fontSize: 'var(--t-sm)',
                          fontWeight: on ? 700 : 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {lib.name}
                      </span>
                    </button>
                  )
                })}
                </div>
              </div>
            ))}
            <Button type="primary" block onClick={() => setCreating(true)} style={{ marginTop: 4 }}>
              {t('app.newLibrary')}
            </Button>
          </>
        )}
      </Drawer>
      <CreateLibraryDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => { setCreating(false); onClose() }}
      />
    </>
  )
}
