// 回归测试：备份校验必须挡住会让界面崩掉的形状
//
// validateBackupBlob 的存在理由是「importAll 会先删光当前账户再写 blob」，
// 所以形状不对时必须在动手删除之前就拒绝。
//
// 但原来只校验了「每条有 string id」，不看 items[].fields 的形状：
//   {libraries:[…], fields:[], items:[{id:'x', fields:null}]}
// 能通过校验 → importAll 写入成功、界面提示「导入成功」→
// 用户一打开库，LibraryView 的 Object.values(it.fields) 抛
// TypeError → 整个 ErrorBoundary 白屏。数据被清空了，界面也打不开。
//
// 对端负载（面对面互传）原来同样只查了两个数组是不是数组，
// 现在走同一套校验。
import { describe, it, expect } from 'vitest'
import { validateBackupBlob } from '@/db/backup'

const okBlob = () => ({
  version: 1,
  libraries: [{ id: 'L1', name: '客户', category: '', sortOrder: 0, parentId: null, deletedAt: null }],
  fields: [{ id: 'f1', libraryId: 'L1', key: 'name', label: '名称', type: 'text', options: [], sortOrder: 0 }],
  items: [{ id: 'i1', libraryId: 'L1', fields: { name: '张三' }, pinned: false, sortOrder: 0, deletedAt: null }],
})

const expectRejected = (blob: unknown, why: string) => {
  expect(() => validateBackupBlob(blob)).toThrow(why)
}

describe('备份形状校验', () => {
  it('合法备份通过', () => {
    expect(() => validateBackupBlob(okBlob())).not.toThrow()
  })

  it('items[].fields 为 null 时拒绝（原来会放行然后渲染崩）', () => {
    const b = okBlob() as any
    b.items[0].fields = null
    expectRejected(b, 'fields 不是对象')
  })

  it('items[].fields 为字符串时拒绝', () => {
    const b = okBlob() as any
    b.items[0].fields = '张三'
    expectRejected(b, 'fields 不是对象')
  })

  it('items[].fields 为数组时拒绝（数组不是字段映射）', () => {
    const b = okBlob() as any
    b.items[0].fields = ['张三']
    expectRejected(b, 'fields 不是对象')
  })

  it('fields[].options 不是数组时拒绝（FieldRenderer 会 .map 它）', () => {
    const b = okBlob() as any
    b.fields[0].options = 'a,b,c'
    expectRejected(b, 'options 不是数组')
  })

  it('字段缺失 options 时允许（undefined 不算错）', () => {
    const b = okBlob() as any
    delete b.fields[0].options
    expect(() => validateBackupBlob(b)).not.toThrow()
  })

  // 以下是原有行为，防止这次加检查时把之前的防线弄丢了
  it('保留原有防线：顶层非对象 / 缺数组 / 空库 / 缺 id / 缺 version', () => {
    expectRejected(null, '顶层不是对象')
    expectRejected([], '顶层不是对象')
    expectRejected({ version: 1 }, '缺少 libraries 数组')
    expectRejected({ ...okBlob(), version: 'x' }, '缺少 version')
    expectRejected({ ...okBlob(), libraries: [] }, '一个管理库都没有')
    expectRejected({ ...okBlob(), items: [{ fields: {} }] }, '缺少 id')
  })
})