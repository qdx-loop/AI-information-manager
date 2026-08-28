// 数据回溯：本机快照（Snapshot）的创建 / 列表 / 恢复 / 删除。
//
// 设计要点：
// - 快照 = 当前账号全部数据的一份完整副本（BackupBlob），存在本机 IndexedDB，
//   不占服务器、不花额度；快照本身不参与云同步（它是本机兜底，不是业务数据）。
// - 快照经 provider 的 exportAll/importAll 读写，兼容本地与云端两种存储模式。
// - 高风险批量操作（面对面互传合并、备份导入）前自动拍一张；恢复前也先拍一张兜底。
// - 为避免占满浏览器存储，每个账号最多保留最近 MAX_SNAPSHOTS 张，自动清理更旧的。

import { db } from './dexie'
import { exportBackup, importBackup } from './backup'
import { newId } from '@/utils/id'
import type { SnapshotRecord, SnapshotTrigger } from '@/types'

/** 每个账号保留的快照上限 */
export const MAX_SNAPSHOTS = 10

export interface SnapshotSummary {
  id: string
  createdAt: number
  trigger: SnapshotTrigger
  libraries: number
  items: number
}

/** 拍一张当前数据快照并存入本机快照表（超限时自动清理最旧）。失败会抛错，由调用方决定是否兜底。 */
export async function createSnapshot(accountId: string, trigger: SnapshotTrigger): Promise<SnapshotRecord> {
  const data = await exportBackup(accountId)
  const rec: SnapshotRecord = {
    id: newId(),
    accountId,
    createdAt: Date.now(),
    trigger,
    data,
  }
  await db.snapshots.put(rec)
  await pruneSnapshots(accountId)
  return rec
}

/** 保留最近 MAX_SNAPSHOTS 张，删除更旧的 */
async function pruneSnapshots(accountId: string): Promise<void> {
  const all = await db.snapshots.where('accountId').equals(accountId).sortBy('createdAt')
  if (all.length > MAX_SNAPSHOTS) {
    const toDelete = all.slice(0, all.length - MAX_SNAPSHOTS).map((s) => s.id)
    await db.snapshots.bulkDelete(toDelete)
  }
}

/** 列出账号的快照（按时间倒序，最新在前），只返回轻量摘要 */
export async function listSnapshots(accountId: string): Promise<SnapshotSummary[]> {
  const all = await db.snapshots.where('accountId').equals(accountId).sortBy('createdAt')
  return all
    .slice()
    .reverse()
    .map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      trigger: s.trigger,
      libraries: s.data.libraries.length,
      items: s.data.items.length,
    }))
}

/**
 * 恢复到某张快照：先给"当前状态"拍一张恢复前快照兜底（可反悔），再整体还原。
 * 兜底快照若失败则中止恢复——恢复是破坏性操作，必须确保有回退点。
 */
export async function restoreSnapshot(accountId: string, snapshotId: string): Promise<void> {
  const target = await db.snapshots.get(snapshotId)
  if (!target || target.accountId !== accountId) {
    throw new Error('快照不存在或已删除')
  }
  // 先读入目标数据，避免随后的兜底快照触发清理时把目标快照行删掉
  const dataToRestore = target.data
  await createSnapshot(accountId, 'pre-restore')
  await importBackup(accountId, dataToRestore)
}

/** 删除单张快照（幂等；非本账号的快照忽略） */
export async function deleteSnapshot(accountId: string, snapshotId: string): Promise<void> {
  const target = await db.snapshots.get(snapshotId)
  if (!target || target.accountId !== accountId) return
  await db.snapshots.delete(snapshotId)
}
