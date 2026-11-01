/**
 * 未登录落地页 · v9「WINDOWS 11 STORE / WELCOME」
 *
 * 视觉合同（`redesign-brief/11-v9-win11-desktop.md` §8 落地页）：
 *   桌面壁纸 + Win11 无边框窗口（Acrylic 标题栏 = 应用标识 + 语言/主题/登录/注册）；
 *   内容按「商店详情页」组织：应用图标 + 名称 + 一句话价值 + 主 CTA →
 *   真实界面截图（固定 /hero-table.png，由 Lead 替换）→ 3 张 Win11 设置卡 →
 *   「数据归你」设置行 → FAQ Win11 Expander → 收尾 CTA 卡 → 联系设置行 → 低调页脚。
 *
 * 明确不做（brief §2 反模式）：营销大渐变 / 巨幅英文标语 / 霓虹 / 大圆角卡片墙 /
 * 英文 kicker / 装饰性编号。链接与文案尽量复用既有 i18n key。
 */
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownloadRegular,
  ArrowRightRegular,
  ChartMultipleRegular,
  CheckmarkCircleRegular,
  ChatRegular,
  ChevronDownRegular,
  ChevronRightRegular,
  CloudSyncRegular,
  CopyRegular,
  GridRegular,
  KeyRegular,
  MailRegular,
  QuestionCircleRegular,
  ShieldCheckmarkRegular,
  WeatherMoonRegular,
  WeatherSunnyRegular,
  WifiOffRegular,
  type FluentIcon,
} from '@fluentui/react-icons'
import { useI18n } from '@/i18n'
import { useAppStore } from '@/store/appStore'
import { SITE } from '@/config/site'
import AppIcon from '@/components/common/AppIcon'
import SupportLink from '@/components/reward/SupportLink'

export default function Landing() {
  const navigate = useNavigate()
  const t = useI18n()
  const lang = useAppStore((s) => s.settings.language ?? 'zh')
  const setLanguage = useAppStore((s) => s.setLanguage)
  const theme = useAppStore((s) => s.settings.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const [copiedEmail, setCopiedEmail] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const goRegister = () => navigate('/login?mode=register')
  const goLogin = () => navigate('/login')
  const isDark = theme === 'dark'
  const year = new Date().getFullYear()

  const features: { icon: FluentIcon; title: string; desc: string }[] = [
    { icon: ChatRegular, title: t('landing.f1t'), desc: t('landing.f1d') },
    { icon: GridRegular, title: t('landing.f2t'), desc: t('landing.f2d') },
    { icon: ChartMultipleRegular, title: t('landing.f3t'), desc: t('landing.f3d') },
  ]
  const ownership: { icon: FluentIcon; title: string; desc: string }[] = [
    { icon: WifiOffRegular, title: t('landing.pov.f1t'), desc: t('landing.pov.f1d') },
    { icon: CloudSyncRegular, title: t('landing.pov.f2t'), desc: t('landing.pov.f2d') },
    { icon: ShieldCheckmarkRegular, title: t('landing.pov.f3t'), desc: t('landing.pov.f3d') },
  ]
  const faqs: [string, string][] = [
    [t('landing.faq.q1'), t('landing.faq.a1')],
    [t('landing.faq.q2'), t('landing.faq.a2')],
    [t('landing.faq.q3'), t('landing.faq.a3')],
  ]

  const copyEmail = (email: string) => {
    void navigator.clipboard?.writeText(email).catch(() => {})
    setCopiedEmail(email)
  }

  return (
    <div className="pub-stage">
      <div className="pub-frame">
        {/* Win11 标题栏：应用标识 + 语言 / 主题 / 登录 / 注册 */}
        <header className="w-titlebar">
          <button
            type="button"
            className="w-titlebar-brand"
            onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label={t('app.brand')}
          >
            <AppIcon size={16} />
            <span className="w-titlebar-title">{t('app.brand')}</span>
          </button>
          <div className="w-titlebar-drag" />
          <div className="w-titlebar-tools">
            <button
              type="button"
              className="w-titlebar-tool"
              aria-label={isDark ? t('app.theme.light') : t('app.theme.dark')}
              title={isDark ? t('app.theme.light') : t('app.theme.dark')}
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
            >
              {isDark ? <WeatherSunnyRegular fontSize={15} /> : <WeatherMoonRegular fontSize={15} />}
            </button>
            <button
              type="button"
              className="w-titlebar-tool w-titlebar-tool--text"
              aria-label={t('app.language')}
              title={t('app.language')}
              onClick={() => setLanguage(lang === 'zh' ? 'en' : 'zh')}
            >
              {lang === 'zh' ? 'EN' : '中'}
            </button>
            <span className="w-sep--v" aria-hidden />
            <button type="button" className="w-btn w-btn--subtle w-btn--sm" onClick={goLogin}>
              {t('auth.tab.login')}
            </button>
            <button type="button" className="w-btn w-btn--accent w-btn--sm" onClick={goRegister}>
              {t('landing.nav.login')}
            </button>
          </div>
        </header>

        <div className="pub-frame-body">
          <div className="pub-scroll" ref={scrollRef}>
            <div className="w-page pub-landing">
              {/* Hero：应用标识 + 一句话价值 + 主 CTA + 真实截图 */}
              <section className="pub-app-hero">
                <div className="pub-app-hero-copy">
                  <div className="pub-app-identity">
                    <AppIcon size={64} />
                    <div className="pub-app-identity-main">
                      <h1 className="pub-app-name">{t('app.brand')}</h1>
                      <div className="pub-app-tags">
                        <span className="w-tag w-tag--accent">{t('landing.marquee.local')}</span>
                        <span className="w-tag">{t('landing.marquee.free')}</span>
                      </div>
                    </div>
                  </div>
                  <p className="pub-app-value">{t('landing.hero.sub')}</p>
                  <div className="w-actions">
                    <button type="button" className="w-btn w-btn--accent w-btn--lg" onClick={goRegister}>
                      {t('landing.dark.cta')}
                      <ArrowRightRegular fontSize={16} aria-hidden />
                    </button>
                    <button type="button" className="w-btn w-btn--lg" onClick={goLogin}>
                      {t('auth.tab.login')}
                    </button>
                  </div>
                  <div className="pub-app-meta">
                    <span>{t('landing.hero.trust')}</span>
                    <a className="pub-link pub-app-apk" href="/app/infodesk.apk" download="信息管理.apk">
                      <ArrowDownloadRegular fontSize={14} aria-hidden />
                      {t('landing.hero.downloadApk')}
                    </a>
                  </div>
                </div>
                <figure className="pub-shot">
                  <div className="pub-shot-frame">
                    <img src="/hero-table.png" alt={t('landing.shot.alt')} loading="eager" decoding="async" />
                  </div>
                  <figcaption className="pub-shot-cap">{t('landing.shot.caption')}</figcaption>
                </figure>
              </section>

              {/* 功能：3 张 Win11 设置卡 */}
              <section id="features" className="pub-section" aria-labelledby="pub-features-title">
                <header className="pub-section-head">
                  <h2 id="pub-features-title" className="pub-section-title">
                    {t('landing.features.title')}
                  </h2>
                  <p className="pub-section-desc">{t('landing.features.sub')}</p>
                </header>
                <div className="pub-feat-grid">
                  {features.map((f) => {
                    const Icon = f.icon
                    return (
                      <article key={f.title} className="w-card pub-feat">
                        <span className="w-row-icon" aria-hidden>
                          <Icon fontSize={18} />
                        </span>
                        <h3 className="pub-feat-title">{f.title}</h3>
                        <p className="pub-feat-desc">{f.desc}</p>
                      </article>
                    )
                  })}
                </div>
              </section>

              {/* 数据归你：设置行式说明 */}
              <section id="privacy" className="pub-section" aria-labelledby="pub-own-title">
                <div className="w-card pub-own">
                  <div className="pub-own-head">
                    <span className="pub-own-mark" aria-hidden>
                      <ShieldCheckmarkRegular fontSize={22} />
                    </span>
                    <div className="w-head-main">
                      <h2 id="pub-own-title" className="pub-section-title">
                        {t('landing.pov.title')}
                      </h2>
                      <p className="pub-section-desc">{t('landing.pov.body')}</p>
                    </div>
                  </div>
                  <div className="w-rows">
                    {ownership.map((row) => {
                      const Icon = row.icon
                      return (
                        <div key={row.title} className="w-row">
                          <span className="w-row-icon w-row-icon--neutral" aria-hidden>
                            <Icon fontSize={16} />
                          </span>
                          <span className="w-row-main">
                            <span className="w-row-title">{row.title}</span>
                            <span className="w-row-desc">{row.desc}</span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>

              {/* FAQ：Win11 Expander */}
              <section id="faq" className="pub-section" aria-labelledby="pub-faq-title">
                <header className="pub-section-head">
                  <h2 id="pub-faq-title" className="pub-section-title">
                    {t('landing.faq.title')}
                  </h2>
                </header>
                <div className="w-card pub-faq">
                  {faqs.map(([q, a]) => (
                    <details key={q} className="pub-expander">
                      <summary className="pub-expander-head">
                        <span className="pub-expander-title">{q}</span>
                        <ChevronDownRegular fontSize={16} className="pub-expander-chev" aria-hidden />
                      </summary>
                      <div className="pub-expander-body">{a}</div>
                    </details>
                  ))}
                </div>
              </section>

              {/* 收尾 CTA 卡 */}
              <section className="pub-section">
                <div className="w-card pub-cta">
                  <div className="w-head-main">
                    <h2 className="pub-section-title">{t('landing.dark.title')}</h2>
                    <p className="pub-section-desc">{t('landing.dark.sub')}</p>
                  </div>
                  <button type="button" className="w-btn w-btn--accent w-btn--lg" onClick={goRegister}>
                    {t('landing.dark.cta')}
                  </button>
                </div>
              </section>

              {/* 联系我们：邮箱复制 / 登录 / 帮助中心 */}
              <section id="contact" className="pub-section" aria-labelledby="pub-contact-title">
                <header className="pub-section-head">
                  <h2 id="pub-contact-title" className="pub-section-title">
                    {t('landing.contact.title')}
                  </h2>
                  <p className="pub-section-desc">{t('landing.contact.note')}</p>
                </header>
                <div className="w-card pub-contact">
                  {SITE.contactEmails.map((email) => (
                    <button
                      key={email}
                      type="button"
                      className="w-row w-row--button"
                      onClick={() => copyEmail(email)}
                      aria-label={`${email} · ${t('landing.contact.copyHint')}`}
                    >
                      <span className="w-row-icon w-row-icon--neutral" aria-hidden>
                        <MailRegular fontSize={16} />
                      </span>
                      <span className="w-row-main">
                        <span className="w-row-title">{email}</span>
                        <span className="w-row-desc">
                          {copiedEmail === email ? t('common.copied') : t('landing.contact.copyHint')}
                        </span>
                      </span>
                      <span className="w-row-control" aria-hidden>
                        {copiedEmail === email ? (
                          <CheckmarkCircleRegular fontSize={16} />
                        ) : (
                          <CopyRegular fontSize={16} />
                        )}
                      </span>
                    </button>
                  ))}
                  <button type="button" className="w-row w-row--button" onClick={goLogin}>
                    <span className="w-row-icon w-row-icon--neutral" aria-hidden>
                      <KeyRegular fontSize={16} />
                    </span>
                    <span className="w-row-main">
                      <span className="w-row-title">{t('landing.contact.hasAccount')}</span>
                    </span>
                    <ChevronRightRegular fontSize={14} className="w-row-chevron" aria-hidden />
                  </button>
                  <button type="button" className="w-row w-row--button" onClick={() => navigate('/help')}>
                    <span className="w-row-icon w-row-icon--neutral" aria-hidden>
                      <QuestionCircleRegular fontSize={16} />
                    </span>
                    <span className="w-row-main">
                      <span className="w-row-title">{t('landing.nav.help')}</span>
                    </span>
                    <ChevronRightRegular fontSize={14} className="w-row-chevron" aria-hidden />
                  </button>
                </div>
              </section>

              {/* 低调页脚 */}
              <footer className="pub-footer">
                <div className="pub-footer-left">
                  <AppIcon size={14} aria-hidden />
                  <span>
                    © {year} {t('app.brand')}
                  </span>
                  <span className="w-sep--v" aria-hidden />
                  <span>
                    {t('landing.footer.onePerson')} · {t('landing.footer.free')}
                  </span>
                  <span className="w-sep--v" aria-hidden />
                  <span>aiim.de5.net</span>
                </div>
                <div className="pub-footer-right">
                  <button type="button" className="pub-link" onClick={() => navigate('/help')}>
                    {t('landing.nav.help')}
                  </button>
                  <span className="w-sep--v" aria-hidden />
                  <SupportLink className="pub-link" />
                  <span>{t('landing.footer.isolation')}</span>
                </div>
              </footer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
