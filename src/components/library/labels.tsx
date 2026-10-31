/**
 * 表单字段标签：13px/500 muted，必填用 4px accent 圆点标记。
 *
 * v3 是现代产品感：标签是「说明文字」而不是标题，所以 500 字重、muted 色；
 * 必填标记不是红色星号（后台表单的旧符号），而是一枚 accent 小圆点。
 */
export function LabelText({ label, required }: { label: string; required?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 'var(--text-xs)',
        fontWeight: 500,
        color: 'var(--ink-muted)',
      }}
    >
      {required ? (
        <span
          aria-hidden
          style={{
            width: 4,
            height: 4,
            borderRadius: 999,
            background: 'var(--accent)',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
      ) : null}
      {label}
    </span>
  )
}
