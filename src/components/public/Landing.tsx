/**
 * 未登录落地页 ·『官纸账簿 The Ledger』
 *
 * 比上一版再推进一步：从「编辑排版风」到「账页风」。
 *   · hero 改 12 列非对称：标题占 7 列、左对齐；右侧放真实界面截图 + 等宽图注
 *   · 删除 hero 的整幅平涂带与居中排版（模板味的最大来源）
 *   · 展柜去掉窗口三点 chrome，只留 1px 发丝框 + mono 图注
 *   · 页脚补一行「一个人维护 · 永久免费 · 关于与支持」纯文字（不出现赞赏/二维码）
 *
 * 注意：营销页刻意走「瓷纸浅色」定值，不跟随 data-theme 暗色联动（与旧版一致），
 * 颜色由 LP 专用 CSS 负责，本文件只做结构与文案，不自造颜色。
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { useAppStore } from '@/store/appStore'
import { SITE } from '@/config/site'
import SealMark from '@/components/public/SealMark'
import SupportLink from '@/components/reward/SupportLink'

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

/** 视口宽度判断（落地页不引 antd，用 matchMedia 自己判断断点） */
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

/* 滚动到视口时一次性淡入。observer 不可用时不加 lp-anim，
   此时 .lp-reveal 没有隐藏样式 —— 内容永远可见，动效只是增强。 */
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

/**
 * 真实界面截图压进「展柜」：一条 1px 发丝框 + 等宽图注，没有窗口圆点、没有投影。
 * 窄屏不缩图（7 列表格缩到 390px 会糊成一片灰），保持可读最小宽度后横向滑动。
 */
function ProductShot({ wide }: { wide: boolean }) {
  const t = useI18n()
  return (
    <figure className="lp-shot-plate lp-reveal" style={{ margin: 0 }}>
      <div className="lp-shot">
        <div className="lp-shot-scroll">
          <img
            src="/hero-table.png"
            alt={t('landing.shot.alt')}
            loading="eager"
            decoding="async"
            style={{ display: 'block', maxWidth: wide ? '100%' : 'none' }}
          />
        </div>
        <figcaption className="lp-shot-cap mono">{t('landing.shot.caption')}</figcaption>
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

  // 新访客没有账号，主按钮直接把他送到「注册」页签，省一次点击
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

  return (
    <div className="lp-page" ref={rootRef}>
      {/* ===== 导航：瓷纸底 + 发丝线，sticky ===== */}
      <header className="lp-header">
        <div className="lp-container lp-header-row">
          <button className="lp-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <SealMark size={14} />
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

      {/* ===== Hero：12 列非对称，标题 7 列左对齐，右侧账页展柜 ===== */}
      <section className="lp-container lp-hero">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: wide ? 'repeat(12, minmax(0, 1fr))' : '1fr',
            gap: 32,
            alignItems: 'end',
          }}
        >
          <div style={{ gridColumn: wide ? '1 / span 7' : undefined }}>
            <h1 className="lp-h1">
              {t('landing.hero.title1')}
              <br />
              {t('landing.hero.title2')}
            </h1>
            <p className="lp-hero-sub">{t('landing.hero.sub')}</p>
            <div className="lp-cta-row">
              <button className="lp-btn lp-btn-primary" onClick={goRegister}>
                {t('landing.hero.cta')}
              </button>
              {/* 下载是真实动作：次级按钮 */}
              <a className="lp-btn lp-btn-ghost" href="/app/infodesk.apk" download="信息管理.apk">
                {t('landing.hero.downloadApk')}
              </a>
            </div>
          </div>
          <div style={{ gridColumn: wide ? '9 / span 4' : undefined }}>
            <ProductShot wide={wide} />
          </div>
        </div>
      </section>

      <main style={{ display: 'block' }}>
        {/* ===== 功能 → 编号列表 ===== */}
        <section id="features" className="lp-sect">
          <div className="lp-container">
            <div className="lp-reveal">
              <h2 className="lp-h2">{t('landing.features.title')}</h2>
              <p className="lp-lede">{t('landing.features.sub')}</p>
            </div>
            {features.map((f, i) => (
              <div key={f.title} className="lp-feat lp-reveal">
                <span className="lp-num mono">{String(i + 1).padStart(2, '0')}</span>
                <span className="lp-feat-title">{f.title}</span>
                <span className="lp-feat-desc">{f.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ===== 立场段 = 全页唯一节奏断口（墨底） =====
            数据不在我们服务器上 —— 产品已做到、竞品抄不走的事实，
            值得全页最重的排版。 */}
        <section id="privacy" className="lp-deep">
          <div className="lp-container">
            <div className="lp-reveal">
              <div className="lp-deep-eyebrow eyebrow">{t('landing.pov.eyebrow')}</div>
              <h2 className="lp-deep-title">{t('landing.pov.title')}</h2>
              <p className="lp-deep-body">{t('landing.pov.body')}</p>
            </div>
            {povFacts.map((f, i) => (
              <div key={f.title} className="lp-pov-fact lp-reveal">
                <span className="lp-num lp-num-light mono">{String(i + 1).padStart(2, '0')}</span>
                <span className="lp-pov-dt">{f.title}</span>
                <span className="lp-pov-dd">{f.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ===== FAQ：左对齐，编号问句 ===== */}
        <section id="faq" className="lp-sect">
          <div className="lp-container lp-faq">
            <h2 className="lp-h2">{t('landing.faq.title')}</h2>
            {faqs.map(([q, a], i) => (
              <div key={q} className="lp-faq-item lp-reveal">
                <span className="lp-num mono">{`Q${i + 1}`}</span>
                <div>
                  <div className="lp-faq-q">{q}</div>
                  <p className="lp-faq-a">{a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== 收尾：一段大字 + 一个按钮 ===== */}
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

        {/* ===== 联系方式（邮箱）+ 页脚 ===== */}
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
        {/* 一行收尾：一个人维护 · 永久免费 · 关于与支持（纯文字，不出现赞赏/二维码/支付词） */}
        <div className="lp-container lp-footer-row" style={{ marginTop: 8 }}>
          <span>
            {t('landing.footer.onePerson')} · {t('landing.footer.free')} · <SupportLink style={{ color: 'inherit', fontSize: 'inherit' }} />
          </span>
        </div>
      </footer>
    </div>
  )
}
