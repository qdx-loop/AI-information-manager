/**
 * 站点配置文件（推广落地页展示的内容，只改这个文件即可）
 *
 * 1. contactEmails 为对外联系邮箱，可自行增删
 * 2. 2026-09 起产品改为「自助注册 + 永久免费」，价格表已整体移除
 */

export const SITE = {
  brand: '信息管理',
  // Turnstile sitekey：按设计就是公开的（公钥性质），可以安全地打进前端包。
  // 真正的安全在服务端 siteverify，密钥 TURNSTILE_SECRET 只存在 Pages 机密里。
  turnstileSiteKey: '0x4AAAAAAFGx3halRl4kIYkd',
  turnstileAction: 'signup',
  slogan: '用说话的方式，管理你的数据',
  subtitle: '建库、录入、查资料、做报表——对 AI 说一句话就行。不会 Excel 函数也能上手。',
  steps: [
    '打开网址，点「免费注册」，起个用户名设个密码',
    '创建管理库，按需要添加字段（可复用其他库的字段模板）',
    '手动录入或导入 Excel，之后全部交给 AI',
  ],
  contactEmails: ['qdx19qdx@126.com', 'qdx2025@outlook.com'], // ←★ 联系邮箱
}
