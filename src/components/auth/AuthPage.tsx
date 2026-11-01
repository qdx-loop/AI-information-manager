/**
 * 登录 / 注册 · v9「WINDOWS 11 LOCK SCREEN」
 *
 * 视觉合同（`redesign-brief/11-v9-win11-desktop.md` §8 登录/注册）：
 *   整页 Windows 11 壁纸 + 压暗 → 左上大号时间 / 日期（锁屏）；
 *   中央偏右 Acrylic 登录面板：应用图标 AppIcon + 应用名 + Win11 输入框 +
 *   accent 全宽登录按钮 + Pivot 切换注册 + Win11 checkbox「记住登录状态」；
 *   错误提示贴着字段（面板内 InfoBar + 表单项内联报错）；右下角托盘图标/语言/主题。
 *
 * 行为契约（与视觉无关，逐条保留）：
 * 1) Turnstile 只在注册页签挂载；拿不到 token 时不在表单里预留空洞，
 *    提交时才拦截（回车提交同样拦截）；
 * 2) 注册成功先 `markWelcomePending()` 再 navigate，**不弹注册成功 toast**；
 * 3) 记住登录状态复选框控制 token 落 localStorage / sessionStorage（store 逻辑不变）；
 * 4) ?mode=register 直达注册页签；已登录访问本页自动跳回主页；
 * 5) 移动端单列，面板纵向滚动，不裁切表单。
 */
import { useState, useEffect, useCallback } from 'react'
import { Form, Input, Button, Checkbox, App } from 'antd'
import dayjs from 'dayjs'
import {
  Battery10Regular,
  Speaker2Regular,
  WarningRegular,
  Wifi1Regular,
  WeatherMoonRegular,
  WeatherSunnyRegular,
} from '@fluentui/react-icons'
import { SafetyOutlined } from '@/components/common/icons'
import AppIcon from '@/components/common/AppIcon'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'
import { apiRegistrationOpen } from '@/lib/serverApi'
import { useI18n } from '@/i18n'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTurnstile } from './useTurnstile'
import { isAndroidApp } from '@/utils/platform'
import { markWelcomePending } from '@/utils/welcome'

type Mode = 'login' | 'register'

interface RegisterValues {
  username: string
  password: string
  confirm: string
  contact?: string
}

export default function AuthPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const { login, register, account } = useAuthStore()
  const t = useI18n()
  const theme = useAppStore((s) => s.settings.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const language = useAppStore((s) => s.settings.language ?? 'zh')
  const setLanguage = useAppStore((s) => s.setLanguage)

  // 落地页导航的「免费注册」会带 ?mode=register，直接落到注册页签
  const [mode, setMode] = useState<Mode>(search.get('mode') === 'register' ? 'register' : 'login')
  const [loading, setLoading] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loginForm] = Form.useForm<{ username: string; password: string }>()
  const [regForm] = Form.useForm<RegisterValues>()
  const [regOpen, setRegOpen] = useState<boolean | null>(null)
  const inApp = isAndroidApp()
  // 内联错误：错误不只在顶部 toast 一闪而过，面板里留一行
  const [errorText, setErrorText] = useState('')
  // Turnstile token：拿不到时留空，服务端会按故障降级逻辑处理
  const [tsToken, setTsToken] = useState('')
  const onTsToken = useCallback((tok: string) => setTsToken(tok), [])
  const { hostRef: tsHost, status: tsStatus, reset: tsReset } = useTurnstile(
    onTsToken,
    mode === 'register',
  )

  // 人机验证没过 / 加载失败都由提交时拦截（不占位、不禁用整张表单）
  const tsBlocking = tsStatus !== 'passed'

  // 锁屏时钟：Win11 锁屏左上角大号时间 + 日期（30s 刷新足够，秒不显示）。
  // 存时间戳而不是 dayjs 对象：dayjs 对象会记住创建时的 locale，切语言后
  // 星期/月份不会跟着变；每次渲染用当前 locale 重新格式化。
  const [nowTs, setNowTs] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  // 显式指定 dayjs locale：全局 locale 由 main.tsx 的副作用切换，
  // 切换语言时本组件可能还没重渲染，不能依赖全局值（否则出现「9:36 晚上」）。
  const isEn = language === 'en'
  const now = dayjs(nowTs).locale(isEn ? 'en' : 'zh-cn')
  const timeText = now.format(isEn ? 'h:mm A' : 'HH:mm')
  const dateText = now.format(isEn ? 'dddd, MMMM D' : 'YYYY年M月D日 dddd')

  // 如果 init() 在跳转到 /login 后才完成恢复，自动跳回主页
  useEffect(() => {
    if (account) navigate('/', { replace: true })
  }, [account, navigate])

  // 注册开关由服务端决定（管理员被灌水时可紧急关闭）
  useEffect(() => {
    let alive = true
    apiRegistrationOpen()
      .then((open) => alive && setRegOpen(open))
      .catch(() => alive && setRegOpen(true))
    return () => {
      alive = false
    }
  }, [])

  const switchMode = useCallback(
    (next: Mode) => {
      setErrorText('')
      setMode(next)
      loginForm.resetFields()
      regForm.resetFields()
    },
    [loginForm, regForm],
  )

  const onLogin = async (values: { username: string; password: string }) => {
    setErrorText('')
    setLoading(true)
    try {
      await login(values.username, values.password, remember)
      message.success(t('auth.ok.plain'))
      navigate('/')
    } catch (e) {
      setErrorText((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const onRegister = async (values: RegisterValues) => {
    // 回车提交同样要过 Turnstile 检查（否则会绕过按钮上的拦截）
    if (tsBlocking) {
      setErrorText(t('auth.ts.notReady'))
      return
    }
    setErrorText('')
    setLoading(true)
    try {
      await register(
        {
          username: values.username.trim(),
          password: values.password,
          contact: values.contact?.trim(),
          turnstileToken: tsToken,
        },
        remember,
      )
      // 一次性 pending → AppShell 消费并弹欢迎卡；不打 toast
      markWelcomePending()
      navigate('/')
    } catch (e) {
      setErrorText((e as Error).message)
      // token 是一次性的，任何失败后都要重置 widget 才能重试
      tsReset()
    } finally {
      setLoading(false)
    }
  }

  const errorLine = errorText ? (
    <div className="pub-auth-error" role="alert">
      <WarningRegular fontSize={16} aria-hidden />
      <span>{errorText}</span>
    </div>
  ) : null

  // Win11 Pivot：文字 14，选中项 accent 下划线（`.w-tab` 已由 primitives 提供）
  const tabs = (
    <div className="w-tabs pub-auth-tabs" role="tablist" aria-label={t('auth.tab.login')}>
      {(['login', 'register'] as const).map((k) => {
        const active = mode === k
        return (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => switchMode(k)}
            className={`w-tab${active ? ' is-active' : ''}`}
          >
            {t(k === 'login' ? 'auth.tab.login' : 'auth.tab.register')}
          </button>
        )
      })}
    </div>
  )

  const loginPane = (
    <Form
      form={loginForm}
      onFinish={onLogin}
      layout="vertical"
      className="pub-auth-form"
      validateTrigger={['onSubmit', 'onChange']}
      requiredMark={false}
    >
      <Form.Item
        name="username"
        label={t('auth.username')}
        rules={[{ required: true, message: t('auth.err.username') }]}
      >
        <Input
          placeholder={t('auth.username')}
          autoComplete="username"
          aria-label={t('auth.username')}
          autoFocus
        />
      </Form.Item>
      <Form.Item
        name="password"
        label={t('auth.password')}
        rules={[
          { required: true, message: t('auth.err.password') },
          { min: 6, message: t('auth.err.passwordMin') },
        ]}
      >
        <Input.Password
          placeholder={t('auth.password')}
          autoComplete="current-password"
          aria-label={t('auth.password')}
        />
      </Form.Item>
      <Form.Item className="pub-auth-remember">
        <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)}>
          {t('auth.remember')}
        </Checkbox>
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={loading} className="pub-auth-submit">
        {t('auth.login')}
      </Button>
    </Form>
  )

  const registerPane = (
    <>
      {regOpen === false && (
        <div className="pub-infobar pub-infobar--warning" role="status">
          <WarningRegular fontSize={18} aria-hidden />
          <div className="pub-infobar-main">
            <div className="pub-infobar-title">{t('auth.reg.closedTitle')}</div>
            <div className="pub-infobar-desc">{t('auth.reg.closedBody')}</div>
          </div>
        </div>
      )}
      <Form
        form={regForm}
        onFinish={onRegister}
        layout="vertical"
        className="pub-auth-form"
        validateTrigger={['onSubmit', 'onChange']}
        requiredMark={false}
        disabled={regOpen === false}
      >
        <Form.Item
          name="username"
          label={t('auth.reg.usernameLabel')}
          extra={<span className="pub-auth-extra">{t('auth.err.usernamePattern')}</span>}
          rules={[
            { required: true, message: t('auth.err.username') },
            { pattern: /^[A-Za-z0-9_]{3,20}$/, message: t('auth.err.usernamePattern') },
          ]}
        >
          <Input
            placeholder={t('auth.reg.username')}
            autoComplete="username"
            aria-label={t('auth.reg.username')}
          />
        </Form.Item>
        <Form.Item
          name="password"
          label={t('auth.reg.passwordLabel')}
          extra={<span className="pub-auth-extra">{t('auth.err.passwordMin8')}</span>}
          rules={[
            { required: true, message: t('auth.err.password') },
            { min: 8, message: t('auth.err.passwordMin8') },
          ]}
        >
          <Input.Password
            placeholder={t('auth.reg.password')}
            autoComplete="new-password"
            aria-label={t('auth.reg.password')}
          />
        </Form.Item>
        <Form.Item
          name="confirm"
          label={t('auth.reg.confirmLabel')}
          dependencies={['password']}
          rules={[
            { required: true, message: t('auth.err.confirm') },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) return Promise.resolve()
                return Promise.reject(new Error(t('auth.err.confirmMismatch')))
              },
            }),
          ]}
        >
          <Input.Password
            placeholder={t('auth.reg.confirm')}
            autoComplete="new-password"
            aria-label={t('auth.reg.confirm')}
          />
        </Form.Item>
        <Form.Item
          name="contact"
          label={t('auth.reg.contactLabel')}
          rules={[{ max: 120, message: t('auth.err.contactMax') }]}
          className="pub-auth-contact"
        >
          <Input
            placeholder={t('auth.reg.contact')}
            autoComplete="email"
            aria-label={t('auth.reg.contact')}
          />
        </Form.Item>

        {/* Turnstile 宿主：脚本未就绪时只有一行状态，不占固定高度 */}
        <div className="pub-auth-ts">
          <div ref={tsHost} />
          {tsStatus === 'loading' && (
            <div className="pub-auth-ts-hint">{t('auth.reg.ts.loading')}</div>
          )}
          {tsStatus === 'failed' && (
            <div className="pub-auth-ts-error">
              <SafetyOutlined size={14} />
              <span>{t('auth.reg.ts.failed')}</span>
            </div>
          )}
          {tsStatus === 'unavailable' && (
            <div className="pub-auth-ts-hint">
              <span>{t('auth.reg.ts.unavailable')}</span>
              <button
                type="button"
                className="w-btn w-btn--sm"
                onClick={() => {
                  // 当前 URL 可能是 /login（没有 mode 参数），直接 reload 会再次
                  // 停在登录页签、再次失败。先把 mode=register 补进地址栏。
                  const u = new URL(window.location.href)
                  u.searchParams.set('mode', 'register')
                  window.history.replaceState(null, '', u.toString())
                  window.location.reload()
                }}
              >
                {t('auth.reg.ts.retry')}
              </button>
            </div>
          )}
        </div>

        <Button
          type="primary"
          htmlType="submit"
          block
          loading={loading}
          disabled={regOpen === false}
          className="pub-auth-submit"
        >
          {t('auth.reg.submit')}
        </Button>
        <p className="pub-auth-privacy">{t('auth.reg.privacy')}</p>
      </Form>
    </>
  )

  const isDark = theme === 'dark'

  return (
    <div className="pub-lock">
      <div className="pub-lock-scrim" aria-hidden />
      <div className="pub-lock-content">
        {/* 左：锁屏时间 / 日期 + 本地优先说明（Windows 锁屏） */}
        <div className="pub-lock-left">
          <div className="pub-lock-clock" aria-hidden>
            <div className="pub-lock-time">{timeText}</div>
            <div className="pub-lock-date">{dateText}</div>
          </div>
          <div className="pub-lock-tagline">
            <span className="pub-lock-tagline-mark" aria-hidden>
              <AppIcon size={18} />
            </span>
            <span>{t('w11.status.local')}</span>
            <span className="w-sep--v" aria-hidden />
            <span>aiim.de5.net</span>
          </div>
        </div>

        {/* 右：Acrylic 登录面板 */}
        <div className="pub-lock-right">
          <section className="pub-auth-panel" aria-labelledby="auth-title">
            <div className="pub-auth-brand">
              <AppIcon size={48} className="pub-auth-icon" />
              <div className="pub-auth-brand-main">
                <h1 id="auth-title" className="pub-auth-app">
                  {t('app.brand')}
                </h1>
                <p className="pub-auth-sub">{t('auth.hero.subtitle')}</p>
              </div>
            </div>

            {tabs}
            {errorLine}
            {mode === 'login' ? loginPane : registerPane}

            <div className="pub-auth-foot">
              {!inApp && (
                <button type="button" className="w-btn w-btn--subtle w-btn--sm" onClick={() => navigate('/')}>
                  {t('auth.backHome')}
                </button>
              )}
              <span className="pub-auth-hint">{t('auth.footerNote')}</span>
            </div>
          </section>
        </div>

        {/* 右下：语言 / 主题 / 托盘图标（锁屏风格，装饰性托盘为 aria-hidden） */}
        <div className="pub-lock-status">
          <button
            type="button"
            className="pub-lock-tool"
            aria-label={isDark ? t('app.theme.light') : t('app.theme.dark')}
            title={isDark ? t('app.theme.light') : t('app.theme.dark')}
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
          >
            {isDark ? <WeatherSunnyRegular fontSize={15} /> : <WeatherMoonRegular fontSize={15} />}
          </button>
          <button
            type="button"
            className="pub-lock-tool pub-lock-tool--text"
            aria-label={t('app.language')}
            title={t('app.language')}
            onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
          >
            {language === 'zh' ? 'EN' : '中'}
          </button>
          <span className="pub-lock-tray" aria-hidden>
            <Wifi1Regular fontSize={15} />
            <Speaker2Regular fontSize={15} />
            <Battery10Regular fontSize={15} />
          </span>
        </div>

      </div>
    </div>
  )
}
