import type { FieldDef, FieldType } from '@/types'
import { getProvider } from '@/db/providerFactory'
import { newId } from '@/utils/id'

export interface LibTemplate {
  key: string
  name: string
  category: string
  desc: string
  fields: Array<{
    key: string
    label: string
    type: FieldType
    options?: string[]
    required?: boolean
  }>
}

/** 预置行业模板：建库时一键套用字段结构（红队报告增长分析：砍掉"配模板"门槛） */
export const LIB_TEMPLATES: LibTemplate[] = [
  {
    key: 'blank',
    name: '空白库（自己配字段）',
    category: '通用',
    desc: '不预置字段，完全自定义',
    fields: [],
  },
  {
    key: 'customer',
    name: '客户管理',
    category: '销售',
    desc: '跟进客户、意向分级、成交标记',
    fields: [
      { key: 'name', label: '姓名', type: 'text', required: true },
      { key: 'city', label: '城市', type: 'select', options: ['北京', '上海', '广州', '深圳', '其他'] },
      { key: 'phone', label: '电话', type: 'text' },
      { key: 'intent', label: '意向等级', type: 'select', options: ['高', '中', '低'] },
      { key: 'closed', label: '已成交', type: 'checkbox' },
      { key: 'note', label: '备注', type: 'textarea' },
    ],
  },
  {
    key: 'inventory',
    name: '商品库存',
    category: '电商/零售',
    desc: '进销存台账、补货提醒',
    fields: [
      { key: 'name', label: '商品名', type: 'text', required: true },
      { key: 'qty', label: '库存数量', type: 'number' },
      { key: 'cost', label: '进价', type: 'number' },
      { key: 'price', label: '售价', type: 'number' },
      { key: 'unit', label: '单位', type: 'select', options: ['件', '盒', '箱', '瓶', '个'] },
      { key: 'restock', label: '需补货', type: 'checkbox' },
    ],
  },
  {
    key: 'realestate',
    name: '房源管理',
    category: '房产中介',
    desc: '房源状态、户型价格一目了然',
    fields: [
      { key: 'community', label: '小区名', type: 'text', required: true },
      { key: 'layout', label: '户型', type: 'select', options: ['一居', '两居', '三居', '四居+', '别墅'] },
      { key: 'area', label: '面积(㎡)', type: 'number' },
      { key: 'price', label: '总价(万)', type: 'number' },
      { key: 'status', label: '状态', type: 'select', options: ['在售', '已售', '锁定', '暂缓'] },
      { key: 'ownerPhone', label: '业主电话', type: 'text' },
    ],
  },
  {
    key: 'fitness',
    name: '健身会员',
    category: '健身/教培',
    desc: '卡种到期、剩余课时跟踪',
    fields: [
      { key: 'name', label: '会员姓名', type: 'text', required: true },
      { key: 'cardType', label: '卡种', type: 'select', options: ['月卡', '季卡', '年卡', '私教课'] },
      { key: 'expire', label: '到期日', type: 'date' },
      { key: 'remain', label: '剩余次数', type: 'number' },
      { key: 'phone', label: '电话', type: 'text' },
      { key: 'note', label: '备注', type: 'textarea' },
    ],
  },
  {
    key: 'ledger',
    name: '收支记账本',
    category: '个人/小店',
    desc: '日常收支流水与分类统计',
    fields: [
      { key: 'date', label: '日期', type: 'date', required: true },
      { key: 'item', label: '项目', type: 'text' },
      { key: 'type', label: '收支', type: 'select', options: ['收入', '支出'] },
      { key: 'amount', label: '金额', type: 'number' },
      { key: 'category', label: '分类', type: 'select', options: ['工资', '餐饮', '交通', '进货', '房租', '其他'] },
      { key: 'note', label: '备注', type: 'textarea' },
    ],
  },
]

/** 把模板字段写入指定库（保留调用方已创建的库名/分类） */
export async function applyTemplate(libraryId: string, tpl: LibTemplate): Promise<void> {
  if (tpl.fields.length === 0) return
  const fields: FieldDef[] = tpl.fields.map((f, idx) => ({
    id: newId(),
    libraryId,
    key: f.key,
    label: f.label,
    type: f.type,
    options: f.options ?? [],
    required: !!f.required,
    visible: true,
    sortOrder: idx,
  }))
  await getProvider().saveTemplate(libraryId, fields)
}
