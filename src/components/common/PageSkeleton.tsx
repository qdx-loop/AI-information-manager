import { Skeleton, SkeletonItem } from '@fluentui/react-components'
import type { ReactNode } from 'react'

/**
 * 页面级加载骨架。
 *
 * 之前项目里有 4 种各写各的加载态：
 *   1. `if (loading) return <div>加载中</div>`   —— 一行字，页面塌成一行再弹出来
 *   2. `<Spin />` 直接甩在内容区                —— 转圈盖住的是已经渲染好的旧内容
 *   3. `<Spin tip="..." />` 没有 children       —— tip 在 antd 里根本不显示
 *   4. Card loading + Table loading + Spin      —— 三种混用
 *
 * 问题不在于"不好看"，在于**布局会跳**：文字占 1 行 → 表格占 10 行，
 * 用户刚要点的按钮在数据到达的瞬间被顶走。骨架屏的尺寸贴近最终布局，
 * 加载完成时不会发生位移。
 */
export default function PageSkeleton({
  rows = 6,
  title = false,
  avatar = false,
}: {
  rows?: number
  title?: boolean
  avatar?: boolean
}) {
  return (
    <div aria-busy="true" aria-live="polite" data-testid="page-skeleton">
      <Skeleton>
        <div className="w-skeleton-block">
          {avatar ? <SkeletonItem shape="circle" size={40} /> : null}
          <div className="w-skeleton-lines">
            {title ? <SkeletonItem size={20} style={{ width: '38%' }} /> : null}
            {Array.from({ length: rows }).map((_, i) => (
              // 宽度递减一点，避免每行等长像「数据已到但全空」
              <SkeletonItem key={i} size={14} style={{ width: `${100 - (i % 4) * 11}%` }} />
            ))}
          </div>
        </div>
      </Skeleton>
    </div>
  )
}

/** 局部小块的加载态（例如卡片内容区），保留圆环指示器但不再遮挡交互 */
export function InlineSkeleton({ rows = 3, tip }: { rows?: number; tip?: ReactNode }) {
  return (
    <div style={{ padding: 8 }} aria-busy="true">
      <Skeleton>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonItem key={i} size={14} style={{ width: `${100 - (i % 4) * 11}%` }} />
        ))}
      </Skeleton>
      {tip ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, marginTop: 8 }}>
          {tip}
        </div>
      ) : null}
    </div>
  )
}

/**
 * 空状态。
 *
 * 之前空状态有 3 个问题：
 *   1. 有的地方是裸文字「暂无数据」，没有插图、没有下一步动作
 *   2. 有插图的用了 antd Empty，但没告诉用户「为什么空」和「现在该干嘛」
 *   3. 首次使用（一个库都没建）和筛选后为空 用同一句话，用户以为数据丢了
 */
export function EmptyState({
  title,
  body,
  action,
  icon,
  compact = false,
}: {
  title: ReactNode
  body?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  compact?: boolean
}) {
  return (
    <div className="w-empty" style={compact ? { minHeight: 160, padding: '28px 16px' } : undefined}>
      <div className="w-empty-icon" aria-hidden>{icon ?? '◇'}</div>
      <div className="w-empty-title">{title}</div>
      {body ? <div className="w-empty-desc">{body}</div> : null}
      {action ? <div className="w-empty-actions">{action}</div> : null}
    </div>
  )
}
