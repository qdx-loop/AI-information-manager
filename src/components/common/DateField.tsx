/**
 * 日期输入（v10 · Fluent UI v9 无 DatePicker 的替代方案）。
 *
 * Fluent UI React v9 没有日期选择器，antd 的 <DatePicker> 曾是最后一个 antd 控件。
 * 这里直接用原生 `<input type="date">`：
 *   - 移动端拿到系统日期滚轮（比自绘日历更快、更大、无障碍），桌面端拿到系统日历；
 *   - 值本身就是存储格式 `'YYYY-MM-DD'`（见 utils/reminder.ts 的跨时区约定），
 *     不需要 dayjs 往返，也就不会出现「少一天」；
 *   - 视觉复用既有原生输入类 `.w-input`（Fluent 4px 圆角 / 32px 高 / 中性描边 /
 *     聚焦底部强调线），暗色下由 `color-scheme` 让系统指示器自动反色。
 */
import { DismissRegular } from '@fluentui/react-icons'
import { useI18n } from '@/i18n'
import { toISODate } from '@/utils/reminder'

interface Props {
  /** 'YYYY-MM-DD'；null = 空 */
  value: string | null
  onChange: (value: string | null) => void
  /** 额外类名（如表格内联编辑用的 compact 尺寸） */
  className?: string
  autoFocus?: boolean
  ariaLabel?: string
  /** 显示清除按钮（原生 input 的清除能力在部分浏览器里很弱） */
  clearable?: boolean
}

export default function DateField({ value, onChange, className, autoFocus, ariaLabel, clearable }: Props) {
  const t = useI18n()
  const input = (
    <input
      type="date"
      className={`w-input w-date-input${className ? ` ${className}` : ''}${clearable && value ? ' w-date-input--clearable' : ''}`}
      value={value ?? ''}
      onChange={(e) => onChange(toISODate(e.target.value))}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
    />
  )

  if (!clearable) return input

  return (
    <span className="w-date-wrap">
      {input}
      {value ? (
        <button
          type="button"
          className="w-date-clear"
          aria-label={t('common.clear')}
          onClick={() => onChange(null)}
        >
          <DismissRegular />
        </button>
      ) : null}
    </span>
  )
}
