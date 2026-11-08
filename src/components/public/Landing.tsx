/**
 * 未登录落地页 · v10「FLUENT UI 2 · Windows 11 应用介绍页」
 *
 * 用户反馈（2026-11-02）：v9 的「Windows 桌面截图」是错的——
 * 这是 Windows 11 风格的 Web 应用介绍页，不是操作系统模拟。
 *
 * v10 形态（`redesign-brief/12-v10-fluent-app.md` §4 落地页）：
 *   满屏 Fluent 应用页：轻量顶部导航（AppIcon + 应用名 + 主题/语言 + 登录/免费注册）→
 *   Hero（应用名 / 一句话价值 / 主 CTA / 真实截图 Card，保持引用 /hero-table.png）→
 *   功能 Card 网格 → 「数据归你」Card → FAQ Accordion → 收尾 CTA Card →
 *   联系方式 Card → 低调页脚。
 * 无桌面模拟、无壁纸、无窗口 chrome、无渐变、无营销大字报。
 *
 * 组件：可见控件全部 Fluent UI React v9（Button/Card/CardHeader/Accordion/Badge/Divider/Link/Text）。
 * 文案尽量复用既有 i18n key；新增文案在组件内按 settings.language 做 zh/en。
 */
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Badge,
  Button,
  Card,
  CardHeader,
  Divider,
  Link,
  Text,
  Tooltip,
} from '@fluentui/react-components'
import {
  ArrowDownloadRegular,
  ArrowRightRegular,
  ChartMultipleRegular,
  CheckmarkCircleRegular,
  ChatRegular,
  CloudSyncRegular,
  CopyRegular,
  GlobeRegular,
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

/** 功能卡数据 */
interface FeatureItem {
  icon: FluentIcon
  title: string
  desc: string
}

export default function Landing() {
  const navigate = useNavigate()
  const t = useI18n()
  const lang = useAppStore((s) => s.settings.language ?? 'zh')
  const setLanguage = useAppStore((s) => s.setLanguage)
  const theme = useAppStore((s) => s.settings.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const [copiedEmail, setCopiedEmail] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)

  const goRegister = () => navigate('/login?mode=register')
  const goLogin = () => navigate('/login')
  const isDark = theme === 'dark'
  const year = new Date().getFullYear()

  const features: FeatureItem[] = [
    { icon: ChatRegular, title: t('landing.f1t'), desc: t('landing.f1d') },
    { icon: GridRegular, title: t('landing.f2t'), desc: t('landing.f2d') },
    { icon: ChartMultipleRegular, title: t('landing.f3t'), desc: t('landing.f3d') },
  ]
  const ownership: FeatureItem[] = [
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

  const themeToggle = (
    <Tooltip content={isDark ? t('app.theme.light') : t('app.theme.dark')} relationship="label">
      <Button
        appearance="subtle"
        icon={isDark ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
        aria-label={isDark ? t('app.theme.light') : t('app.theme.dark')}
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
      />
    </Tooltip>
  )

  const langToggle = (
    <Tooltip content={t('app.language')} relationship="label">
      <Button
        appearance="subtle"
        icon={<GlobeRegular />}
        aria-label={t('app.language')}
        onClick={() => setLanguage(lang === 'zh' ? 'en' : 'zh')}
      >
        <span className="pub-lang-label">{lang === 'zh' ? '中' : 'EN'}</span>
      </Button>
    </Tooltip>
  )

  return (
    <div className="w-app">
      <header className="w-appbar pub-appbar">
        <div className="w-appbar-brand">
          <button
            type="button"
            className="w-appbar-brand-btn"
            onClick={() => contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label={t('app.brand')}
          >
            <AppIcon size={20} />
            <span className="w-appbar-title">{t('app.brand')}</span>
          </button>
        </div>
        <div className="w-appbar-spacer" />
        <div className="w-appbar-tools">
          {themeToggle}
          {langToggle}
          <Button appearance="subtle" className="pub-appbar-login" onClick={goLogin}>
            {t('auth.tab.login')}
          </Button>
          <Button appearance="primary" onClick={goRegister}>
            {t('landing.nav.login')}
          </Button>
        </div>
      </header>

      <main className="w-content" ref={contentRef}>
        <div className="pub-container pub-landing">
          {/* Hero：应用标识 + 一句话价值 + 主 CTA + 真实截图 */}
          <section className="pub-hero">
            <div className="pub-hero-copy">
              <div className="pub-hero-badges">
                <Badge appearance="tint" color="brand" size="large">
                  {lang === 'en' ? 'Local-first' : '本地优先'}
                </Badge>
                <Badge appearance="outline" size="large">
                  {lang === 'en' ? 'Free forever' : '永久免费'}
                </Badge>
              </div>
              <Text as="h1" size={800} weight="semibold" className="pub-hero-title">
                {t('app.brand')}
              </Text>
              <Text as="p" size={400} className="w-muted pub-hero-sub">
                {t('landing.hero.sub')}
              </Text>
              <div className="pub-hero-actions">
                <Button
                  appearance="primary"
                  size="large"
                  icon={<ArrowRightRegular />}
                  iconPosition="after"
                  onClick={goRegister}
                >
                  {t('landing.dark.cta')}
                </Button>
                <Button appearance="secondary" size="large" onClick={goLogin}>
                  {t('auth.tab.login')}
                </Button>
              </div>
              <div className="pub-hero-meta">
                <Text size={200} className="w-faint">
                  {t('landing.hero.trust')}
                </Text>
                <Link href="/app/infodesk.apk" download="信息管理.apk" className="pub-apk-link">
                  <ArrowDownloadRegular /> {t('landing.hero.downloadApk')}
                </Link>
              </div>
            </div>

            <Card appearance="filled" className="pub-shot-card">
              <picture>
                <source
                  type="image/webp"
                  srcSet="/hero-table-800.webp 800w, /hero-table.webp 1600w"
                  sizes="(max-width: 900px) 100vw, 560px"
                />
                <img
                  className="pub-shot-img"
                  src="/hero-table.png"
                  alt={t('landing.shot.alt')}
                  width={1600}
                  height={1000}
                  loading="eager"
                  decoding="async"
                  {...{ fetchpriority: 'high' }}
                />
              </picture>
              <div className="pub-shot-cap">
                <Text size={200} className="w-faint">
                  {t('landing.shot.caption')}
                </Text>
              </div>
            </Card>
          </section>

          {/* 功能：3 张 Win11 设置卡（Fluent Card） */}
          <section className="pub-section" id="features" aria-labelledby="pub-features-title">
            <div className="pub-section-head">
              <Text as="h2" id="pub-features-title" size={600} weight="semibold">
                {t('landing.features.title')}
              </Text>
              <Text size={300} className="w-muted">
                {t('landing.features.sub')}
              </Text>
            </div>
            <div className="pub-feature-grid">
              {features.map((feature) => {
                const Icon = feature.icon
                return (
                  <Card key={feature.title} appearance="filled" size="large" className="pub-feature-card">
                    <CardHeader
                      image={
                        <span className="pub-icon-badge" aria-hidden>
                          <Icon fontSize={20} />
                        </span>
                      }
                      header={
                        <Text as="h3" size={400} weight="semibold">
                          {feature.title}
                        </Text>
                      }
                      description={
                        <Text size={300} className="w-muted">
                          {feature.desc}
                        </Text>
                      }
                    />
                  </Card>
                )
              })}
            </div>
          </section>

          {/* 数据归你：Fluent Card + 信息行 */}
          <section className="pub-section" id="privacy" aria-labelledby="pub-own-title">
            <Card appearance="filled" size="large" className="pub-own-card">
              <CardHeader
                image={
                  <span className="pub-icon-badge" aria-hidden>
                    <ShieldCheckmarkRegular fontSize={20} />
                  </span>
                }
                header={
                  <Text as="h2" id="pub-own-title" size={600} weight="semibold">
                    {t('landing.pov.title')}
                  </Text>
                }
                description={
                  <Text size={300} className="w-muted">
                    {t('landing.pov.body')}
                  </Text>
                }
              />
              <Divider />
              <div className="pub-own-rows">
                {ownership.map((row) => {
                  const Icon = row.icon
                  return (
                    <div key={row.title} className="pub-own-row">
                      <span className="pub-own-icon" aria-hidden>
                        <Icon fontSize={18} />
                      </span>
                      <div className="pub-own-main">
                        <Text size={300} weight="semibold">
                          {row.title}
                        </Text>
                        <Text size={200} className="w-faint">
                          {row.desc}
                        </Text>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </section>

          {/* FAQ：Fluent Accordion */}
          <section className="pub-section" id="faq" aria-labelledby="pub-faq-title">
            <div className="pub-section-head">
              <Text as="h2" id="pub-faq-title" size={600} weight="semibold">
                {t('landing.faq.title')}
              </Text>
            </div>
            <Card appearance="filled" className="pub-faq-card">
              <Accordion multiple collapsible>
                {faqs.map(([question, answer], index) => (
                  <AccordionItem key={question} value={index}>
                    <AccordionHeader>{question}</AccordionHeader>
                    <AccordionPanel>
                      <Text as="p" size={300} className="w-muted">
                        {answer}
                      </Text>
                    </AccordionPanel>
                  </AccordionItem>
                ))}
              </Accordion>
            </Card>
          </section>

          {/* 收尾 CTA */}
          <section className="pub-section">
            <Card appearance="filled" size="large" className="pub-cta-card">
              <div className="pub-cta-main">
                <Text as="h2" size={600} weight="semibold">
                  {t('landing.dark.title')}
                </Text>
                <Text size={300} className="w-muted">
                  {t('landing.dark.sub')}
                </Text>
              </div>
              <Button appearance="primary" size="large" onClick={goRegister}>
                {t('landing.dark.cta')}
              </Button>
            </Card>
          </section>

          {/* 联系我们 */}
          <section className="pub-section" id="contact" aria-labelledby="pub-contact-title">
            <Card appearance="filled" size="large" className="pub-contact-card">
              <CardHeader
                header={
                  <Text as="h2" id="pub-contact-title" size={600} weight="semibold">
                    {t('landing.contact.title')}
                  </Text>
                }
                description={
                  <Text size={300} className="w-muted">
                    {t('landing.contact.note')}
                  </Text>
                }
              />
              <Divider />
              <div className="pub-contact-rows">
                {SITE.contactEmails.map((email) => (
                  <div key={email} className="pub-contact-row">
                    <MailRegular className="pub-contact-icon" aria-hidden />
                    <div className="pub-contact-main">
                      <Text size={300}>{email}</Text>
                      <Text size={200} className="w-faint">
                        {copiedEmail === email ? t('common.copied') : t('landing.contact.copyHint')}
                      </Text>
                    </div>
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={copiedEmail === email ? <CheckmarkCircleRegular /> : <CopyRegular />}
                      aria-label={`${email} · ${t('landing.contact.copyHint')}`}
                      onClick={() => copyEmail(email)}
                    />
                  </div>
                ))}
                <Divider />
                <Button
                  appearance="subtle"
                  size="large"
                  className="pub-link-row"
                  icon={<KeyRegular />}
                  onClick={goLogin}
                >
                  {t('landing.contact.hasAccount')}
                </Button>
                <Button
                  appearance="subtle"
                  size="large"
                  className="pub-link-row"
                  icon={<QuestionCircleRegular />}
                  onClick={() => navigate('/help')}
                >
                  {t('landing.nav.help')}
                </Button>
              </div>
            </Card>
          </section>

          {/* 低调页脚 */}
          <footer className="pub-footer">
            <div className="pub-footer-brand">
              <AppIcon size={16} />
              <Text size={200} className="w-faint">
                © {year} {t('app.brand')} · aiim.de5.net
              </Text>
            </div>
            <div className="pub-footer-links">
              <Link href="/help" onClick={(e) => { e.preventDefault(); navigate('/help') }}>
                {t('landing.nav.help')}
              </Link>
              {/* 静态产品介绍页：给搜索引擎和分享链接一个可索引的长文落地页 */}
              <a href="/intro" className="pub-footer-static-link">
                {lang === 'en' ? 'About & use cases' : '产品介绍'}
              </a>
              <SupportLink />
              <Text size={200} className="w-faint">
                {t('landing.footer.isolation')}
              </Text>
            </div>
          </footer>
        </div>
      </main>
    </div>
  )
}
