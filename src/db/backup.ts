import type { BackupBlob } from '@/types'
import { getProvider } from './providerFactory'

// 导出当前账户全部数据为备份结构
export async function exportBackup(accountId: string): Promise<BackupBlob> {
  return getProvider().exportAll(accountId)
}

/**
 * 校验备份结构，任何一条不满足就抛错。
 *
 * 这一层是必需的，因为 importAll 的语义是「先清空当前账户，再写入 blob」：
 *   - 两个 provider 都会先删掉账户下全部 items/libraries/fields
 *   - 之后再 bulkPut(blob.*)
 * 所以只要 blob 结构不对，后果不是「导入失败」，而是**静默清空**：
 *
 *   - blob = {libraries:[], fields:[], items:[]}  → 删光，什么都不写，
 *     而且 provider 里的 try/catch 不会触发（没有异常），用户看到「导入成功」
 *   - 用户从文件管理器随便挑了一个 .json（聊天记录、别的项目配置）
 *
 * 原来只有一句 `JSON.parse(text)` 就直接交给 provider。
 * 快照恢复走的是自家快照表，形状可信；但用户从磁盘选的文件完全不可信。
 */
export function validateBackupBlob(blob: unknown): asserts blob is BackupBlob {
  const bad = (why: string): never => {
    throw new Error(`文件不是本应用导出的备份（${why}）。已取消导入，当前数据未改动。`)
  }

  if (blob === null || typeof blob !== 'object' || Array.isArray(blob)) {
    bad('顶层不是对象')
  }
  const b = blob as Record<string, unknown>
  for (const k of ['libraries', 'fields', 'items'] as const) {
    if (!Array.isArray(b[k])) bad(`缺少 ${k} 数组`)
    if ((b[k] as unknown[]).some((x) => x === null || typeof x !== 'object')) {
      bad(`${k} 里有不是对象的条目`)
    }
  }
  if (typeof b.version !== 'number') bad('缺少 version 字段')

  const libs = b.libraries as unknown[]
  if (libs.length === 0) {
    // 特意与「文件坏了」区别开：这是最容易被误选/误导出的空备份，
    // 后果是删光所有数据且不报错。
    bad('备份里一个管理库都没有')
  }
  // 每个条目至少要有 id，否则写进去也无法被后续查询命中
  for (const k of ['libraries', 'fields', 'items'] as const) {
    const arr = b[k] as Array<Record<string, unknown>>
    if (arr.some((x) => typeof x.id !== 'string' || x.id === '')) {
      bad(`${k} 里有缺少 id 的条目`)
    }
  }
}

// 从备份结构恢复（覆盖当前账户数据）
export async function importBackup(accountId: string, blob: BackupBlob): Promise<void> {
  // 校验放在最前面：必须在任何 provider 动手删除之前完成
  validateBackupBlob(blob)
  await getProvider().importAll(accountId, blob)
}
