import { describe, it, expect } from 'vitest'
import {
  autoConfirmKey,
  canAutoConfirm,
  isDestructiveAction,
} from '@/ai/autoConfirm'

// 回归测试：autoConfirm 的粒度与破坏性动作禁区。
//
// 背景（03-ai.md 风险 P0-1）：旧实现只有 item/lib/tpl 三个粗粒度开关，
// 用户为「新增一条」勾一次「本轮不再询问」，后续的**删除条目 / 删除管理库 /
// 删除字段**也一并被放行。这里把新语义钉死：
//   1. 放行键必须细化到「动作」，不能互相串；
//   2. 破坏性动作永远返回 false，即使被人为塞进放行集合；
//   3. 未登记的动作一律要求确认。
describe('autoConfirm 粒度', () => {
  it('放行 item:create 不影响 update/delete', () => {
    const allow = new Set(['item:create'])
    expect(canAutoConfirm(allow, 'item', 'create')).toBe(true)
    expect(canAutoConfirm(allow, 'item', 'update')).toBe(false)
    expect(canAutoConfirm(allow, 'item', 'delete')).toBe(false)
  })

  it('删除类即使写进放行集合也不生效', () => {
    const allow = new Set(['item:delete', 'lib:delete', 'tpl:deleteField'])
    expect(canAutoConfirm(allow, 'item', 'delete')).toBe(false)
    expect(canAutoConfirm(allow, 'lib', 'delete')).toBe(false)
    expect(canAutoConfirm(allow, 'tpl', 'deleteField')).toBe(false)
  })

  it('库/模板动作按动作分键', () => {
    const allow = new Set(['lib:create', 'tpl:addField'])
    expect(canAutoConfirm(allow, 'lib', 'create')).toBe(true)
    expect(canAutoConfirm(allow, 'lib', 'rename')).toBe(false)
    expect(canAutoConfirm(allow, 'lib', 'setCategory')).toBe(false)
    expect(canAutoConfirm(allow, 'tpl', 'addField')).toBe(true)
    expect(canAutoConfirm(allow, 'tpl', 'updateField')).toBe(false)
  })

  it('未登记动作必须确认', () => {
    expect(autoConfirmKey('item', 'archive')).toBeNull()
    expect(canAutoConfirm(new Set(['item:archive']), 'item', 'archive')).toBe(false)
  })

  it('破坏性动作判定与放行键一致', () => {
    expect(isDestructiveAction('item', 'delete')).toBe(true)
    expect(isDestructiveAction('lib', 'delete')).toBe(true)
    expect(isDestructiveAction('tpl', 'deleteField')).toBe(true)
    expect(isDestructiveAction('item', 'create')).toBe(false)
    expect(isDestructiveAction('lib', 'rename')).toBe(false)
  })
})
