import { useState } from 'react'
import { Button, Space, Typography } from 'antd'
import {
  LoginOutlined,
  MessageOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  MobileOutlined,
  MailOutlined,
  CheckOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { useAppStore } from '@/store/appStore'
import { SITE } from '@/config/site'

const { Text } = Typography

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

/** 模拟 AI 对话的"运行中的产品"卡片（内容随语言切换） */
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
        borderRadius: 16,
        border: '1px solid #E2E8F0',
        background: '#fff',
        boxShadow: '0 24px 60px -24px rgba(15,23,42,.18)',
        overflow: 'hidden',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: '1px solid #EEF2F6' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FCA5A5' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FCD34D' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#86EFAC' }} />
        <span style={{ marginLeft: 8, fontSize: 12, color: '#94A3B8' }}>
          {t('landing.demo.windowTitle', { brand: SITE.brand })}
        </span>
      </div>
      <div style={{ padding: '18px 16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: '#0D9488', color: '#fff', borderRadius: '12px 12px 2px 12px', padding: '8px 12px', fontSize: 14 }}>
            {t('landing.demo.userMsg')}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: '#F8FAFC', borderRadius: '12px 12px 12px 2px', padding: '10px 14px', fontSize: 14, color: '#334155', alignSelf: 'flex-start', maxWidth: '85%' }}>
            {t('landing.demo.aiLine')}
          </div>
          <div style={{ background: '#F8FAFC', borderRadius: '12px 12px 12px 2px', padding: '12px 16px', alignSelf: 'flex-start', width: 'min(100%, 340px)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 56 }}>
              {barLabels.map((city, i) => (
                <div key={city} style={{ textAlign: 'center' }}>
                  <Text style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>{counts[i]}</Text>
                  <div className="lp-bar" style={{ height: Math.max(heights[i], 5) }} />
                  <Text style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginTop: 4 }}>{city}</Text>
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
            <button className="lp-nav-link" onClick={() => scrollTo('features')}>{t('landing.nav.features')}</button>
            <button className="lp-nav-link" onClick={() => scrollTo('price')}>{t('landing.nav.price')}</button>
            <button className="lp-nav-link" onClick={() => scrollTo('faq')}>{t('landing.nav.faq')}</button>
            <button className="lp-nav-link" onClick={() => scrollTo('contact')}>{t('landing.nav.contact')}</button>
            <button className="lp-nav-link" onClick={() => navigate('/help')}>{t('landing.nav.help')}</button>
          </nav>
          <Button type="text" onClick={() => setLanguage(lang === 'zh' ? 'en' : 'zh')}>
            {lang === 'zh' ? 'EN' : '中'}
          </Button>
          <Button type="primary" onClick={goLogin}>{t('landing.nav.login')}</Button>
        </div>
      </header>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 20px 72px' }}>
        {/* ===== Hero ===== */}
        <section style={{ textAlign: 'center', paddingTop: 72 }}>
          <span className="lp-hero-badge">{t('landing.hero.badge')}</span>
          <h1 style={{ fontSize: 'clamp(30px, 5vw, 46px)', lineHeight: 1.2, letterSpacing: '-0.02em', margin: '20px auto 14px', maxWidth: 720, fontWeight: 700 }}>
            {t('landing.hero.title1')}
            <br />
            {t('landing.hero.title2')}
          </h1>
          <p style={{ fontSize: 17, color: '#64748B', maxWidth: 560, margin: '0 auto 28px', lineHeight: 1.7 }}>
            {t('landing.hero.sub')}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button type="primary" size="large" icon={<LoginOutlined />} onClick={goLogin}>
              {t('landing.hero.cta')}
            </Button>
            <Button size="large" onClick={() => scrollTo('price')}>
              {t('landing.hero.cta2')}
            </Button>
            <Button size="large" type="dashed" href="/app/infodesk.apk" download="信息管理.apk">
              {t('landing.hero.downloadApk')}
            </Button>

          </div>
          <div style={{ marginTop: 14, fontSize: 13, color: '#94A3B8' }}>{t('landing.hero.trust')}</div>

          <ProductDemo />
        </section>

        {/* ===== 功能 ===== */}
        <section id="features" style={{ paddingTop: 88 }}>
          <h2 style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>{t('landing.features.title')}</h2>
          <p style={{ textAlign: 'center', color: '#64748B', marginBottom: 36 }}>{t('landing.features.sub')}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
            {features.map((f) => (
              <div key={f.title} style={{ border: '1px solid #EEF2F6', borderRadius: 16, padding: '22px 20px', background: '#fff' }}>
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
          <h2 style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>{t('landing.price.title')}</h2>
          <p style={{ textAlign: 'center', color: '#64748B', marginBottom: 36 }}>{t('landing.price.sub')}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, alignItems: 'stretch' }}>
            {SITE.prices.map((p) => {
              const popular = p.note === '热门'
              const name = lang === 'en' ? (p as { nameEn?: string }).nameEn ?? p.name : p.name
              const price = lang === 'en' ? (p as { priceEn?: string }).priceEn ?? p.price : p.price
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
                      {t('landing.price.popular')}
                    </span>
                  )}
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>{name}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{price}</div>
                  <div style={{ color: '#94A3B8', fontSize: 13, marginTop: 4 }}>
                    {t(`landing.days.${p.days}`) !== `landing.days.${p.days}` ? t(`landing.days.${p.days}`) : p.days}
                  </div>
                  {p.note && !popular && (
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontSize: 12, color: '#0D9488', background: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: 999, padding: '2px 10px', display: 'inline-block' }}>
                        {t(`landing.note.${p.note}`) !== `landing.note.${p.note}` ? t(`landing.note.${p.note}`) : p.note}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, marginTop: 16 }}>{t('landing.price.customNote')}</p>
        </section>

        {/* ===== FAQ ===== */}
        <section id="faq" style={{ paddingTop: 88, maxWidth: 680, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, textAlign: 'center', marginBottom: 32 }}>{t('landing.faq.title')}</h2>
          {faqs.map(([q, a]) => (
            <div key={q} style={{ borderBottom: '1px solid #EEF2F6', padding: '18px 4px' }}>
              <div style={{ fontWeight: 600, marginBottom: 8, display: 'flex', gap: 8 }}>
                <CheckOutlined style={{ color: '#0D9488', marginTop: 3 }} />
                {q}
              </div>
              <div style={{ color: '#64748B', fontSize: 14, lineHeight: 1.75, paddingLeft: 22 }}>{a}</div>
            </div>
          ))}
        </section>

        {/* ===== 深色收尾 CTA ===== */}
        <section style={{ paddingTop: 88 }}>
          <div style={{ background: '#0F172A', borderRadius: 24, padding: '48px 28px', textAlign: 'center', color: '#fff' }}>
            <h2 style={{ fontSize: 26, margin: '0 0 10px', color: '#fff' }}>{t('landing.dark.title')}</h2>
            <p style={{ color: '#94A3B8', marginBottom: 24 }}>{t('landing.dark.sub')}</p>
            <Button type="primary" size="large" onClick={goLogin}>
              {t('landing.dark.cta')}
            </Button>
          </div>
        </section>

        {/* ===== 联系方式（邮箱） ===== */}
        <section id="contact" style={{ paddingTop: 64, textAlign: 'center' }}>
          <MailOutlined style={{ fontSize: 26, color: '#0D9488' }} />
          <h3 style={{ fontSize: 20, margin: '10px 0 6px' }}>{t('landing.contact.title')}</h3>
          <p style={{ color: '#64748B', marginBottom: 14 }}>{t('landing.contact.note')}</p>
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

        <footer style={{ borderTop: '1px solid #EEF2F6', marginTop: 56, paddingTop: 24, textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>
          © {new Date().getFullYear()} {SITE.brand} · aiim.de5.net{t('landing.footer.isolation')}
        </footer>
      </div>
    </div>
  )
}
