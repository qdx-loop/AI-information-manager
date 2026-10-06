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

/**
 * 拍一张当前数据快照并存入本机快照表（超限时自动清理最旧）。失败会抛错，由调用方决定是否兜底。
 *
 * @param keepIds 这次要额外保住的快照 id（恢复流程里指「正要恢复的那张」）：
 *   它可能恰好是最旧的一张，若按 createdAt 直接裁剪就会把正在恢复的快照删掉。
 */
export async function createSnapshot(
  accountId: string,
  trigger: SnapshotTrigger,
  keepIds: string[] = [],
): Promise<SnapshotRecord> {
  const data = await exportBackup(accountId)
  const rec: SnapshotRecord = {
    id: newId(),
    accountId,
    createdAt: Date.now(),
    trigger,
    data,
  }
  await db.snapshots.put(rec)
  await pruneSnapshots(accountId, keepIds)
  return rec
}

/** 保留最近 MAX_SNAPSHOTS 张，删除更旧的（keepIds 里的除外，它们必须活下来） */
async function pruneSnapshots(accountId: string, keepIds: string[] = []): Promise<void> {
  const keep = new Set(keepIds)
  const all = await db.snapshots.where('accountId').equals(accountId).sortBy('createdAt')
  const prunable = all.filter((s) => !keep.has(s.id))
  if (prunable.length > MAX_SNAPSHOTS) {
    const toDelete = prunable.slice(0, prunable.length - MAX_SNAPSHOTS).map((s) => s.id)
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
  // 先读入目标数据（即使随后目标行被删，本地变量里仍持有内容，importBackup 不受影响），
  // 但更要紧的是把目标 id 传给 createSnapshot：它可能恰好是最旧的一张，
  // 拍兜底快照触发裁剪时会被一并删掉 —— 数据没丢，快照行却从列表里消失了，
  // 用户再也点不回「撤销这次恢复」。原来注释只说「先读入数据避免删掉行」，
  // 可 pruneSnapshots 是按 id 删行的，读没读过根本不影响它。
  const dataToRestore = target.data
  await createSnapshot(accountId, 'pre-restore', [snapshotId])
  await importBackup(accountId, dataToRestore)
}

/** 删除单张快照（幂等；非本账号的快照忽略） */
export async function deleteSnapshot(accountId: string, snapshotId: string): Promise<void> {
  const target = await db.snapshots.get(snapshotId)
  if (!target || target.accountId !== accountId) return
  await db.snapshots.delete(snapshotId)
}
