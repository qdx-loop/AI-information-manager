/**
 * ★★★ 卖家配置文件（推广落地页展示的内容，只改这个文件即可） ★★★
 *
 * 1. contactEmails 为买家联系邮箱，可自行增删
 * 2. 价格随行情自己调整
 */

export const SITE = {
  brand: '信息管理',
  slogan: '用说话的方式，管理你的数据',
  subtitle: '建库、录入、查资料、做报表——对 AI 说一句话就行。不会 Excel 函数也能上手。',
  features: [
    { icon: '💬', title: '说话即操作', desc: '"帮我查北京没成交的客户"，一句话出结果，不用记任何软件操作' },
    { icon: '🧩', title: '字段随心定义', desc: '客户、库存、房源、会员……想要什么列就加什么列，还有现成行业模板' },
    { icon: '📊', title: '一句话出图表', desc: '统计、对比、占比，AI 直接画好图，一键下载保存' },
    { icon: '📱', title: '手机电脑都能用', desc: '数据存在自己的设备里，安全私密；可开启云同步跨设备接力' },
  ],
  steps: [
    '管理员给你开通账号',
    '登录后创建管理库（有行业模板可一键套用）',
    '手动录入或导入 Excel，之后全部交给 AI',
  ],
  prices: [
    { name: '体验卡', nameEn: 'Trial', days: '3 天', price: '免费', priceEn: 'Free', note: '新人首选' },
    { name: '月卡', nameEn: 'Monthly', days: '30 天', price: '¥29.9', priceEn: '¥29.9', note: '' },
    { name: '季卡', nameEn: 'Quarterly', days: '90 天', price: '¥79', priceEn: '¥79', note: '热门' },
    { name: '半年卡', nameEn: 'Half-year', days: '180 天', price: '¥139', priceEn: '¥139', note: '' },
    { name: '年卡', nameEn: 'Yearly', days: '365 天', price: '¥259', priceEn: '¥259', note: '最划算' },
  ],
  contactEmails: ['qdx19qdx@126.com', 'qdx2025@outlook.com'], // ←★ 联系邮箱
}
