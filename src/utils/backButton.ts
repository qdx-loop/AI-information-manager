import { useEffect, useRef } from 'react'

/**
 * 安卓实体返回键此前什么都不做。
 *
 * 问题：应用是 PWA，装到桌面后系统返回键走的是浏览器的「后退」，
 * 而返回键只会触发路由跳转 —— 屏幕上还开着命令面板 / AI 抽屉 /
 * 条目编辑器 / 任意 Modal 时，按返回的结果是**整个页面被换掉**，
 * 而不是「关掉眼前这层」。用户被迫先保存或放弃编辑。
 *
 * 解法：把返回键重新定义成「关闭最上面那层」。
 * 弹层打开时压一个同 URL 的历史条目，返回键就有东西可退了；
 * 退到那个条目时我们把栈顶弹层关掉，并补回一个条目，
 * 这样「关掉弹层」之后不会立刻把用户踢出应用。
 *
 * 全局只装一个 popstate 监听，栈是模块级的：
 * 每个弹层调 useBackButtonLayer(open, close) 登记自己的关闭方式。
 * 这样不需要给 14 个 antd Modal/Drawer 逐个改，也就不会漏。
 *
 * ⚠ 同一层只能注册一次，否则会多压一个历史条目，用户就得按两次返回键
 * 才能离开页面。踩过的坑：LibraryView 为 editorOpen 注册了一次，
 * 它内部的 ItemEditor 又用自己的 open prop 注册了一次 —— open 是同一个
 * 状态，两处都注册就等于一层压两条。规则是：**状态在哪一层，谁注册**。
 * 自持状态（组件自己管 open）的组件注册；受控组件（open 由父级传入）
 * 由父级注册，父级没注册才轮到自己。
 */

interface Entry {
  id: number
  close: () => void
  /** 这个条目是否已经被一次返回键消费掉了 */
  popped: boolean
}

const stack: Entry[] = []
let seq = 0
let installed = false
/**
 * 我们主动 history.back() 时会引发一次 popstate，
 * 那次 popstate 不是用户按返回键，必须忽略，否则会连带关掉别的弹层。
 */
let selfInflicted = 0

function handlePop(): void {
  if (selfInflicted > 0) {
    selfInflicted--
    return
  }
  const top = stack[stack.length - 1]
  if (!top) return // 没有弹层压栈：这次返回交给路由/浏览器正常处理
  top.popped = true
  stack.pop()
  top.close()
  // 这次返回已经被「关掉弹层」用掉了。补一个同位置条目，
  // 否则用户在关掉弹层之后再按一次返回会直接离开应用。
  window.history.pushState({ __overlay: top.id }, '')
}

function install(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('popstate', handlePop)
}

/**
 * 登记一个弹层，使安卓返回键 / 浏览器后退能关闭它。
 *
 * @param open  弹层是否展开
 * @param close 关闭它要做什么（通常就是 setOpen(false)）
 */
export function useBackButtonLayer(open: boolean, close: () => void): void {
  // close 常常是调用点上的内联箭头函数，每次渲染都是新引用。
  // 若把它放进依赖数组，effect 会每渲染一次就 cleanup（进而 history.back()）
  // 再重新压栈，栈和历史记录会被搅乱。所以只依赖 open，
  // close 走 ref 取最新值。
  const closeRef = useRef(close)
  closeRef.current = close

  useEffect(() => {
    if (!open) return
    install()

    const entry: Entry = { id: ++seq, close: () => closeRef.current(), popped: false }
    stack.push(entry)
    window.history.pushState({ __overlay: entry.id }, '')

    return () => {
      const i = stack.indexOf(entry)
      if (i !== -1) stack.splice(i, 1)
      // 弹层是自己关掉的（点了确定 / 取消 / ESC）：
      // 把它压进去的那个条目退回来，否则用户要多按一次返回才能离开。
      if (!entry.popped) {
        selfInflicted++
        window.history.back()
      }
    }
  }, [open])
}

/** 仅测试用 */
export function __backButtonStackSize(): number {
  return stack.length
}
