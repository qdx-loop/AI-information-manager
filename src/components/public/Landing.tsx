import { Button, Space, Typography } from 'antd'
import {
  LoginOutlined,
  MessageOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  MobileOutlined,
  WechatOutlined,
  CheckOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { SITE } from '@/config/site'

const { Text } = Typography

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

// 模拟 AI 对话的"运行中的产品"卡片（2026 SaaS 主流：hero 里放可感知的产品表面）
function ProductDemo() {
  const bars = [
    { city: '北京', n: 2, h: 34 },
    { city: '上海', n: 2, h: 34 },
    { city: '广州', n: 1, h: 17 },
    { city: '深圳', n: 1, h: 17 },
    { city: '其他', n: 0, h: 4 },
  ]
  return (
    <div
      style={{
        maxWidth: 620,
        margin: '40px auto 0',
        borderRadius: 16,
        border: '1px solid #E2E8F0',
        background: '#fff',
        boxShadow: '0 24px 60px -24px rgba(15,23,42,.18)',
        overflow: 'hidden',
        textAlign: 'left',
      }}
    >
      {/* 窗口栏 */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: '1px solid #EEF2F6' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FCA5A5' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FCD34D' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#86EFAC' }} />
        <span style={{ marginLeft: 8, fontSize: 12, color: '#94A3B8' }}>{SITE.brand} · AI 助手</span>
      </div>
      {/* 对话区 */}
      <div style={{ padding: '18px 16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: '#0D9488', color: '#fff', borderRadius: '12px 12px 2px 12px', padding: '8px 12px', fontSize: 14 }}>
            统计每个城市的客户数
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: '#F8FAFC', borderRadius: '12px 12px 12px 2px', padding: '10px 14px', fontSize: 14, color: '#334155', alignSelf: 'flex-start', maxWidth: '85%' }}>
            共 6 位客户：北京 2 · 上海 2 · 广州 1 · 深圳 1
          </div>
          <div style={{ background: '#F8FAFC', borderRadius: '12px 12px 12px 2px', padding: '12px 16px', alignSelf: 'flex-start', width: 'min(100%, 340px)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 56 }}>
              {bars.map((b) => (
                <div key={b.city} style={{ textAlign: 'center' }}>
                  <Text style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>{b.n}</Text>
                  <div className="lp-bar" style={{ height: Math.max(b.h, 5) }} />
                  <Text style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginTop: 4 }}>{b.city}</Text>
                </div>
              ))}
            </div>
          </div>
          <div style={{ alignSelf: 'flex-start', padding: '2px 6px' }}>
            <span className="lp-dot" /> <span className="lp-dot" style={{ animationDelay: '.2s' }} />{' '}
            <span className="lp-dot" style={{ animationDelay: '.4s' }} />
          </div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid #EEF2F6', padding: '8px 14px', fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
        ▲ 真实界面示意：对 AI 说一句话，直接得到统计和图表
      </div>
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const goLogin = () => navigate('/login')

  return (
    <div style={{ minHeight: '100vh', background: '#fff', color: '#0F172A' }}>
      {/* ===== 导航 ===== */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'rgba(255,255,255,.86)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #EEF2F6',
        }}
      >
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 24 }}>
          <Space align="center" style={{ cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: '#0D9488', display: 'inline-block' }} />
            <Text strong style={{ fontSize: 16 }}>{SITE.brand}</Text>
          </Space>
          <nav style={{ flex: 1, display: 'flex', gap: 4, justifyContent: 'center' }}>
            <button className="lp-nav-link" onClick={() => scrollTo('features')}>功能</button>
            <button className="lp-nav-link" onClick={() => scrollTo('price')}>价格</button>
            <button className="lp-nav-link" onClick={() => scrollTo('faq')}>常见问题</button>
            <button className="lp-nav-link" onClick={() => scrollTo('contact')}>联系我们</button>
          </nav>
          <Button type="primary" onClick={goLogin}>登录使用</Button>
        </div>
      </header>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 20px 72px' }}>
        {/* ===== Hero：一个承诺 + 一个主 CTA ===== */}
        <section style={{ textAlign: 'center', paddingTop: 72 }}>
          <span className="lp-hero-badge">✦ 面向个人与小团队的 AI 数据管家</span>
          <h1 style={{ fontSize: 'clamp(30px, 5vw, 46px)', lineHeight: 1.2, letterSpacing: '-0.02em', margin: '20px auto 14px', maxWidth: 720, fontWeight: 700 }}>
            用说话的方式，
            <br />
            管理你的数据
          </h1>
          <p style={{ fontSize: 17, color: '#64748B', maxWidth: 520, margin: '0 auto 28px', lineHeight: 1.7 }}>
            建库、录入、查资料、做报表，对 AI 说一句话就行。
            客户、库存、房源、账本——都有现成模板。
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button type="primary" size="large" icon={<LoginOutlined />} onClick={goLogin}>
              免费试用 3 天
            </Button>
            <Button size="large" onClick={() => scrollTo('price')}>
              查看价格
            </Button>
          </div>
          <div style={{ marginTop: 14, fontSize: 13, color: '#94A3B8' }}>
            无需付款信息 · 数据存在你自己的设备里 · 手机电脑都能用
          </div>

          <ProductDemo />
        </section>

        {/* ===== 功能 ===== */}
        <section id="features" style={{ paddingTop: 88 }}>
          <h2 style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>为一个目的而生：</h2>
          <p style={{ textAlign: 'center', color: '#64748B', marginBottom: 36 }}>让不懂表格的人，也能把数据管得明明白白</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
            {[
              { icon: <MessageOutlined />, title: '说话即操作', desc: '"帮我查北京没成交的客户"，一句话出结果，不用学任何软件操作' },
              { icon: <AppstoreOutlined />, title: '字段随心定义', desc: '想要什么列就加什么列；客户/库存/房源等模板一键套用' },
              { icon: <BarChartOutlined />, title: '一句话出图表', desc: '统计、对比、占比自动画成图，随时下载成图片发给老板' },
              { icon: <MobileOutlined />, title: '手机电脑无缝', desc: '数据默认存在自己设备里更私密，也能开启云同步跨设备接力' },
            ].map((f) => (
              <div
                key={f.title}
                style={{
                  border: '1px solid #EEF2F6',
                  borderRadius: 16,
                  padding: '22px 20px',
                  background: '#fff',
                }}
              >
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: '#F0FDFA',
                    color: '#0D9488',
                    fontSize: 18,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  {f.icon}
                </span>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{f.title}</div>
                <div style={{ color: '#64748B', fontSize: 14, lineHeight: 1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== 价格 ===== */}
        <section id="price" style={{ paddingTop: 88 }}>
          <h2 style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>价格透明</h2>
          <p style={{ textAlign: 'center', color: '#64748B', marginBottom: 36 }}>
            按时长买断使用期，到期联系管理员续费即可，数据一直都在
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, alignItems: 'stretch' }}>
            {SITE.prices.map((p) => {
              const popular = p.note === '热门'
              return (
                <div
                  key={p.name}
                  style={{
                    position: 'relative',
                    border: popular ? '2px solid #0D9488' : '1px solid #E2E8F0',
                    borderRadius: 16,
                    padding: '22px 18px',
                    textAlign: 'center',
                    background: popular ? '#F0FDFA' : '#fff',
                  }}
                >
                  {popular && (
                    <span style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: '#0D9488', color: '#fff', fontSize: 12, padding: '2px 10px', borderRadius: 999 }}>
                      最受欢迎
                    </span>
                  )}
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>{p.name}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{p.price}</div>
                  <div style={{ color: '#94A3B8', fontSize: 13, marginTop: 4 }}>{p.days}</div>
                  {p.note && p.note !== '热门' && (
                    <div style={{ marginTop: 8 }}>
                      <span
                        style={{
                          fontSize: 12,
                          color: '#0D9488',
                          background: '#F0FDFA',
                          border: '1px solid #99F6E4',
                          borderRadius: 999,
                          padding: '2px 10px',
                          display: 'inline-block',
                        }}
                      >
                        {p.note}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, marginTop: 16 }}>
            也支持自定义天数 · 所有卡种到期后数据保留，续费即恢复使用
          </p>
        </section>

        {/* ===== FAQ ===== */}
        <section id="faq" style={{ paddingTop: 88, maxWidth: 680, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, textAlign: 'center', marginBottom: 32 }}>常见问题</h2>
          {[
            ['我的数据存在哪里？安全吗？', '默认保存在你自己的设备（浏览器）里，别人拿不到。也可以在设置里开启云端同步，跨设备接力使用。'],
            ['我不懂 Excel / 电脑，能用吗？', '完全可以。录入之后的一切都可以靠"说话"完成；新建管理库时选一个行业模板，字段都帮你配好。'],
            ['到期了会怎么样？', '到期后无法登录，但你的数据原样保留。联系管理员续费后立即恢复使用，什么都不丢。'],
          ].map(([q, a]) => (
            <div key={q} style={{ borderBottom: '1px solid #EEF2F6', padding: '18px 4px' }}>
              <div style={{ fontWeight: 600, marginBottom: 8, display: 'flex', gap: 8 }}>
                <CheckOutlined style={{ color: '#0D9488', marginTop: 3 }} />
                {q}
              </div>
              <div style={{ color: '#64748B', fontSize: 14, lineHeight: 1.75, paddingLeft: 22 }}>{a}</div>
            </div>
          ))}
        </section>

        {/* ===== 深色收尾 CTA（打破单色、给页面节奏） ===== */}
        <section style={{ paddingTop: 88 }}>
          <div
            style={{
              background: '#0F172A',
              borderRadius: 24,
              padding: '48px 28px',
              textAlign: 'center',
              color: '#fff',
            }}
          >
            <h2 style={{ fontSize: 26, margin: '0 0 10px', color: '#fff' }}>今天录的数据，明天就离不开</h2>
            <p style={{ color: '#94A3B8', marginBottom: 24 }}>免费试用 3 天，无需付款信息</p>
            <Button type="primary" size="large" onClick={goLogin}>
              免费开始使用
            </Button>
          </div>
        </section>

        {/* ===== 联系方式 ===== */}
        <section id="contact" style={{ paddingTop: 64, textAlign: 'center' }}>
          <WechatOutlined style={{ fontSize: 26, color: '#0D9488' }} />
          <h3 style={{ fontSize: 20, margin: '10px 0 6px' }}>购买或开通试用</h3>
          <p style={{ color: '#64748B', marginBottom: 14 }}>{SITE.contactNote}</p>
          {SITE.qrImage && (
            <img src={SITE.qrImage} alt="微信二维码" width={150} height={150} style={{ borderRadius: 12, border: '1px solid #E2E8F0', display: 'block', margin: '0 auto 12px' }} />
          )}
          <Button
            icon={<WechatOutlined />}
            onClick={() => {
              navigator.clipboard.writeText(SITE.contactWechat)
            }}
          >
            微信号：{SITE.contactWechat}（点击复制）
          </Button>
        </section>

        <footer style={{ borderTop: '1px solid #EEF2F6', marginTop: 56, paddingTop: 24, textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>
          © {new Date().getFullYear()} {SITE.brand} · aiim.de5.net · 数据由你的账号独立隔离
        </footer>
      </div>
    </div>
  )
}
