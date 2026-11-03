/**
 * 登录 / 注册 · v10「FLUENT UI 2 · Windows 11 应用」
 *
 * 用户反馈（2026-11-02）：v9 的「操作系统锁屏」是错的——
 * 这是 Windows 11 风格的 Web 应用，不是 Windows 桌面模拟器。
 *
 * v10 形态（`redesign-brief/12-v10-fluent-app.md` §4 登录/注册）：
 *   满屏 Fluent 应用页：48px app bar（AppIcon + 应用名 + 主题/语言）+
 *   中性画布 colorNeutralBackground2 + 居中 Fluent Card：
 *     AppIcon / 应用名 / TabList（登录·注册）/ Field + Input / Checkbox /
 *     Button(primary) / MessageBar（错误就近）。
 * 删除：壁纸、锁屏大时钟、锁屏托盘图标、桌面/窗口 chrome。
 *
 * 行为契约（与 v9 完全一致，逐条保留）：
 * 1) Turnstile 只在注册页签挂载；拿不到 token 时不在表单里预留空洞，
 *    提交时才拦截（回车提交同样拦截）；
 * 2) 注册成功先 `markWelcomePending()` 再 navigate，不弹注册成功 toast；
 * 3) 记住登录状态复选框控制 token 落 localStorage / sessionStorage（store 逻辑不变）；
 * 4) ?mode=register 直达注册页签；已登录访问本页自动跳回主页；
 * 5) 移动端单列、卡片纵向滚动，不裁切表单。
 *
 * 表单：可见控件全部 Fluent UI React v9（Field/Input/Checkbox/Button/MessageBar/TabList）。
 * 校验按 UX 规范：错误贴在字段下（Field 自动 aria-describedby）、blur 时校验、
 * 提交失败把焦点送到第一个错误字段；服务端错误在最靠近表单的位置用 MessageBar 展示。
 */
import { useCallback, useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { App as AntdApp } from 'antd'
import {
  Button,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Tab,
  TabList,
  Text,
  Tooltip,
} from '@fluentui/react-components'
import {
  EyeOffRegular,
  EyeRegular,
  GlobeRegular,
  ShieldRegular,
  WeatherMoonRegular,
  WeatherSunnyRegular,
} from '@fluentui/react-icons'
import AppIcon from '@/components/common/AppIcon'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'
import { apiRegistrationOpen } from '@/lib/serverApi'
import { useI18n, type TFunc } from '@/i18n'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTurnstile } from './useTurnstile'
import { isAndroidApp } from '@/utils/platform'
import { markWelcomePending } from '@/utils/welcome'

type Mode = 'login' | 'register'

interface LoginValues {
  username: string
  password: string
}

interface RegValues {
  username: string
  password: string
  confirm: string
  contact: string
}

type FieldErrors<T> = Partial<Record<keyof T, string>>

/** 登录字段校验（与 antd 时代的规则逐条一致） */
function validateLogin(v: LoginValues, t: TFunc): FieldErrors<LoginValues> {
  const errors: FieldErrors<LoginValues> = {}
  if (!v.username.trim()) errors.username = t('auth.err.username')
  if (!v.password) errors.password = t('auth.err.password')
  else if (v.password.length < 6) errors.password = t('auth.err.passwordMin')
  return errors
}

/** 注册字段校验（用户名 3~20 字母数字下划线 / 密码 8 位 / 两次一致 / 联系方式 120 上限） */
function validateRegister(v: RegValues, t: TFunc): FieldErrors<RegValues> {
  const errors: FieldErrors<RegValues> = {}
  if (!v.username.trim()) errors.username = t('auth.err.username')
  else if (!/^[A-Za-z0-9_]{3,20}$/.test(v.username.trim())) errors.username = t('auth.err.usernamePattern')
  if (!v.password) errors.password = t('auth.err.password')
  else if (v.password.length < 8) errors.password = t('auth.err.passwordMin8')
  if (!v.confirm) errors.confirm = t('auth.err.confirm')
  else if (v.confirm !== v.password) errors.confirm = t('auth.err.confirmMismatch')
  if (v.contact.length > 120) errors.contact = t('auth.err.contactMax')
  return errors
}

/** 提交失败后把焦点送到第一个出错的字段 */
function focusFirstError<T extends object>(
  errors: FieldErrors<T>,
  refs: Partial<Record<keyof T, RefObject<HTMLInputElement | null>>>,
): void {
  for (const key of Object.keys(errors) as (keyof T)[]) {
    if (errors[key]) {
      refs[key]?.current?.focus()
      return
    }
  }
}

export default function AuthPage() {
  const { message } = AntdApp.useApp()
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
  const [revealPassword, setRevealPassword] = useState(false)
  const [regOpen, setRegOpen] = useState<boolean | null>(null)
  const inApp = isAndroidApp()
  // 服务端错误（凭据/网络/人机验证）：显示在表单顶部、紧挨着字段
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

  const [loginValues, setLoginValues] = useState<LoginValues>({ username: '', password: '' })
  const [loginErrors, setLoginErrors] = useState<FieldErrors<LoginValues>>({})
  const [regValues, setRegValues] = useState<RegValues>({ username: '', password: '', confirm: '', contact: '' })
  const [regErrors, setRegErrors] = useState<FieldErrors<RegValues>>({})

  const loginUserRef = useRef<HTMLInputElement>(null)
  const loginPwdRef = useRef<HTMLInputElement>(null)
  const regUserRef = useRef<HTMLInputElement>(null)
  const regPwdRef = useRef<HTMLInputElement>(null)
  const regConfirmRef = useRef<HTMLInputElement>(null)
  const regContactRef = useRef<HTMLInputElement>(null)
  const regRefs = {
    username: regUserRef,
    password: regPwdRef,
    confirm: regConfirmRef,
    contact: regContactRef,
  }

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

  const switchMode = useCallback((next: Mode) => {
    setErrorText('')
    setLoginErrors({})
    setRegErrors({})
    setLoginValues({ username: '', password: '' })
    setRegValues({ username: '', password: '', confirm: '', contact: '' })
    setRevealPassword(false)
    setMode(next)
  }, [])

  const onLogin = async (e: FormEvent) => {
    e.preventDefault()
    const errors = validateLogin(loginValues, t)
    setLoginErrors(errors)
    if (Object.keys(errors).length) {
      focusFirstError(errors, { username: loginUserRef, password: loginPwdRef })
      return
    }
    setErrorText('')
    setLoading(true)
    try {
      await login(loginValues.username, loginValues.password, remember)
      message.success(t('auth.ok.plain'))
      navigate('/')
    } catch (err) {
      setErrorText((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const onRegister = async (e: FormEvent) => {
    e.preventDefault()
    const errors = validateRegister(regValues, t)
    setRegErrors(errors)
    if (Object.keys(errors).length) {
      focusFirstError(errors, regRefs)
      return
    }
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
          username: regValues.username.trim(),
          password: regValues.password,
          contact: regValues.contact.trim() || undefined,
          turnstileToken: tsToken,
        },
        remember,
      )
      // 一次性 pending → AppShell 消费并弹欢迎卡；不打 toast
      markWelcomePending()
      navigate('/')
    } catch (err) {
      setErrorText((err as Error).message)
      // token 是一次性的，任何失败后都要重置 widget 才能重试
      tsReset()
    } finally {
      setLoading(false)
    }
  }

  const isDark = theme === 'dark'
  const revealLabel =
    language === 'en'
      ? revealPassword
        ? 'Hide password'
        : 'Show password'
      : revealPassword
        ? '隐藏密码'
        : '显示密码'

  const passwordReveal = (
    <Tooltip content={revealLabel} relationship="label">
      <Button
        appearance="transparent"
        size="small"
        icon={revealPassword ? <EyeOffRegular /> : <EyeRegular />}
        aria-label={revealLabel}
        onClick={() => setRevealPassword((v) => !v)}
      />
    </Tooltip>
  )

  const errorLine = errorText ? (
    <MessageBar intent="error" role="alert" className="pub-auth-error">
      <MessageBarBody>{errorText}</MessageBarBody>
    </MessageBar>
  ) : null

  const loginPane = (
    <form className="pub-auth-form" onSubmit={onLogin} noValidate>
      <Field
        label={t('auth.username')}
        required
        validationState={loginErrors.username ? 'error' : 'none'}
        validationMessage={loginErrors.username}
      >
        <Input
          ref={loginUserRef}
          size="large"
          value={loginValues.username}
          placeholder={t('auth.username')}
          autoComplete="username"
          onChange={(_, data) => {
            setLoginValues((v) => ({ ...v, username: data.value }))
            if (loginErrors.username) setLoginErrors((e) => ({ ...e, username: undefined }))
          }}
          onBlur={() => setLoginErrors((e) => ({ ...e, username: validateLogin(loginValues, t).username }))}
        />
      </Field>
      <Field
        label={t('auth.password')}
        required
        validationState={loginErrors.password ? 'error' : 'none'}
        validationMessage={loginErrors.password}
      >
        <Input
          ref={loginPwdRef}
          size="large"
          type={revealPassword ? 'text' : 'password'}
          value={loginValues.password}
          placeholder={t('auth.password')}
          autoComplete="current-password"
          contentAfter={passwordReveal}
          onChange={(_, data) => {
            setLoginValues((v) => ({ ...v, password: data.value }))
            if (loginErrors.password) setLoginErrors((e) => ({ ...e, password: undefined }))
          }}
          onBlur={() => setLoginErrors((e) => ({ ...e, password: validateLogin(loginValues, t).password }))}
        />
      </Field>
      <div className="pub-auth-remember">
        <Checkbox
          checked={remember}
          onChange={(_, data) => setRemember(!!data.checked)}
          label={t('auth.remember')}
        />
      </div>
      <Button
        appearance="primary"
        type="submit"
        size="large"
        className="pub-auth-submit"
        disabled={loading}
        icon={loading ? <Spinner size="tiny" /> : undefined}
      >
        {t('auth.login')}
      </Button>
    </form>
  )

  const registerPane = (
    <>
      {regOpen === false && (
        <MessageBar intent="warning" className="pub-auth-error">
          <MessageBarBody>
            <MessageBarTitle>{t('auth.reg.closedTitle')}</MessageBarTitle>
            {t('auth.reg.closedBody')}
          </MessageBarBody>
        </MessageBar>
      )}
      <form className="pub-auth-form" onSubmit={onRegister} noValidate>
        <Field
          label={t('auth.reg.usernameLabel')}
          required
          validationState={regErrors.username ? 'error' : 'none'}
          validationMessage={regErrors.username}
          hint={t('auth.err.usernamePattern')}
        >
          <Input
            ref={regUserRef}
            size="large"
            value={regValues.username}
            placeholder={t('auth.reg.username')}
            autoComplete="username"
            disabled={regOpen === false}
            onChange={(_, data) => {
              setRegValues((v) => ({ ...v, username: data.value }))
              if (regErrors.username) setRegErrors((e) => ({ ...e, username: undefined }))
            }}
            onBlur={() => setRegErrors((e) => ({ ...e, username: validateRegister(regValues, t).username }))}
          />
        </Field>
        <Field
          label={t('auth.reg.passwordLabel')}
          required
          validationState={regErrors.password ? 'error' : 'none'}
          validationMessage={regErrors.password}
          hint={t('auth.err.passwordMin8')}
        >
          <Input
            ref={regPwdRef}
            size="large"
            type={revealPassword ? 'text' : 'password'}
            value={regValues.password}
            placeholder={t('auth.reg.password')}
            autoComplete="new-password"
            disabled={regOpen === false}
            contentAfter={passwordReveal}
            onChange={(_, data) => {
              setRegValues((v) => ({ ...v, password: data.value }))
              if (regErrors.password) setRegErrors((e) => ({ ...e, password: undefined }))
            }}
            onBlur={() => setRegErrors((e) => ({ ...e, password: validateRegister(regValues, t).password }))}
          />
        </Field>
        <Field
          label={t('auth.reg.confirmLabel')}
          required
          validationState={regErrors.confirm ? 'error' : 'none'}
          validationMessage={regErrors.confirm}
        >
          <Input
            ref={regConfirmRef}
            size="large"
            type={revealPassword ? 'text' : 'password'}
            value={regValues.confirm}
            placeholder={t('auth.reg.confirm')}
            autoComplete="new-password"
            disabled={regOpen === false}
            onChange={(_, data) => {
              setRegValues((v) => ({ ...v, confirm: data.value }))
              if (regErrors.confirm) setRegErrors((e) => ({ ...e, confirm: undefined }))
            }}
            onBlur={() => setRegErrors((e) => ({ ...e, confirm: validateRegister(regValues, t).confirm }))}
          />
        </Field>
        <Field
          label={t('auth.reg.contactLabel')}
          validationState={regErrors.contact ? 'error' : 'none'}
          validationMessage={regErrors.contact}
        >
          <Input
            ref={regContactRef}
            size="large"
            value={regValues.contact}
            placeholder={t('auth.reg.contact')}
            autoComplete="email"
            disabled={regOpen === false}
            onChange={(_, data) => {
              setRegValues((v) => ({ ...v, contact: data.value }))
              if (regErrors.contact) setRegErrors((e) => ({ ...e, contact: undefined }))
            }}
            onBlur={() => setRegErrors((e) => ({ ...e, contact: validateRegister(regValues, t).contact }))}
          />
        </Field>

        {/* Turnstile 宿主：脚本未就绪时只有一行状态，不占固定高度 */}
        <div className="pub-auth-ts">
          <div ref={tsHost} />
          {tsStatus === 'loading' && (
            <div className="pub-auth-ts-hint">
              <Spinner size="tiny" />
              <Text size={200} className="w-faint">
                {t('auth.reg.ts.loading')}
              </Text>
            </div>
          )}
          {tsStatus === 'failed' && (
            <MessageBar intent="error">
              <MessageBarBody>
                <ShieldRegular /> {t('auth.reg.ts.failed')}
              </MessageBarBody>
            </MessageBar>
          )}
          {tsStatus === 'unavailable' && (
            <MessageBar intent="warning">
              <MessageBarBody>
                {t('auth.reg.ts.unavailable')}
                <Button
                  appearance="secondary"
                  size="small"
                  className="pub-auth-ts-retry"
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
                </Button>
              </MessageBarBody>
            </MessageBar>
          )}
        </div>

        <Button
          appearance="primary"
          type="submit"
          size="large"
          className="pub-auth-submit"
          disabled={loading || regOpen === false}
          icon={loading ? <Spinner size="tiny" /> : undefined}
        >
          {t('auth.reg.submit')}
        </Button>
        <Text as="p" size={200} className="w-faint pub-auth-privacy">
          {t('auth.reg.privacy')}
        </Text>
      </form>
    </>
  )

  return (
    <div className="w-app">
      <header className="w-appbar pub-appbar">
        <div className="w-appbar-brand">
          <button
            type="button"
            className="w-appbar-brand-btn"
            onClick={() => navigate('/')}
            aria-label={t('app.brand')}
          >
            <AppIcon size={20} />
            <span className="w-appbar-title">{t('app.brand')}</span>
          </button>
        </div>
        <div className="w-appbar-spacer" />
        <div className="w-appbar-tools">
          <Tooltip content={isDark ? t('app.theme.light') : t('app.theme.dark')} relationship="label">
            <Button
              appearance="subtle"
              icon={isDark ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
              aria-label={isDark ? t('app.theme.light') : t('app.theme.dark')}
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
            />
          </Tooltip>
          <Tooltip content={t('app.language')} relationship="label">
            <Button
              appearance="subtle"
              icon={<GlobeRegular />}
              aria-label={t('app.language')}
              onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
            >
              <span className="pub-lang-label">{language === 'zh' ? '中' : 'EN'}</span>
            </Button>
          </Tooltip>
        </div>
      </header>

      <div className="w-content">
        <main className="pub-auth-main">
          <Card appearance="filled" className="pub-auth-card">
            <CardHeader
              image={<AppIcon size={44} />}
              header={
                <Text as="h1" size={600} weight="semibold">
                  {t('app.brand')}
                </Text>
              }
              description={
                <Text size={200} className="w-faint">
                  {language === 'en' ? 'Local-first · Free forever' : '本地优先 · 永久免费'}
                </Text>
              }
            />
            <TabList
              className="pub-auth-tabs"
              selectedValue={mode}
              onTabSelect={(_, data) => switchMode(data.value as Mode)}
            >
              <Tab value="login">{t('auth.tab.login')}</Tab>
              <Tab value="register">{t('auth.tab.register')}</Tab>
            </TabList>

            {errorLine}
            {mode === 'login' ? loginPane : registerPane}

            <div className="pub-auth-foot">
              {!inApp && (
                <Button appearance="subtle" size="small" onClick={() => navigate('/')}>
                  {t('auth.backHome')}
                </Button>
              )}
              <Text size={200} className="w-faint">
                {t('auth.cloudHint')}
              </Text>
            </div>
          </Card>

          <Text as="p" size={200} className="w-faint pub-auth-pagefoot">
            {t('w11.status.local')} · aiim.de5.net
          </Text>
        </main>
      </div>
    </div>
  )
}
