/**
 * 表单字段标签：12px muted 在上，必填用 6×6 朱砂小方点标记。
 *
 * 不用 antd 默认的红色星号：星号 + 红字是一套「后台表单」的视觉指纹；
 * 账簿里的必填标记是一枚小方点（朱砂只做标记，不做整块填充）。
 */
export function LabelText({ label, required }: { label: string; required?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 'var(--text-xs)',
        color: 'var(--app-ink-soft)',
      }}
    >
      {required ? (
        <span
          aria-hidden
          style={{ width: 6, height: 6, background: 'var(--app-accent)', display: 'inline-block', flexShrink: 0 }}
        />
      ) : null}
      {label}
    </span>
  )
}
