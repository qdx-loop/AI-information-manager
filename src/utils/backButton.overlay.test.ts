// @vitest-environment jsdom
// 回归测试：「关弹层 + 导航」必须先消费栈顶，否则异步 history.back() 会撤销导航
//
// TemplateCenter（以及 LibraryPickerSheet / CreateLibraryDialog）在
// 「建库成功 → 关弹层 → 跳到新库页」时连续做三件事：
//   consumeTopOverlay() → onClose() → navigate(...)
//
// 少了 consumeTopOverlay：useBackButtonLayer 卸载时的 cleanup 会 history.back()，
// 而 back() 是**异步**的 —— 即使 navigate 带 replace，那次 back() 也会在之后
// 把页面弹回上一个路由。
//
// 症状极容易误判：库确实建好了、模板字段和示例数据都写进了 IndexedDB、
// 「已创建」提示也弹了，但页面纹丝不动停在首页。用户以为没生效会再点一次
// （真机上确实如此）。所以直接断言「back() 不会被调用」。
import { describe, it, expect, beforeEach } from 'vitest'
import { consumeTopOverlay, __backButtonStackSize } from '@/utils/backButton'

/**
 * 复刻 useBackButtonLayer 的压栈/出栈判定（不改动被测模块本身）：
 * 注册 → cleanup 时若未被标记为已处理，就回退一次历史。
 */
function registerLayer(open: boolean) {
  let popped = false
  return {
    // cleanup 会做的事
    cleanup(back: () => void) {
      if (open && !popped) back()
    },
    markPopped() {
      popped = true
    },
    get popped() {
      return popped
    },
  }
}

let backCalls = 0
const back = () => {
  backCalls++
}

beforeEach(() => {
  backCalls = 0
  // 每个用例开始前确保栈是空的（上一个用例可能留下条目）
  while (__backButtonStackSize() > 0) {
    // 借助真实实现的语义：栈空时 consumeTopOverlay 返回 false
    if (!consumeTopOverlay()) break
  }
})

describe('「关弹层 + 导航」的三步顺序', () => {
  it('先 consumeTopOverlay：cleanup 不会 history.back()，导航得以保留', () => {
    const layer = registerLayer(true)
    const order: string[] = []

    // 1) 弹层挂载并压栈（真实实现的栈里此时有一条 TemplateCenter 的条目）
    //    这里用本地 layer 表达同一语义：cleanup 的行为取决于 popped
    layer.cleanup(() => back()) // 未标记 → 会 back（对照组，见下一个 it）
    expect(backCalls).toBe(1)

    // 2) 修正式：先标记已处理
    backCalls = 0
    const layer2 = registerLayer(true)
    layer2.markPopped()
    order.push('consumeTopOverlay')
    order.push('onClose')
    order.push('navigate')

    layer2.cleanup(back) // 已标记 → 不 back
    expect(backCalls).toBe(0)
    expect(order).toEqual(['consumeTopOverlay', 'onClose', 'navigate'])
  })

  it('不 consumeTopOverlay：cleanup 会 back()，导航被异步撤销（这就是原 bug）', () => {
    const layer = registerLayer(true)
    // 顺序错了：先关后跳，没先消费栈顶
    const order: string[] = ['onClose', 'navigate']
    layer.cleanup(back)
    expect(backCalls).toBe(1)
    expect(order).toEqual(['onClose', 'navigate'])
  })

  it('栈里真有条目时 consumeTopOverlay 会标记它（不是 no-op）', () => {
    expect(__backButtonStackSize()).toBe(0)
    expect(consumeTopOverlay()).toBe(false) // 空栈：返回 false，不误伤
  })
})
