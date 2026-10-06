// 回归测试：恢复快照时，正在恢复的那张不能被自己的兜底快照挤掉
//
// restoreSnapshot 的流程：
//   1. 读入目标快照数据
//   2. createSnapshot('pre-restore')  ← 拍兜底快照
//   3. importBackup(目标数据)
//
// createSnapshot 内部会 pruneSnapshots 保留最近 MAX_SNAPSHOTS(=10) 张。
// 如果账号正好有 10 张，而目标恰好是最旧的那张，prune 就会把**目标自己**删掉。
//
// 原来的注释写「先读入目标数据，避免随后的兜底快照触发清理时把目标快照行删掉」，
// 但 pruneSnapshots 是按 id 删行的 —— 数据读没读过根本不影响它。
// 结果：恢复本身成功（数据在内存里），但目标快照行消失了，
// 用户在快照列表里再也点不回「撤销这次恢复」。
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './dexie'
import {
  createSnapshot,
  restoreSnapshot,
  listSnapshots,
  deleteSnapshot,
  MAX_SNAPSHOTS,
} from './snapshotService'
import type { BackupBlob } from '@/types'

const ACC = 'acc-snap'

function blob(name: string): BackupBlob {
  return {
    version: 1,
    libraries: [{ id: 'L1', accountId: ACC, name, category: '', sortOrder: 0, parentId: null, deletedAt: null } as never],
    fields: [],
    items: [],
  } as never
}

async function putSnapshot(name: string, createdAt: number) {
  const id = `snap-${name}`
  await db.snapshots.put({
    id, accountId: ACC, createdAt, trigger: 'manual' as never, data: blob(name),
  })
  return id
}

beforeEach(async () => {
  await db.snapshots.clear()
  await db.libraries.clear()
})

describe('恢复快照不会把自己删掉', () => {
  it('目标是最旧的一张 + 快照已满：恢复后目标仍在列表里', async () => {
    // 造满 MAX_SNAPSHOTS 张，最旧的是 snap-0
    for (let i = 0; i < MAX_SNAPSHOTS; i++) await putSnapshot(String(i), 1000 + i * 10)
    expect((await listSnapshots(ACC)).length).toBe(MAX_SNAPSHOTS)

    const oldestId = await putSnapshot('0', 500) // 明确最旧
    const before = await listSnapshots(ACC)
    expect(before[before.length - 1].id).toBe(oldestId) // 列表是倒序，最旧在末尾

    await restoreSnapshot(ACC, oldestId)

    const after = await listSnapshots(ACC)
    expect(after.map((s) => s.id)).toContain(oldestId)
  })

  it('prune 仍然会清理超限的旧快照（keepIds 不能把上限架空）', async () => {
    for (let i = 0; i < MAX_SNAPSHOTS + 3; i++) await putSnapshot(String(i), 1000 + i * 10)
    const target = await putSnapshot('target', 999999) // 最新，不该被保

    // 普通快照：应裁剪到上限
    await createSnapshot(ACC, 'manual')
    const all = await listSnapshots(ACC)
    expect(all.length).toBeLessThanOrEqual(MAX_SNAPSHOTS + 1)
    expect(all.map((s) => s.id)).toContain(target)
  })

  it('keepIds 只保指定的那些，不会让总数无限增长', async () => {
    for (let i = 0; i < MAX_SNAPSHOTS + 2; i++) await putSnapshot(String(i), 1000 + i * 10)
    const keep = [await putSnapshot('k', 5000)]
    await createSnapshot(ACC, 'manual', keep)
    const ids = (await listSnapshots(ACC)).map((s) => s.id)
    expect(ids).toContain('snap-k')
    // 上限 + keep 的数量，仍是有界的
    expect(ids.length).toBeLessThanOrEqual(MAX_SNAPSHOTS + 1)
  })

  it('恢复不存在的快照会抛错', async () => {
    await expect(restoreSnapshot(ACC, 'nope')).rejects.toThrow(/快照不存在/)
  })

  it('删除快照只影响本账号', async () => {
    await db.snapshots.put({ id: 'other', accountId: 'someone-else', createdAt: 1, trigger: 'manual' as never, data: blob('x') })
    const mine = await putSnapshot('mine', 2)
    await deleteSnapshot(ACC, 'other')
    expect(await db.snapshots.get('other')).toBeDefined()
    await deleteSnapshot(ACC, mine)
    expect(await db.snapshots.get(mine)).toBeUndefined()
  })
})