import type { FieldDef, Item, Library } from '@/types'
import { getProvider } from '@/db/providerFactory'
import { newId } from '@/utils/id'
import { track } from '@/utils/track'
import { markObStep } from '@/utils/onboarding'

/**
 * 一键创建演示库：预置「客户管理」字段模板与示例数据，
 * 让买家 30 秒内看到完整功能，跳过"建库→配模板→录数据"三道墙。
 */
export async function createDemoLibrary(accountId: string): Promise<string> {
  const provider = getProvider()

  const lib: Library = {
    id: newId(),
    accountId,
    name: '演示 · 客户管理',
    category: '演示',
    sortOrder: 0,
    deletedAt: null,
  }
  await provider.createLibrary(lib)

  let order = 0
  const f = (
    key: string,
    label: string,
    type: FieldDef['type'],
    extra: Partial<FieldDef> = {},
  ): FieldDef => ({
    id: newId(),
    libraryId: lib.id,
    key,
    label,
    type,
    options: [],
    required: false,
    visible: true,
    sortOrder: order++,
    ...extra,
  })

  const fields: FieldDef[] = [
    f('name', '姓名', 'text', { required: true }),
    f('city', '城市', 'select', { options: ['北京', '上海', '广州', '深圳', '其他'] }),
    f('phone', '电话', 'text'),
    f('intent', '意向等级', 'select', { options: ['高', '中', '低'] }),
    f('closed', '已成交', 'checkbox'),
    f('satisfaction', '满意度', 'rating'),
  ]
  await provider.saveTemplate(lib.id, fields)

  const rows: Array<Record<string, string | number | boolean | null>> = [
    { name: '张伟', city: '北京', phone: '13800000001', intent: '高', closed: true, satisfaction: 5 },
    { name: '李娜', city: '上海', phone: '13800000002', intent: '高', closed: false, satisfaction: 4 },
    { name: '王强', city: '广州', phone: '13800000003', intent: '中', closed: false, satisfaction: 3 },
    { name: '刘敏', city: '深圳', phone: '13800000004', intent: '低', closed: false, satisfaction: null },
    { name: '陈静', city: '北京', phone: '13800000005', intent: '中', closed: true, satisfaction: 5 },
    { name: '杨帆', city: '上海', phone: '13800000006', intent: '高', closed: false, satisfaction: 4 },
  ]

  let itemOrder = 0
  for (const row of rows) {
    const item: Item = {
      id: newId(),
      libraryId: lib.id,
      accountId,
      fields: row as Item['fields'],
      pinned: itemOrder === 0,
      sortOrder: itemOrder++,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
    }
    await provider.createItem(item)
  }

  track('demo_created', { libraryId: lib.id })
  // 演示库自带条目，直接为新手清单勾掉「录入第一条数据」
  markObStep(accountId, 'item')
  return lib.id
}
