/**
 * 表单字段标签（v4）：mono 11 大写小标签（`.field-label`），必填用 6px lime 方块。
 *
 * 不使用红色星号：结构信息由 ink 边 + lime 方块承担（SIGNAL PRESS 语言）。
 */
export function LabelText({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className="field-label">
      {required ? (
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            background: 'var(--accent)',
            border: '1px solid var(--border-strong)',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
      ) : null}
      {label}
    </span>
  )
}
