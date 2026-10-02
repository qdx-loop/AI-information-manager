import { describe, it, expect } from 'vitest'
import { validateBackupBlob } from './backup'

function goodBlob(over: Record<string, unknown> = {}) {
  return {
    version: 1,
    exportedAt: 1,
    accountId: 'a1',
    libraries: [{ id: 'l1', accountId: 'a1', name: '客户管理', category: '', sortOrder: 0, deletedAt: null, parentId: null }],
    fields: [{ id: 'f1', libraryId: 'l1', key: 'name', label: '客户名称', type: 'text', required: true, visible: true, sortOrder: 0, options: [] }],
    items: [{ id: 'i1', libraryId: 'l1', accountId: 'a1', fields: { name: '北京华盛' }, pinned: false, sortOrder: 0, createdAt: 1, updatedAt: 1, deletedAt: null }],
    ...over,
  }
}

/**
 * importAll 的语义是「先清空账户，再写 blob」，所以校验不过 = 静默清空。
 * 这些用例锁住的是「坏文件绝不能走到 provider」。
 */
describe('validateBackupBlob', () => {
  it('接受结构完整的备份', () => {
    expect(() => validateBackupBlob(goodBlob())).not.toThrow()
  })

  it('拒绝非对象（用户随便选了一个 json 数组）', () => {
    expect(() => validateBackupBlob([1, 2, 3])).toThrow(/顶层不是对象/)
    expect(() => validateBackupBlob(null)).toThrow(/顶层不是对象/)
    expect(() => validateBackupBlob('{"a":1}')).toThrow(/顶层不是对象/)
  })

  it('拒绝缺字段', () => {
    expect(() => validateBackupBlob({ version: 1 })).toThrow(/缺少 libraries 数组/)
    expect(() => validateBackupBlob(goodBlob({ items: undefined }))).toThrow(/缺少 items 数组/)
    expect(() => validateBackupBlob(goodBlob({ libraries: {} }))).toThrow(/缺少 libraries 数组/)
  })

  it('拒绝缺 version', () => {
    const b = goodBlob()
    delete (b as Record<string, unknown>).version
    expect(() => validateBackupBlob(b)).toThrow(/缺少 version/)
  })

  it('拒绝空库备份 —— 这正是会静默删光数据的那个 case', () => {
    // 三个数组都在、都是合法对象数组，只是库是空的：
    // provider 会删掉全部数据、不写回任何东西，而且不抛错。
    expect(() =>
      validateBackupBlob(goodBlob({ libraries: [], fields: [], items: [] })),
    ).toThrow(/一个管理库都没有/)
  })

  it('拒绝数组里有 null / 非对象元素', () => {
    expect(() => validateBackupBlob(goodBlob({ items: [null] }))).toThrow(/不是对象的条目/)
    expect(() => validateBackupBlob(goodBlob({ libraries: ['x'] }))).toThrow(/不是对象的条目/)
  })

  it('拒绝缺 id 的条目（写进去也无法被查询命中）', () => {
    expect(() => validateBackupBlob(goodBlob({ items: [{ libraryId: 'l1' }] }))).toThrow(/缺少 id/)
    expect(() => validateBackupBlob(goodBlob({ items: [{ id: '', libraryId: 'l1' }] }))).toThrow(/缺少 id/)
  })

  it('报错文案承诺「当前数据未改动」，与调用顺序一致', () => {
    // importBackup 是先 validate 再交给 provider，所以文案不能是空头承诺
    expect(() => validateBackupBlob(null)).toThrow(/当前数据未改动/)
  })
})
