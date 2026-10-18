/**
 * 落地页大改版（2026-10）· design brief（design-anti-slop pre-gen short path）
 *
 * 用户指令：界面看起来一眼 AI 写的，参考优质项目大改，不留情面。
 * 调研锚点（2026-10 实抓两站的正文结构与排版信号）：
 *   · linear.app —— 真实产品 UI 当主角；`Fig 0.x` 式等宽字体注释；每个功能段
 *     只有一句话；全页仅一种强调色；深色段做唯一的节奏断口。
 *   · flomoapp.com —— 中文产品的「高级」来自坦诚文案（「我们不擅长…」「不贩卖
 *     隐私数据」）+ 大留白 + 无特效的诚实收尾。
 *
 * Brief 五轴（用户已预先授权跳过访谈，按项目既有立场默认）：
 *   Typography: 中文走系统黑体链（DESIGN.md 红线：中文禁网络字体），但量级提到
 *     clamp(38–72px)、字重 600、字距 -0.02em；拉丁/数字/眉题统一等宽字体
 *     （系统 mono 栈）；正文 16px/1.8。
 *   Color: 青瓷青不变（#0D9488/#0F766E/#134E4A 唯一彩相）；底色换成瓷纸
 *     #FAFAF8；hero 段铺青瓷粉底 #F0FDFA；新增唯一中性族=瓷纸/瓷线 #E6E5E0/
 *     旧窗 chrome #F4F3EE（已补进 DESIGN.md frontmatter）。
 *   Avoid: antd 组件与 antd 图标全部退出落地页（antd = 中文后台模板指纹）；
 *     居中等节奏段落；渐变/发光/毛玻璃（DESIGN.md Don'ts）。
 *   Claim: 文案主线不动（说话即操作 / 数据在你设备里 全部沿用已定 i18n），
 *     只重排版与层级。
 *   Asset: hero-table.png 真实截图保留，外面套「瓷器托座」——发丝线窗口框 +
 *     #134E4A 深青纯色底衬（无阴影无渐变的深度）。
 *
 * 营销页刻意走瓷纸浅色定值，不随 data-theme 暗色联动（与旧版行为一致）。
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { useAppStore } from '@/store/appStore'
import { SITE } from '@/config/site'

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

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
 * 真实界面截图（public/hero-table.png）压进一个「展柜」：
 * 发丝线窗口框 + 等宽字体图注（取名致敬 linear.app 的 Fig 0.x），
 * 后面垫一块 #134E4A 深青纯色托座。（C4：示意必须换真实产品画面——
 * 这里是运行中的应用直接截图，示例数据，点任意格可改。）
 */
function ProductShot() {
  const t = useI18n()
  return (
    <figure className="lp-shot-plate lp-reveal" style={{ margin: 0 }}>
      <div className="lp-shot">
        {/* 窄屏不缩图：7 列表格缩到 390px 宽会糊成一片灰。保持可读的最小
            宽度，横向滑动查看 —— 手机上表格本来就宽，滑动符合直觉。 */}
        <div className="lp-shot-bar" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="lp-shot-scroll">
          <img
            src="/hero-table.png"
            alt={t('landing.shot.alt')}
            loading="eager"
            decoding="async"
            style={{ display: 'block' }}
          />
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
      {/* ===== 导航：瓷底 + 发丝线，sticky。中文不做 min-width 压缩 ===== */}
      <header className="lp-header">
        <div className="lp-container lp-header-row">
          <button className="lp-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <i className="lp-brand-dot" />
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

      {/* ===== Hero：釉底带 ===== */}
      <div className="lp-hero-band">
        <section className="lp-container lp-hero">
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
        </section>
        <section className="lp-container">
          <ProductShot />
        </section>
      </div>

      <main style={{ display: 'block' }}>
        {/* ===== 功能 → 编号编辑部列表（linear.app 的 Fig 式排版） ===== */}
        <section id="features" className="lp-sect">
          <div className="lp-container">
            <div className="lp-reveal">
              <h2 className="lp-h2">{t('landing.features.title')}</h2>
              <p className="lp-lede">{t('landing.features.sub')}</p>
            </div>
            {features.map((f, i) => (
              <div key={f.title} className="lp-feat lp-reveal">
                <span className="lp-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="lp-feat-title">{f.title}</span>
                <span className="lp-feat-desc">{f.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ===== 立场段 = 全页唯一节奏断口：深窑青整幅 =====
            数据不在我们服务器上 —— 产品已做到、竞品抄不走的事实，
            值得全页最重的排版。 */}
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

        {/* ===== FAQ：左对齐，编号问句 ===== */}
        <section id="faq" className="lp-sect">
          <div className="lp-container lp-faq">
            <h2 className="lp-h2">{t('landing.faq.title')}</h2>
            {faqs.map(([q, a], i) => (
              <div key={q} className="lp-faq-item lp-reveal">
                <span className="lp-num">Q{i + 1}</span>
                <div>
                  <div className="lp-faq-q">{q}</div>
                  <p className="lp-faq-a">{a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== 收尾：不再用深色圆角盒子，一段大字 + 一个按钮 ===== */}
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
      </footer>
    </div>
  )
}
