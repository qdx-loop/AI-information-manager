import { useState, useEffect, useCallback } from 'react'
import { Form, Input, Button, Checkbox, App, Spin } from 'antd'
import { SafetyOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'
import { apiRegistrationOpen } from '@/lib/serverApi'
import { useI18n } from '@/i18n'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTurnstile } from './useTurnstile'
import { isAndroidApp } from '@/utils/platform'
import SealMark from '@/components/public/SealMark'

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
  // 落地页导航的「免费注册」会带 ?mode=register，直接落到注册页签
  const [mode, setMode] = useState<Mode>(search.get('mode') === 'register' ? 'register' : 'login')
  const [loading, setLoading] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loginForm] = Form.useForm<{ username: string; password: string }>()
  const [regForm] = Form.useForm<RegisterValues>()
  const t = useI18n()
  const [regOpen, setRegOpen] = useState<boolean | null>(null)
  const inApp = isAndroidApp()
  // 内联错误：错误不再只靠顶部 toast（toast 会消失，用户回头看表单时不知道错在哪）
  const [errorText, setErrorText] = useState('')
  // Turnstile token：拿不到时留空，服务端会按故障降级逻辑处理
  const [tsToken, setTsToken] = useState('')
  const onTsToken = useCallback((tok: string) => setTsToken(tok), [])
  // 只在注册页签下才挂载 Turnstile 宿主；enabled 变化会让 hook 重跑并重新 render widget
  const { hostRef: tsHost, status: tsStatus, reset: tsReset } = useTurnstile(
    onTsToken,
    mode === 'register',
  )

  // 人机验证没过 / 加载失败都禁用提交。
  // 关键：不能因为「脚本没加载出来」就放行——那等于给机器人发通行证。
  // 服务端只在自己观察到 siteverify 故障时才会降级放行，客户端无权声明。
  const tsBlocking = tsStatus !== 'passed'

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
      message.success(t('auth.reg.ok'))
      navigate('/')
    } catch (e) {
      setErrorText((e as Error).message)
      // token 是一次性的，任何失败后都要重置 widget 才能重试
      tsReset()
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { num: '01', text: t('auth.f1') },
    { num: '02', text: t('auth.f2') },
    { num: '03', text: t('auth.f3') },
  ]

  // 错误态：一行文字 + 朱砂左线（不只靠颜色，也不弹气泡框）
  const errorLine = errorText ? (
    <div
      role="alert"
      style={{
        borderLeft: '2px solid var(--app-danger)',
        paddingLeft: 10,
        marginBottom: 16,
        fontSize: 13,
        lineHeight: 1.6,
        color: 'var(--app-danger)',
      }}
    >
      {errorText}
    </div>
  ) : null

  const tabs = (
    <div
      style={{
        display: 'flex',
        gap: 20,
        borderBottom: '1px solid var(--app-border-soft)',
        marginBottom: 20,
      }}
    >
      {(['login', 'register'] as const).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => switchMode(k)}
          style={{
            background: 'none',
            border: 'none',
            font: 'inherit',
            padding: '0 0 8px',
            marginBottom: -1,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: mode === k ? 600 : 400,
            color: mode === k ? 'var(--app-ink)' : 'var(--app-ink-faint)',
            borderBottom: mode === k ? '2px solid var(--app-accent)' : '2px solid transparent',
          }}
        >
          {t(k === 'login' ? 'auth.tab.login' : 'auth.tab.register')}
        </button>
      ))}
    </div>
  )

  const loginPane = (
    <Form
      form={loginForm}
      onFinish={onLogin}
      layout="vertical"
      validateTrigger={['onSubmit', 'onChange']}
      requiredMark={false}
    >
      <Form.Item name="username" rules={[{ required: true, message: t('auth.err.username') }]}>
        <Input
          placeholder={t('auth.username')}
          autoComplete="username"
          aria-label={t('auth.username')}
          style={{ height: 32, borderRadius: 2 }}
        />
      </Form.Item>
      <Form.Item
        name="password"
        rules={[
          { required: true, message: t('auth.err.password') },
          { min: 6, message: t('auth.err.passwordMin') },
        ]}
      >
        <Input.Password
          placeholder={t('auth.password')}
          autoComplete="current-password"
          aria-label={t('auth.password')}
          style={{ height: 32, borderRadius: 2 }}
        />
      </Form.Item>
      <Form.Item style={{ marginBottom: 16 }}>
        <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)}>
          <span style={{ fontSize: 13, color: 'var(--app-ink-soft)' }}>{t('auth.remember')}</span>
        </Checkbox>
      </Form.Item>

      <Button type="primary" htmlType="submit" block loading={loading}>
        {t('auth.login')}
      </Button>
    </Form>
  )

  const registerPane = (
    <>
      {regOpen === false && (
        <div
          style={{
            borderLeft: '2px solid var(--app-warning)',
            background: 'var(--app-warning-wash)',
            padding: '8px 12px',
            marginBottom: 16,
            fontSize: 12.5,
            lineHeight: 1.7,
            color: 'var(--app-ink-soft)',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--app-ink)', marginBottom: 2 }}>
            {t('auth.reg.closedTitle')}
          </div>
          {t('auth.reg.closedBody')}
        </div>
      )}
      <Form
        form={regForm}
        onFinish={onRegister}
        layout="vertical"
        validateTrigger={['onSubmit', 'onChange']}
        requiredMark={false}
        disabled={regOpen === false}
      >
        <Form.Item
          name="username"
          rules={[
            { required: true, message: t('auth.err.username') },
            {
              pattern: /^[A-Za-z0-9_]{3,20}$/,
              message: t('auth.err.usernamePattern'),
            },
          ]}
        >
          <Input
            placeholder={t('auth.reg.username')}
            autoComplete="username"
            aria-label={t('auth.reg.username')}
            style={{ height: 32, borderRadius: 2 }}
          />
        </Form.Item>
        <Form.Item
          name="password"
          rules={[
            { required: true, message: t('auth.err.password') },
            { min: 8, message: t('auth.err.passwordMin8') },
          ]}
        >
          <Input.Password
            placeholder={t('auth.reg.password')}
            autoComplete="new-password"
            aria-label={t('auth.reg.password')}
            style={{ height: 32, borderRadius: 2 }}
          />
        </Form.Item>
        <Form.Item
          name="confirm"
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
            style={{ height: 32, borderRadius: 2 }}
          />
        </Form.Item>
        <Form.Item
          name="contact"
          rules={[{ max: 120, message: t('auth.err.contactMax') }]}
          style={{ marginBottom: 16 }}
        >
          <Input
            placeholder={t('auth.reg.contact')}
            autoComplete="email"
            aria-label={t('auth.reg.contact')}
            style={{ height: 32, borderRadius: 2 }}
          />
        </Form.Item>

        {/* 人机验证：挡住脚本自动注册。脚本加载失败时显示降级提示并照常允许提交 */}
        <div style={{ marginBottom: 12, minHeight: 65 }}>
          <div ref={tsHost} />
          {tsStatus === 'loading' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12.5,
                color: 'var(--app-ink-faint)',
              }}
            >
              <Spin size="small" />
              {t('auth.reg.ts.loading')}
            </div>
          )}
          {tsStatus === 'failed' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12.5,
                color: 'var(--app-danger)',
              }}
            >
              <SafetyOutlined />
              {t('auth.reg.ts.failed')}
            </div>
          )}
          {tsStatus === 'unavailable' && (
            <div
              style={{
                borderLeft: '2px solid var(--app-warning)',
                paddingLeft: 10,
                fontSize: 12,
                color: 'var(--app-ink-soft)',
                lineHeight: 1.6,
              }}
            >
              {t('auth.reg.ts.unavailable')}
              <Button
                type="link"
                size="small"
                style={{ padding: '0 0 0 6px', fontSize: 12 }}
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
            </div>
          )}
        </div>

        <Button
          type="primary"
          htmlType="submit"
          block
          loading={loading}
          disabled={regOpen === false || tsBlocking}
        >
          {t('auth.reg.submit')}
        </Button>
        <p className="faint" style={{ marginTop: 12, marginBottom: 0, fontSize: 12, lineHeight: 1.7 }}>
          {t('auth.reg.privacy')}
        </p>
      </Form>
    </>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--app-canvas)' }}>
      {/* 左栏：一张纸 + 一枚印（≥900px 显示；底色与分栏线由 .login-brand 负责） */}
      <div className="login-brand" style={{ flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ maxWidth: 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            <SealMark />
            <span className="serif" style={{ fontSize: 16, fontWeight: 600, color: 'var(--app-ink)' }}>
              {t('auth.brand')}
            </span>
          </div>
          <h1
            className="serif"
            style={{ fontSize: 26, lineHeight: 1.3, fontWeight: 600, margin: '0 0 12px', color: 'var(--app-ink)' }}
          >
            {t('auth.hero.title')}
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: 'var(--app-ink-soft)',
              margin: '0 0 28px',
            }}
          >
            {t('auth.hero.subtitle')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {features.map((f) => (
              <div key={f.num} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    color: 'var(--app-ink-faint)',
                    flexShrink: 0,
                  }}
                >
                  {f.num}
                </span>
                <span style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--app-ink-soft)' }}>
                  {f.text}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="faint" style={{ marginTop: 48, fontSize: 12 }}>
          {t('auth.footerNote')}
        </div>
      </div>

      {/* 右栏：无卡片，表单宽 320，垂直略偏上 */}
      <div className="login-form-side">
        <div
          style={{
            width: '100%',
            maxWidth: 320,
            padding: '0 24px',
            transform: 'translateY(-6vh)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
            <SealMark size={12} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--app-ink)' }}>
              {t('auth.brand')}
            </span>
          </div>

          <h2
            className="serif"
            style={{ fontSize: 20, fontWeight: 600, margin: '0 0 6px', color: 'var(--app-ink)' }}
          >
            {t('auth.welcome')}
          </h2>
          <p className="muted" style={{ fontSize: 12.5, margin: '0 0 20px', lineHeight: 1.6 }}>
            {t('auth.hint')}
          </p>

          {tabs}
          {errorLine}
          {mode === 'login' ? loginPane : registerPane}

          <p className="faint" style={{ marginTop: 24, fontSize: 12, lineHeight: 1.8 }}>
            {/* App 里 `/` 会被分流回登录页，这个链接点了没反应，所以在壳内隐藏 */}
            {!inApp && (
              <>
                <a
                  href="/"
                  className="link-quiet"
                  onClick={(e) => {
                    e.preventDefault()
                    navigate('/')
                  }}
                >
                  {t('auth.backHome')}
                </a>
                <br />
              </>
            )}
            {t('auth.cloudHint')}
          </p>
          {/* 注意：这里刻意不放「管理员入口」。
              /admin 是后台控制台，按需从书签/直链访问；
              任何出现在用户界面里的入口都会让普通用户误点进去后看到
              「无权访问」，反而制造困惑。管理员由运营方单独告知地址。 */}
        </div>
      </div>
    </div>
  )
}
