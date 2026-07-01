import type { BackupBlob } from '@/types'
import { getProvider } from './providerFactory'

// 导出当前账户全部数据为备份结构
export async function exportBackup(accountId: string): Promise<BackupBlob> {
  return getProvider().exportAll(accountId)
}

// 从备份结构恢复（覆盖当前账户数据）
export async function importBackup(accountId: string, blob: BackupBlob): Promise<void> {
  await getProvider().importAll(accountId, blob)
}
