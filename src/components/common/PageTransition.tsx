import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useLocation } from 'react-router-dom'

/**
 * 页面转场（Motion）：单纯 fade + 4px 上移，220ms，尊重 reduced-motion。
 * 只包裹路由内容，不动布局；避免用 CSS 手写 keyframe 与路由状态不同步。
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const reduce = useReducedMotion()
  return (
    <motion.div
      key={pathname}
      className="nova-page"
      initial={reduce ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.22, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}
