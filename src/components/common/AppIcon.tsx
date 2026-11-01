/**
 * v9 应用图标 · Win11 风格：蓝色圆角方块 + 白色「记录行」图形
 * 用途：窗口标题栏 / 任务栏 / 登录页 / 落地页 / 桌面图标
 * 纯 SVG，不依赖图片资源，任意尺寸清晰。
 */
export default function AppIcon({
  size = 24,
  className,
  style,
  title,
}: {
  size?: number
  className?: string
  style?: React.CSSProperties
  title?: string
}) {
  return (
    <svg
      className={className ? `w-appicon ${className}` : 'w-appicon'}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <rect x="1" y="1" width="46" height="46" rx="10" fill="#0067C0" />
      <rect x="1" y="1" width="46" height="46" rx="10" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.4" />
      <rect x="12" y="13" width="24" height="4.4" rx="2.2" fill="#FFFFFF" />
      <rect x="12" y="21.8" width="24" height="4.4" rx="2.2" fill="#FFFFFF" opacity="0.82" />
      <rect x="12" y="30.6" width="15" height="4.4" rx="2.2" fill="#FFFFFF" opacity="0.64" />
      <circle cx="35" cy="32.8" r="4.2" fill="#4CC2FF" />
    </svg>
  )
}
