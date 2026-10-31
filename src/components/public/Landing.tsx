/**
 * 未登录落地页 · v3『石墨信号』（现代 SaaS）
 *
 * 结构：hero（左 6 栏文案 + 右 5 栏真实产品截图白卡）→ 功能 3–4 列白卡 → 深色段（唯一断口）
 *       → FAQ → 收尾 → 联系方式 → 页脚（保留 SupportLink 与「一个人维护 · 免费 · 关于与支持」）。
 *
 * 与 v2 的差别只在结构与文案层级：无衬线、无编号列表式功能区、无米色整页；
 * 截图是白卡 + shadow-3 + 10 圆角（TOKENS-v3 §5 / 03-ui-research-v2 §F8）。
 * 营销页刻意固定浅色（`--lp-*`），不随 data-theme 联动；本文件只写结构，不自造颜色。
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AppstoreOutlined,
  BarChartOutlined,
  MessageOutlined,
  MobileOutlined,
} from '@ant-design/icons'
import { useI18n } from '@/i18n'
import { useAppStore } from '@/store/appStore'
import { SITE } from '@/config/site'
import SupportLink from '@/components/reward/SupportLink'

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

/** 视口宽度（落地页不引 antd 布局组件，用 matchMedia 判断断点） */
function useWide(minWidth = 900): boolean {
  const [wide, setWide] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia(`(min-width:${minWidth}px)`).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(`(min-width:${minWidth}px)`)
    const onChange = () => setWide(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [minWidth])
  return wide
}

/* 滚动到视口时一次性淡入。observer 不可用时不加 lp-anim —— 内容永远可见。 */
function useRevealRoot() {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const root = ref.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    root.classList.add('lp-anim')
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    root.querySelectorAll('.lp-reveal').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  return ref
}

/** 真实界面截图装进白卡（window chrome 三点 + 图注），shadow-3 / 10 圆角由 CSS 负责 */
function ProductShot() {
  const t = useI18n()
  return (
    <figure className="lp-shot-plate lp-reveal" style={{ margin: 0 }}>
      <div className="lp-shot">
        <div className="lp-shot-bar" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="lp-shot-scroll">
          <img src="/hero-table.png" alt={t('landing.shot.alt')} loading="eager" decoding="async" />
        </div>
        <figcaption className="lp-shot-cap">{t('landing.shot.caption')}</figcaption>
      </div>
    </figure>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const t = useI18n()
  const lang = useAppStore((s) => s.settings.language ?? 'zh')
  const setLanguage = useAppStore((s) => s.setLanguage)
  const [copiedEmail, setCopiedEmail] = useState('')
  const rootRef = useRevealRoot()
  const wide = useWide()

  const goRegister = () => navigate('/login?mode=register')
  const goLogin = () => navigate('/login')

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
  const navLinks = [
    ['features', t('landing.nav.features')],
    ['privacy', t('landing.nav.privacy')],
    ['faq', t('landing.nav.faq')],
    ['contact', t('landing.nav.contact')],
    ['help', t('landing.nav.help')],
  ] as const

  return (
    <div className="lp-page" ref={rootRef}>
      <header className="lp-header">
        <div className="lp-container lp-header-row">
          <button className="lp-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span className="lp-brand-dot" aria-hidden />
            {SITE.brand}
          </button>
          <nav className="lp-nav">
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
          <button className="lp-lang" onClick={() => setLanguage(lang === 'zh' ? 'en' : 'zh')}>
            {lang === 'zh' ? 'EN' : '中'}
          </button>
          <button className="lp-btn lp-btn-primary lp-btn-sm" onClick={goRegister}>
            {t('landing.nav.login')}
          </button>
        </div>
      </header>

      {/* ===== Hero：左 6 栏文案 + 右 5 栏产品截图（12 栅格） ===== */}
      <div className="lp-hero-band">
        <section className="lp-container lp-hero">
          <div className="lp-hero-copy">
            <span className="lp-kicker">{t('landing.kicker')}</span>
            <h1 className="lp-h1">
              {t('landing.hero.title1')}
              {wide ? null : ' '}
              {t('landing.hero.title2')}
            </h1>
            <p className="lp-hero-sub">{t('landing.hero.sub')}</p>
            <div className="lp-cta-row">
              <button className="lp-btn lp-btn-primary" onClick={goRegister}>
                {t('landing.hero.cta')}
              </button>
              <a className="lp-btn lp-btn-ghost" href="/app/infodesk.apk" download="信息管理.apk">
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

      <main style={{ display: 'block' }}>
        {/* ===== 功能：白卡 3–4 列（用户认知里的「正常产品页」） ===== */}
        <section id="features" className="lp-sect">
          <div className="lp-container">
            <div className="lp-reveal">
              <h2 className="lp-h2">{t('landing.features.title')}</h2>
              <p className="lp-lede">{t('landing.features.sub')}</p>
            </div>
            <div
              className="lp-feature-grid"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
            >
              {features.map((f) => (
                <div key={f.title} className="lp-feat lp-reveal">
                  <span className="lp-feat-icon" aria-hidden>
                    {f.icon}
                  </span>
                  <div className="lp-feat-title">{f.title}</div>
                  <div className="lp-feat-desc">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== 深色段：全页唯一断口（数据在你设备里） ===== */}
        <section id="privacy" className="lp-deep">
          <div className="lp-container">
            <div className="lp-reveal">
              <div className="lp-deep-eyebrow">{t('landing.pov.eyebrow')}</div>
              <h2 className="lp-deep-title">{t('landing.pov.title')}</h2>
              <p className="lp-deep-body">{t('landing.pov.body')}</p>
            </div>
            {povFacts.map((f, i) => (
              <div key={f.title} className="lp-pov-fact lp-reveal">
                <span className="lp-num lp-num-light">{String(i + 1).padStart(2, '0')}</span>
                <span className="lp-pov-dt">{f.title}</span>
                <span className="lp-pov-dd">{f.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section id="faq" className="lp-sect">
          <div className="lp-container lp-faq">
            <h2 className="lp-h2">{t('landing.faq.title')}</h2>
            {faqs.map(([q, a], i) => (
              <div key={q} className="lp-faq-item lp-reveal">
                <span className="lp-num">{`Q${i + 1}`}</span>
                <div>
                  <div className="lp-faq-q">{q}</div>
                  <p className="lp-faq-a">{a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== 收尾 ===== */}
        <section className="lp-sect lp-close">
          <div className="lp-container lp-reveal">
            <h2 className="lp-h2 lp-close-title">{t('landing.dark.title')}</h2>
            <p className="lp-lede lp-close-sub">{t('landing.dark.sub')}</p>
            <button className="lp-btn lp-btn-primary" onClick={goLogin}>
              {t('landing.dark.cta')}
            </button>
            <div className="lp-close-trust">{t('landing.hero.trust')}</div>
          </div>
        </section>

        {/* ===== 联系方式 ===== */}
        <section id="contact" className="lp-sect lp-contact">
          <div className="lp-container lp-contact-grid lp-reveal">
            <div>
              <h2 className="lp-contact-title">{t('landing.contact.title')}</h2>
              <p className="lp-lede">{t('landing.contact.note')}</p>
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
              <button className="lp-link" onClick={goLogin}>
                {t('landing.contact.hasAccount')}
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-row">
          <span>
            © {new Date().getFullYear()} {SITE.brand} · aiim.de5.net
          </span>
          <span>{t('landing.footer.isolation')}</span>
        </div>
        <div className="lp-container lp-footer-row" style={{ marginTop: 8 }}>
          <span>
            {t('landing.footer.onePerson')} · {t('landing.footer.free')} ·{' '}
            <SupportLink style={{ color: 'var(--lp-ink-muted)', fontSize: 'inherit' }} />
          </span>
        </div>
      </footer>
    </div>
  )
}
