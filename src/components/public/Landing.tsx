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
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { useAppStore } from '@/store/appStore'
import { SITE } from '@/config/site'

const { Text } = Typography

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

/**
 * 真实界面截图（public/hero-table.png）。
 *
 * 原来这里是一段用 div 拼的"聊天 + 柱状图"示意，卡片上还写着
 * 「真实界面示意」—— 但它不是真界面，是硬编码的假数据
 * （counts = [2,2,1,1,0]）。这是 anti-slop 里 C4「抽象演示图顶替真实产品」
 * 的典型形态：示意可以放在任何产品页上，且它展示的是聊天气泡——
 * 本产品最没有辨识度的部分。
 *
 * 现在换成从运行中的应用直接截的表格视图：那是这个产品真正的样子，
 * 也是唯一能证明「录进去就能扫读、能直接改」的东西。图里是示例数据。
 */
function ProductShot() {
  const t = useI18n()
  return (
    <figure
      style={{
        maxWidth: 860,
        margin: '40px auto 0',
        borderRadius: 8,
        border: '1px solid #D3D9DE',
        background: '#fff',
        overflow: 'hidden',
        textAlign: 'left',
      }}
    >
      {/* 窄屏不缩图：7 列表格缩到 390px 宽会糊成一片灰，比没有更糟。
          改成固定一个仍然读得清的最小宽度，横向滑动查看 —— 手机上
          表格本来就宽，滑动是符合直觉的。 */}
      <div className="lp-shot-scroll">
        <img
          src="/hero-table.png"
          alt={t('landing.shot.alt')}
          loading="eager"
          decoding="async"
          style={{ display: 'block' }}
        />
      </div>
      <figcaption
        style={{
          borderTop: '1px solid #E3E8EC',
          padding: '9px 14px',
          fontSize: 12,
          color: '#66717E',
          textAlign: 'center',
        }}
      >
        {t('landing.shot.caption')}
      </figcaption>
    </figure>
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
  const povFacts = [
    { title: t('landing.pov.f1t'), desc: t('landing.pov.f1d') },
    { title: t('landing.pov.f2t'), desc: t('landing.pov.f2d') },
    { title: t('landing.pov.f3t'), desc: t('landing.pov.f3d') },
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
            <button className="lp-nav-link" onClick={() => scrollTo('privacy')}>{t('landing.nav.privacy')}</button>
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

          <ProductShot />
        </section>

        {/* ===== 立场段 =====
            这是整页唯一"不对称"的一节，也是唯一的节奏断点。
            之前每一节都是：居中标题 + 居中副标题 + 居中内容，节奏完全一致，
            结果是没有任何一处被强调（anti-slop S6）。
            这里改成左文右证据：左边是一句立场，右边是三条具体后果。
            立场本身是产品已经做到、竞品抄不走的事实（数据不在我们服务器上）。 */}
        <section id="privacy" className="lp-pov">
          <div className="lp-pov-lead">
            <div className="lp-pov-eyebrow">{t('landing.pov.eyebrow')}</div>
            <h2 className="lp-pov-title">{t('landing.pov.title')}</h2>
            <p className="lp-pov-body">{t('landing.pov.body')}</p>
          </div>
          <dl className="lp-pov-facts">
            {povFacts.map((f) => (
              <div key={f.title} className="lp-pov-fact">
                <dt>{f.title}</dt>
                <dd>{f.desc}</dd>
              </div>
            ))}
          </dl>
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
