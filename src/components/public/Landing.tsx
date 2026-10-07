import { useState } from 'react'
import { Button, Space, Typography } from 'antd'
import {
  MessageOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  MobileOutlined,
  MailOutlined,
  UserAddOutlined,
  DownloadOutlined,
  UserOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { useAppStore } from '@/store/appStore'
import { SITE } from '@/config/site'

const { Text } = Typography

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

/** 模拟 AI 对话的"运行中的产品"卡片（内容随语言切换）
 *
 * 刻意不用假浏览器窗口（红黄绿圆点 + 标题栏）：那是"AI 落地页模板"最重的
 * 两个信号之一，而且对本产品是谎言——它是 Web 应用，不是 macOS 软件。
 * 分隔靠 1px 发丝线（DESIGN.md Hairline Rule），不靠大投影。
 * 气泡几何与应用内真实聊天一致：8px 圆角 + 28px 圆形头像，让"示意图"
 * 名副其实——用户进来看到的和应用里是同一个东西。
 */
function ProductDemo() {
  const t = useI18n()
  const barLabels = t('landing.demo.bars').split(',')
  const counts = [2, 2, 1, 1, 0]
  const heights = [34, 34, 17, 17, 5]
  return (
    <div
      style={{
        maxWidth: 620,
        margin: '40px auto 0',
        borderRadius: 8,
        border: '1px solid #D3D9DE',
        background: '#fff',
        overflow: 'hidden',
        textAlign: 'left',
      }}
    >
      <div style={{ padding: '20px 18px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <div style={{ background: 'var(--app-glaze)', color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}>
            {t('landing.demo.userMsg')}
          </div>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--app-glaze)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
            <UserOutlined />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E3E8EC', color: '#4E5866', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
              <RobotOutlined />
            </div>
            <div style={{ background: '#F5F7F8', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#333B47', maxWidth: '85%' }}>
              {t('landing.demo.aiLine')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E3E8EC', color: '#4E5866', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, visibility: 'hidden' }}>
              <RobotOutlined />
            </div>
            <div style={{ background: '#F5F7F8', borderRadius: 8, padding: '12px 16px', width: 'min(100%, 340px)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 56 }}>
                {barLabels.map((city, i) => (
                  <div key={city} style={{ textAlign: 'center' }}>
                    <Text className="num" style={{ fontSize: 11, color: '#4E5866', display: 'block', marginBottom: 4 }}>{counts[i]}</Text>
                    <div className="lp-bar" style={{ height: Math.max(heights[i], 5) }} />
                    <Text style={{ fontSize: 11, color: '#8A94A0', display: 'block', marginTop: 4 }}>{city}</Text>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ padding: '2px 6px 2px 36px' }}>
            <span className="lp-dot" /> <span className="lp-dot" style={{ animationDelay: '.2s' }} />{' '}
            <span className="lp-dot" style={{ animationDelay: '.4s' }} />
          </div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid #E3E8EC', padding: '8px 14px', fontSize: 12, color: '#8A94A0', textAlign: 'center' }}>
        {t('landing.demo.caption')}
      </div>
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const t = useI18n()
  const lang = useAppStore((s) => s.settings.language ?? 'zh')
  const setLanguage = useAppStore((s) => s.setLanguage)
  const [copiedEmail, setCopiedEmail] = useState('')
  const goLogin = () => navigate('/login')
  // 新访客没有账号，导航主按钮直接把他送到「注册」页签，省一次点击
  const goRegister = () => navigate('/login?mode=register')

  const features = [
    { icon: <MessageOutlined />, title: t('landing.f1t'), desc: t('landing.f1d') },
    { icon: <AppstoreOutlined />, title: t('landing.f2t'), desc: t('landing.f2d') },
    { icon: <BarChartOutlined />, title: t('landing.f3t'), desc: t('landing.f3d') },
    { icon: <MobileOutlined />, title: t('landing.f4t'), desc: t('landing.f4d') },
  ]
  const faqs = [
    [t('landing.faq.q1'), t('landing.faq.a1')],
    [t('landing.faq.q2'), t('landing.faq.a2')],
    [t('landing.faq.q3'), t('landing.faq.a3')],
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#fff', color: '#1F2328' }}>
      {/* ===== 导航 ===== */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          // 不做 backdrop-blur：毛玻璃是"模板感"来源之一，
          // 青瓷体系的分层靠实底 + 发丝线（Hairline Rule）
          background: '#fff',
          borderBottom: '1px solid #E3E8EC',
        }}
      >
        <div className="lp-header">
          <Space align="center" className="lp-brand" style={{ cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--app-glaze)', display: 'inline-block' }} />
            <Text strong style={{ fontSize: 16 }}>{SITE.brand}</Text>
          </Space>
          <nav className="lp-nav">
            <button className="lp-nav-link" onClick={() => scrollTo('features')}>{t('landing.nav.features')}</button>
            <button className="lp-nav-link" onClick={() => scrollTo('faq')}>{t('landing.nav.faq')}</button>
            <button className="lp-nav-link" onClick={() => scrollTo('contact')}>{t('landing.nav.contact')}</button>
            <button className="lp-nav-link" onClick={() => navigate('/help')}>{t('landing.nav.help')}</button>
          </nav>
          <Button type="text" onClick={() => setLanguage(lang === 'zh' ? 'en' : 'zh')}>
            {lang === 'zh' ? 'EN' : '中'}
          </Button>
          <Button type="primary" onClick={goRegister}>{t('landing.nav.login')}</Button>
        </div>
      </header>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 20px 72px' }}>
        {/* ===== Hero ===== */}
        <section style={{ textAlign: 'center', paddingTop: 72 }}>
          {/* 不放 badge/眉题：标题自己说话（一上来三件套 = 落地页模板的第一特征）。
              原来的「✦ AI 数据管家」那句定位信息并进了副标题。 */}
          <h1 style={{ fontSize: 'clamp(30px, 5vw, 46px)', lineHeight: 1.2, margin: '0 auto 14px', maxWidth: 720, fontWeight: 700, color: '#1F2328' }}>
            {t('landing.hero.title1')}
            <br />
            {t('landing.hero.title2')}
          </h1>
          <p style={{ fontSize: 17, color: '#4E5866', maxWidth: 560, margin: '0 auto 28px', lineHeight: 1.7 }}>
            {t('landing.hero.sub')}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button type="primary" size="large" icon={<UserAddOutlined />} onClick={goRegister}>
              {t('landing.hero.cta')}
            </Button>
            {/* dashed 看起来像未完成的占位按钮；下载是真实动作，给实底次级按钮 */}
            <Button size="large" icon={<DownloadOutlined />} href="/app/infodesk.apk" download="信息管理.apk">
              {t('landing.hero.downloadApk')}
            </Button>
          </div>

          <div style={{ marginTop: 14, fontSize: 13, color: '#8A94A0' }}>{t('landing.hero.trust')}</div>

          <ProductDemo />
        </section>

        {/* ===== 功能 ===== */}
        <section id="features" style={{ paddingTop: 88 }}>
          <h2 style={{ fontSize: 28, textAlign: 'center', marginBottom: 8, color: '#1F2328' }}>{t('landing.features.title')}</h2>
          <p style={{ textAlign: 'center', color: '#4E5866', marginBottom: 36 }}>{t('landing.features.sub')}</p>
          {/* 规格表式发丝线网格：1px gap 透出边线色，任何列数下分隔线都完整。
              不用"tinted 圆角方块托图标 + 等大卡片"——那是 AI 落地页的指纹构图。
              图标退成 16px 行内元素，与标题同行，信息靠排版层级而不是色块。 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: 1,
              background: '#E3E8EC',
              border: '1px solid #E3E8EC',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {features.map((f) => (
              <div key={f.title} style={{ background: '#fff', padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ color: '#0F766E', fontSize: 16, display: 'inline-flex', flexShrink: 0 }}>
                    {f.icon}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 15, color: '#1F2328' }}>{f.title}</span>
                </div>
                <div style={{ color: '#4E5866', fontSize: 13.5, lineHeight: 1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section id="faq" style={{ paddingTop: 88, maxWidth: 680, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, textAlign: 'center', marginBottom: 32, color: '#1F2328' }}>{t('landing.faq.title')}</h2>
          {faqs.map(([q, a]) => (
            <div key={q} style={{ borderBottom: '1px solid #E3E8EC', padding: '18px 4px' }}>
              {/* 不加对勾前缀：问题是问题，不是已完成的检查项 */}
              <div style={{ fontWeight: 600, marginBottom: 8, color: '#1F2328' }}>{q}</div>
              <div style={{ color: '#4E5866', fontSize: 14, lineHeight: 1.75 }}>{a}</div>
            </div>
          ))}
        </section>

        {/* ===== 收尾 CTA ===== */}
        <section style={{ paddingTop: 88 }}>
          {/* 深窑青而不是随手拿来的 slate-900：整个页面的色彩语言
              终于和应用同源；8px 圆角回归系统（不是 24px 的"模板胶囊"） */}
          <div style={{ background: '#134E4A', borderRadius: 8, padding: '48px 28px', textAlign: 'center', color: '#fff' }}>
            <h2 style={{ fontSize: 26, margin: '0 0 10px', color: '#fff' }}>{t('landing.dark.title')}</h2>
            <p style={{ color: 'rgba(255,255,255,.78)', marginBottom: 24 }}>{t('landing.dark.sub')}</p>
            {/* 深底上的主按钮必须反白：teal 填充压在深窑青上几乎不可见（对比度不足），
                白底深青字才既有对比又贵气 */}
            <Button size="large" style={{ background: '#fff', borderColor: '#fff', color: '#134E4A', fontWeight: 600 }} onClick={goLogin}>
              {t('landing.dark.cta')}
            </Button>
          </div>
        </section>

        {/* ===== 联系方式（邮箱） ===== */}
        <section id="contact" style={{ paddingTop: 64, textAlign: 'center' }}>
          <MailOutlined style={{ fontSize: 26, color: 'var(--app-glaze)' }} />
          <h3 style={{ fontSize: 20, margin: '10px 0 6px' }}>{t('landing.contact.title')}</h3>
          <p style={{ color: '#4E5866', marginBottom: 14 }}>{t('landing.contact.note')}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
            {SITE.contactEmails.map((email) => (
              <Button
                key={email}
                icon={<MailOutlined />}
                onClick={() => {
                  navigator.clipboard.writeText(email)
                  setCopiedEmail(email)
                }}
              >
                {email}
                {copiedEmail === email ? ` · ${t('common.copied')}` : ` · ${t('landing.contact.copyHint')}`}
              </Button>
            ))}
          </div>
          <a href={`mailto:${SITE.contactEmails[0]}`} style={{ fontSize: 13 }} onClick={goLogin}>
            {t('landing.contact.hasAccount')}
          </a>
        </section>

        <footer style={{ borderTop: '1px solid #E3E8EC', marginTop: 56, paddingTop: 24, textAlign: 'center', fontSize: 12, color: '#8A94A0' }}>
          © {new Date().getFullYear()} {SITE.brand} · aiim.de5.net{t('landing.footer.isolation')}
        </footer>
      </div>
    </div>
  )
}
