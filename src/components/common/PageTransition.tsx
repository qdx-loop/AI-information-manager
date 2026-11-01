import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useLocation } from 'react-router-dom'

/**
 * 页面转场（Motion）：Windows 11 Fluent 的克制淡入 + 6px 上移，150ms，
 * 尊重 reduced-motion。只包裹路由内容，不动布局。
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const reduce = useReducedMotion()
  return (
    <motion.div
      key={pathname}
      className="w-page-transition"
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.15, ease: [0.1, 0.9, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}
