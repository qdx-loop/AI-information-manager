import type { FieldDef, FieldType, FieldValue, Item } from '@/types'
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
  /** 可选示例数据：建库时一键填入几条样例，帮助买家快速理解字段用法 */
  sample?: Array<Record<string, FieldValue>>
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
    sample: [
      { name: '王先生', city: '北京', phone: '138****1234', intent: '高', closed: false, note: '下周跟进报价' },
      { name: '李女士', city: '上海', phone: '139****5678', intent: '中', closed: false, note: '已发资料' },
      { name: '张总', city: '深圳', phone: '136****9012', intent: '高', closed: true, note: '已签约' },
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
    sample: [
      { date: '2026-08-01', item: '八月工资', type: '收入', amount: 8000, category: '工资', note: '' },
      { date: '2026-08-03', item: '超市采购', type: '支出', amount: 236, category: '餐饮', note: '' },
      { date: '2026-08-05', item: '进货', type: '支出', amount: 1500, category: '进货', note: '供应商 A' },
    ],
  },
  {
    key: 'staff',
    name: '员工档案',
    category: '人事/行政',
    desc: '入职信息、合同到期、联系方式',
    fields: [
      { key: 'name', label: '姓名', type: 'text', required: true },
      { key: 'role', label: '岗位', type: 'text' },
      { key: 'phone', label: '电话', type: 'text' },
      { key: 'join', label: '入职日期', type: 'date' },
      { key: 'contractEnd', label: '合同到期', type: 'date' },
      { key: 'status', label: '状态', type: 'select', options: ['在职', '试用', '离职'] },
    ],
    sample: [
      { name: '陈小明', role: '店员', phone: '137****2211', join: '2025-03-01', contractEnd: '2027-02-28', status: '在职' },
      { name: '刘芳', role: '收银', phone: '135****3344', join: '2026-06-15', contractEnd: '2026-09-14', status: '试用' },
    ],
  },
  {
    key: 'tasks',
    name: '项目任务',
    category: '团队/项目',
    desc: '任务分派、进度与截止日跟踪',
    fields: [
      { key: 'title', label: '任务', type: 'text', required: true },
      { key: 'owner', label: '负责人', type: 'text' },
      { key: 'due', label: '截止日', type: 'date' },
      { key: 'progress', label: '进度', type: 'select', options: ['未开始', '进行中', '已完成', '受阻'] },
      { key: 'priority', label: '优先级', type: 'select', options: ['高', '中', '低'] },
      { key: 'note', label: '备注', type: 'textarea' },
    ],
    sample: [
      { title: '整理供应商报价', owner: '小王', due: '2026-09-01', progress: '进行中', priority: '高', note: '' },
      { title: '门店盘点', owner: '小李', due: '2026-09-05', progress: '未开始', priority: '中', note: '' },
    ],
  },
  {
    key: 'vehicle',
    name: '车辆管理',
    category: '车队/物流',
    desc: '保险、年检、保养到期提醒',
    fields: [
      { key: 'plate', label: '车牌号', type: 'text', required: true },
      { key: 'model', label: '车型', type: 'text' },
      { key: 'driver', label: '司机', type: 'text' },
      { key: 'inspect', label: '年检到期', type: 'date' },
      { key: 'insurance', label: '保险到期', type: 'date' },
      { key: 'note', label: '备注', type: 'textarea' },
    ],
    sample: [
      { plate: '京A·88888', model: '五菱宏光', driver: '老赵', inspect: '2026-10-01', insurance: '2026-12-31', note: '' },
    ],
  },
  {
    key: 'mistakes',
    name: '学习错题本',
    category: '学习/教育',
    desc: '错题归档、知识点与复习计划',
    fields: [
      { key: 'subject', label: '科目', type: 'select', options: ['语文', '数学', '英语', '物理', '化学', '其他'], required: true },
      { key: 'point', label: '知识点', type: 'text' },
      { key: 'wrong', label: '错题描述', type: 'textarea' },
      { key: 'mastered', label: '已掌握', type: 'checkbox' },
      { key: 'review', label: '下次复习', type: 'date' },
    ],
    sample: [
      { subject: '数学', point: '二次函数', wrong: '顶点式与一般式互化出错', mastered: false, review: '2026-09-02' },
    ],
  },
  {
    key: 'medicine',
    name: '家庭医药台账',
    category: '家庭/健康',
    desc: '药品有效期、用法用量记录',
    fields: [
      { key: 'name', label: '药品名', type: 'text', required: true },
      { key: 'use', label: '用法用量', type: 'text' },
      { key: 'expire', label: '有效期', type: 'date' },
      { key: 'qty', label: '剩余数量', type: 'number' },
      { key: 'note', label: '备注', type: 'textarea' },
    ],
    sample: [
      { name: '布洛芬', use: '发热时 1 粒', expire: '2027-01-31', qty: 8, note: '' },
    ],
  },
]

/** 复制一份字段模板到指定库（新建子库时继承父库结构用） */
export async function copyTemplateToLibrary(srcFields: FieldDef[], dstLibraryId: string): Promise<void> {
  if (srcFields.length === 0) return
  const fields: FieldDef[] = srcFields.map((f, idx) => ({
    ...f,
    id: newId(),
    libraryId: dstLibraryId,
    sortOrder: idx,
  }))
  await getProvider().saveTemplate(dstLibraryId, fields)
}

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

/** 把模板的示例数据写入指定库（可选，帮助买家快速理解字段用法）；返回写入条数 */
export async function applySampleData(libraryId: string, accountId: string, tpl: LibTemplate): Promise<number> {
  if (!tpl.sample || tpl.sample.length === 0) return 0
  const provider = getProvider()
  const now = Date.now()
  let order = 0
  for (const s of tpl.sample) {
    const item: Item = {
      id: newId(),
      libraryId,
      accountId,
      fields: s as Item['fields'],
      pinned: false,
      sortOrder: order++,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    await provider.createItem(item)
  }
  return tpl.sample.length
}
