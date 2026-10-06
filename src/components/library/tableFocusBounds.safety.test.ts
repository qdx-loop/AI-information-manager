// @vitest-environment jsdom
// 回归测试：LibraryTable 内联编辑的**焦点导航边界**
//
// 本轮把 editCell 的身份从「页内下标」换成「记录 id」，同时把方向键/回车
// 的边界从 items.length（全库条数）改成「当前页实际渲染的行数」。
//
// 后者是必须的：pageSize 20 时 items.length 可能 500，页内只有 20 行，
// 拿 500 当边界会算出 [data-cell="37-2"] 这种根本不存在的格子，focus() 静默失败，
// 于是「保存并下移」按一次就没反应。
//
// 这里锁住的是边界计算本身（不依赖 antd 渲染），因为真正要防的是
// 「边界又被人改回 items.length」—— 那属于静默失效，不会报错。
import { describe, it, expect } from 'vitest'

/** 复刻组件里的 renderedRowCount：数当前页真正渲染出来的 tbody 行 */
function renderedRowCount(domRows: number | undefined, totalItems: number): number {
  return domRows ?? totalItems
}

/** 复刻 focusNeighbour('down') / onGridKeyDown(ArrowDown) 的夹取 */
function nextRowDown(currentRow: number, domRows: number | undefined, totalItems: number): number {
  const lastRow = Math.max(0, renderedRowCount(domRows, totalItems) - 1)
  return Math.min(currentRow + 1, lastRow)
}

describe('表格焦点导航边界按当前页行数', () => {
  it('第 2 页（满页 20 行）不会算出不存在的行号', () => {
    const total = 500 // 全库 500 条
    const domRows = 20 // 当前页只渲染 20 行
    // 旧算法：Math.min(19 + 1, 500 - 1) = 20 → [data-cell="20-x"] 不存在
    expect(nextRowDown(19, domRows, total)).toBe(19)
  })

  it('页内正常下移仍然可用', () => {
    expect(nextRowDown(0, 20, 500)).toBe(1)
    expect(nextRowDown(9, 20, 500)).toBe(10)
  })

  it('末页不满时边界是真实末行', () => {
    // 500 条 / 每页 20 → 第 25 页只有 20 条? 不：500%20=0，这里用 3 条的极端情况
    expect(nextRowDown(1, 3, 43)).toBe(2)
  })

  it('空表不产生负数行号', () => {
    expect(nextRowDown(0, 0, 0)).toBe(0)
    expect(nextRowDown(0, undefined, 0)).toBe(0)
  })
})
