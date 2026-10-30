/**
 * 朱砂印章（品牌标记）。
 *
 * 『官纸账簿』里没有「品牌色块」，只有一个印：18px 实心朱砂方印 + 内嵌 1px 纸色细边。
 * 公开页、登录页、后台登录共用同一枚印，避免每处各画一个方块导致细节不一致。
 * 尺寸用 px 传参（12/14/18），颜色一律走 token。
 */
export default function SealMark({ size = 18 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        background: 'var(--app-accent)',
        display: 'inline-block',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 2,
          border: '1px solid var(--app-canvas)',
          opacity: 0.55,
        }}
      />
    </span>
  )
}
