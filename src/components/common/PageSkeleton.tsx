import { Skeleton, Button, Space } from 'antd'
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
      <Skeleton active avatar={avatar} title={title} paragraph={{ rows }} />
    </div>
  )
}

/** 局部小块的加载态（例如卡片内容区），保留圆环指示器但不再遮挡交互 */
export function InlineSkeleton({ rows = 3, tip }: { rows?: number; tip?: ReactNode }) {
  return (
    <div style={{ padding: 8 }} aria-busy="true">
      <Skeleton active title={false} paragraph={{ rows }} />
      {tip ? (
        <div style={{ textAlign: 'center', color: 'var(--app-ink-soft)', fontSize: 12, marginTop: 8 }}>
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
    <div
      style={{
        textAlign: 'center',
        padding: compact ? '28px 16px' : '56px 24px',
        color: 'var(--app-ink-soft)',
      }}
    >
      {icon ? <div style={{ marginBottom: 12, opacity: 0.9 }}>{icon}</div> : null}
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--app-ink)', marginBottom: 6 }}>
        {title}
      </div>
      {body ? (
        <div style={{ maxWidth: 440, margin: '0 auto', lineHeight: 1.75, fontSize: 13 }}>{body}</div>
      ) : null}
      {action ? <div style={{ marginTop: 20 }}>{action}</div> : null}
    </div>
  )
}

/** 确认按钮的默认组合：取消在左、危险操作在右且文案说清后果 */
export function ConfirmActions({
  cancelText,
  okText,
  danger,
  okButtonProps,
  onCancel,
  onOk,
  loading,
}: {
  cancelText: ReactNode
  okText: ReactNode
  danger?: boolean
  okButtonProps?: Record<string, unknown>
  onCancel: () => void
  onOk: () => void
  loading?: boolean
}) {
  return (
    <Space>
      <Button onClick={onCancel}>{cancelText}</Button>
      <Button
        type="primary"
        danger={danger}
        loading={loading}
        onClick={onOk}
        {...(okButtonProps as object)}
      >
        {okText}
      </Button>
    </Space>
  )
}
