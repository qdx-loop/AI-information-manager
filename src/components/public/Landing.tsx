/**
 * 未登录落地页 · v4「硬边印刷 SIGNAL PRESS」
 *
 * 版面即海报（契约 §8.7）：
 *   lp-nav（lime 方块 brand + mono nav + EN + lime 注册按钮）
 *   → hero 12 列（左 7：kicker / lp-display 巨型 Outfit 800，关键词 `<em>` lime 底块 /
 *     lp-lede / 双 CTA / mono 小注；右 5：硬边截图框 + 三点 + 图注）
 *   → lime marquee（两条轨道同内容，-50% 平移无缝）
 *   → 编号功能行（不用卡片网格）
 *   → 墨黑数据主权段（唯一深色断口）
 *   → FAQ（编号 + 2px 上边）
 *   → 收尾大标题 + lime CTA
 *   → 联系方式
 *   → 墨黑页脚：巨大 lime wordmark + 「一个人维护 · 永久免费 · 关于与支持」
 *
 * 营销页固定浅色纸面（--paper），不跟随 data-theme；本文件只写结构，不自造颜色。
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { useAppStore } from '@/store/appStore'
import { SITE } from '@/config/site'
import SupportLink from '@/components/reward/SupportLink'

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

/** 真实界面截图：硬边框 + 墨黑三点栏 + mono 图注；窄屏保持可读最小宽并横向滚动 */
function ProductShot() {
  const t = useI18n()
  return (
    <div className="lp-shot">
      <div className="lp-shot-bar" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="lp-shot-scroll">
        <img src="/hero-table.png" alt={t('landing.shot.alt')} loading="eager" decoding="async" />
      </div>
      <div className="lp-shot-cap">{t('landing.shot.caption')}</div>
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const t = useI18n()
  const lang = useAppStore((s) => s.settings.language ?? 'zh')
  const setLanguage = useAppStore((s) => s.setLanguage)
  const [copiedEmail, setCopiedEmail] = useState('')

  const goRegister = () => navigate('/login?mode=register')
  const goLogin = () => navigate('/login')

  const features = [
    { title: t('landing.f1t'), desc: t('landing.f1d') },
    { title: t('landing.f2t'), desc: t('landing.f2d') },
    { title: t('landing.f3t'), desc: t('landing.f3d') },
    { title: t('landing.f4t'), desc: t('landing.f4d') },
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
  const navLinks = [
    ['features', t('landing.nav.features')],
    ['privacy', t('landing.nav.privacy')],
    ['faq', t('landing.nav.faq')],
    ['contact', t('landing.nav.contact')],
    ['help', t('landing.nav.help')],
  ] as const
  const marqueeItems = [
    t('landing.marquee.local'),
    t('landing.marquee.ai'),
    t('landing.marquee.free'),
    t('landing.marquee.data'),
  ]

  return (
    <div className="lp-page">
      <header className="lp-nav">
        <div className="lp-container lp-nav-row">
          <button className="lp-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span className="lp-brand-mark" aria-hidden />
            {SITE.brand}
          </button>
          <nav className="lp-nav-links">
            {navLinks.map(([id, label]) => (
              <button
                key={id}
                className="lp-nav-link"
                onClick={() => (id === 'help' ? navigate('/help') : scrollTo(id))}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="lp-nav-actions">
            <button className="lp-lang" onClick={() => setLanguage(lang === 'zh' ? 'en' : 'zh')}>
              {lang === 'zh' ? 'EN' : '中'}
            </button>
            <button className="lp-btn lp-btn--primary lp-btn--sm" onClick={goRegister}>
              {t('landing.nav.login')}
            </button>
          </div>
        </div>
      </header>

      {/* ===== Hero：左 7 栏排版 + 右 5 栏产品截图 ===== */}
      <div className="lp-container">
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <div className="lp-kicker">{t('landing.kicker')}</div>
            {/* 固定两层 + lime 短语 nowrap：中文巨字绝不会把高亮断成单字块 */}
            <h1
              className="lp-display"
              style={{
                fontSize: 'clamp(40px, 5.2vw, 72px)',
                wordBreak: 'keep-all',
                overflowWrap: 'normal',
              }}
            >
              <span style={{ display: 'block', whiteSpace: 'nowrap' }}>{t('landing.hero.h1a')}</span>
              <span style={{ display: 'block' }}>
                <em style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>{t('landing.hero.h1em')}</em>
                <span>{t('landing.hero.h1b')}</span>
              </span>
            </h1>
            <p className="lp-lede">{t('landing.hero.sub')}</p>
            <div className="lp-cta-row">
              <button className="lp-btn lp-btn--primary" onClick={goRegister}>
                {t('landing.hero.cta')}
              </button>
              <a className="lp-btn" href="/app/infodesk.apk" download="信息管理.apk">
                {t('landing.hero.downloadApk')}
              </a>
            </div>
            <div className="lp-hero-note">{t('landing.hero.trust')}</div>
          </div>
          <div className="lp-hero-visual">
            <ProductShot />
          </div>
        </section>
      </div>

      {/* ===== lime marquee：两条同内容轨道，平移 -50% 无缝 ===== */}
      <div className="lp-marquee" aria-hidden="true">
        <div className="lp-marquee-track">
          {[...marqueeItems, ...marqueeItems].map((item, i) => (
            <span key={i}>{item}</span>
          ))}
        </div>
      </div>

      <main>
        {/* ===== 功能：编号行排版（不用卡片网格） ===== */}
        <section id="features" className="lp-section">
          <div className="lp-container">
            <div className="lp-section-head">
              <span className="lp-index">01</span>
              <h2 className="lp-h2">{t('landing.features.title')}</h2>
              <p className="lp-lede-sm">{t('landing.features.sub')}</p>
            </div>
            {features.map((f, i) => (
              <div key={f.title} className="lp-feature-row">
                <span className="lp-index">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="lp-feature-title">{f.title}</h3>
                <p className="lp-feature-body">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ===== 墨黑数据主权段（全页唯一深色断口） ===== */}
        <section id="privacy" className="lp-deep">
          <div className="lp-container">
            <div className="lp-section-head">
              <span className="lp-index">02</span>
              <div>
                <div className="lp-kicker">{t('landing.pov.eyebrow')}</div>
                <h2 className="lp-h2">{t('landing.pov.title')}</h2>
              </div>
              <p className="lp-lede-sm">{t('landing.pov.body')}</p>
            </div>
            {povFacts.map((f, i) => (
              <div key={f.title} className="lp-deep-row">
                <span className="lp-deep-index">{String(i + 1).padStart(2, '0')}</span>
                <span className="lp-deep-title">{f.title}</span>
                <p className="lp-deep-body">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section id="faq" className="lp-section">
          <div className="lp-container">
            <div className="lp-faq">
              <div className="lp-section-head">
                <span className="lp-index">03</span>
                <h2 className="lp-h2">{t('landing.faq.title')}</h2>
                <p className="lp-lede-sm">{t('landing.faq.sub')}</p>
              </div>
              {faqs.map(([q, a], i) => (
                <div key={q} className="lp-faq-item">
                  <span className="lp-index">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="lp-faq-q">{q}</h3>
                    <p className="lp-faq-a">{a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== 收尾：大标题 + lime CTA ===== */}
        <section className="lp-section">
          <div className="lp-container">
            <div className="lp-close">
              <div>
                <h2 className="lp-close-title">{t('landing.dark.title')}</h2>
                <p className="lp-close-sub">{t('landing.dark.sub')}</p>
              </div>
              <button className="lp-btn lp-btn--primary" onClick={goRegister}>
                {t('landing.dark.cta')}
              </button>
            </div>
          </div>
        </section>

        {/* ===== 联系方式 ===== */}
        <section id="contact" className="lp-contact">
          <div className="lp-container">
            <div className="lp-contact-grid">
              <div>
                <h2 className="lp-contact-title">{t('landing.contact.title')}</h2>
                <p className="lp-lede-sm">{t('landing.contact.note')}</p>
              </div>
              <div>
                <div className="lp-chip-row">
                  {SITE.contactEmails.map((email) => (
                    <button
                      key={email}
                      className="lp-chip"
                      onClick={() => {
                        navigator.clipboard.writeText(email)
                        setCopiedEmail(email)
                      }}
                    >
                      {email}
                      {copiedEmail === email ? ` · ${t('common.copied')}` : ` · ${t('landing.contact.copyHint')}`}
                    </button>
                  ))}
                </div>
                <p style={{ margin: '12px 0 0' }}>
                  <button className="lp-link" onClick={goLogin}>
                    {t('landing.contact.hasAccount')}
                  </button>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ===== 墨黑页脚：巨大 lime wordmark + 责任行 ===== */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-wordmark">{SITE.brand}</div>
          <div className="lp-footer-row">
            <span>
              {t('landing.footer.onePerson')} · {t('landing.footer.free')} ·{' '}
              <SupportLink style={{ color: 'inherit' }} />
            </span>
            <span>{t('landing.footer.isolation')}</span>
          </div>
          <div className="lp-footer-row" style={{ marginTop: 8 }}>
            <span>
              © {new Date().getFullYear()} {SITE.brand} · aiim.de5.net
            </span>
            <span>{SITE.contactEmails[0]}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
