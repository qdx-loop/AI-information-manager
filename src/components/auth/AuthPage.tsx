/**
 * 登录 / 注册 · v3『石墨信号』
 *
 * 两栏：左 45% `--bg-sunken` 品牌区（标 + 32/600 标题 + 3 条 13 说明）＋右 55% 画布上的白卡表单。
 * 表单卡 .login-card（380 / 白面 + 1px + shadow-2 + 12 圆角 + 32 内边距）；输入 40、主按钮墨黑 40 全宽。
 *
 * 三个刻意决定：
 * 1) 品牌只出现一次（左栏），右栏不再重复 logo/名字 —— v2 一屏出现两遍。
 * 2) Turnstile 未就绪时**不再预留 65px 空洞**：按钮保持可点，点击时才提示「校验还没完成」，
 *    这样脚本被墙/加载失败时表单仍是完整的（行为仍由服务端兜底，见 useTurnstile）。
 * 3) 注册成功：写一次性 welcome pending → navigate('/')，**不弹「注册成功」toast**，
 *    否则欢迎卡 0.5s 内会再「欢迎」一次（05-first-run-support §D.3）。
 */
import { useState, useEffect, useCallback } from 'react'
import { Form, Input, Button, Checkbox, App } from 'antd'
import { SafetyOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'
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

const FIELD_STYLE: React.CSSProperties = { height: 40, borderRadius: 'var(--r-2)' }

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
  // 内联错误：错误不只在顶部 toast 一闪而过，表单里留一行
  const [errorText, setErrorText] = useState('')
  // Turnstile token：拿不到时留空，服务端会按故障降级逻辑处理
  const [tsToken, setTsToken] = useState('')
  const onTsToken = useCallback((tok: string) => setTsToken(tok), [])
  const { hostRef: tsHost, status: tsStatus, reset: tsReset } = useTurnstile(
    onTsToken,
    mode === 'register',
  )

  // 人机验证没过 / 加载失败都由按钮点击时拦截（不再用禁用态 + 空洞占位）
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
      // 一次性 pending → AppShell 消费并弹欢迎卡；不打 toast（避免欢迎卡前又「欢迎」一次）
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

  const features = [t('auth.f1'), t('auth.f2'), t('auth.f3')]

  const errorLine = errorText ? (
    <div
      role="alert"
      style={{
        background: 'var(--danger-wash)',
        border: '1px solid var(--danger)',
        borderRadius: 'var(--r-2)',
        padding: '8px 12px',
        marginBottom: 16,
        fontSize: 'var(--text-xs)',
        lineHeight: 1.5,
        color: 'var(--danger)',
      }}
    >
      {errorText}
    </div>
  ) : null

  const tabs = (
    <div style={{ display: 'flex', gap: 20, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
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
            fontSize: 'var(--text-sm)',
            fontWeight: mode === k ? 600 : 400,
            color: mode === k ? 'var(--ink)' : 'var(--ink-muted)',
            borderBottom: mode === k ? '2px solid var(--accent)' : '2px solid transparent',
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
          style={FIELD_STYLE}
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
          style={FIELD_STYLE}
        />
      </Form.Item>
      <Form.Item style={{ marginBottom: 16 }}>
        <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
            {t('auth.remember')}
          </span>
        </Checkbox>
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={loading} style={{ height: 40 }}>
        {t('auth.login')}
      </Button>
    </Form>
  )

  const registerPane = (
    <>
      {regOpen === false && (
        <div
          style={{
            background: 'var(--warning-wash)',
            border: '1px solid var(--warning)',
            borderRadius: 'var(--r-2)',
            padding: '8px 12px',
            marginBottom: 16,
            fontSize: 'var(--text-xs)',
            lineHeight: 1.5,
            color: 'var(--ink)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{t('auth.reg.closedTitle')}</div>
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
            { pattern: /^[A-Za-z0-9_]{3,20}$/, message: t('auth.err.usernamePattern') },
          ]}
        >
          <Input
            placeholder={t('auth.reg.username')}
            autoComplete="username"
            aria-label={t('auth.reg.username')}
            style={FIELD_STYLE}
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
            style={FIELD_STYLE}
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
            style={FIELD_STYLE}
          />
        </Form.Item>
        <Form.Item
          name="contact"
          rules={[{ max: 120, message: t('auth.err.contactMax') }]}
          style={{ marginBottom: 12 }}
        >
          <Input
            placeholder={t('auth.reg.contact')}
            autoComplete="email"
            aria-label={t('auth.reg.contact')}
            style={FIELD_STYLE}
          />
        </Form.Item>

        {/* 人机验证：Turnstile 显式渲染的宿主；脚本没就绪时不占位（v2 这里留了 65px 空洞） */}
        <div style={{ marginBottom: 8 }}>
          <div ref={tsHost} />
          {tsStatus === 'loading' && (
            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-faint)', lineHeight: 1.5 }}>
              {t('auth.reg.ts.loading')}
            </div>
          )}
          {tsStatus === 'failed' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 'var(--text-2xs)',
                color: 'var(--danger)',
              }}
            >
              <SafetyOutlined />
              {t('auth.reg.ts.failed')}
            </div>
          )}
          {tsStatus === 'unavailable' && (
            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-muted)', lineHeight: 1.5 }}>
              {t('auth.reg.ts.unavailable')}
              <Button
                type="link"
                size="small"
                style={{ padding: '0 0 0 4px', fontSize: 'var(--text-2xs)' }}
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
          disabled={regOpen === false}
          style={{ height: 40 }}
        >
          {t('auth.reg.submit')}
        </Button>
        <p
          className="faint"
          style={{ marginTop: 12, marginBottom: 0, fontSize: 'var(--text-2xs)', lineHeight: 1.6 }}
        >
          {t('auth.reg.privacy')}
        </p>
      </Form>
    </>
  )

  return (
    <div className="login-page">
      {/* 左栏（≥960px 显示）：品牌只在这里出现一次 */}
      <div className="login-brand">
        <div style={{ maxWidth: 380 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            <span className="app-brand-dot" aria-hidden />
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--ink)' }}>
              {t('auth.brand')}
            </span>
          </div>
          <h1
            style={{
              fontSize: 'var(--text-2xl)',
              lineHeight: 1.2,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              margin: '0 0 12px',
              color: 'var(--ink)',
            }}
          >
            {t('auth.hero.title')}
          </h1>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              lineHeight: 1.7,
              color: 'var(--ink-muted)',
              margin: '0 0 28px',
            }}
          >
            {t('auth.hero.subtitle')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {features.map((text, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 'var(--text-xs)', lineHeight: 1.6, color: 'var(--ink-muted)' }}>
                  {text}
                </span>
              </div>
            ))}
          </div>
          <div className="faint" style={{ marginTop: 40, fontSize: 'var(--text-2xs)', lineHeight: 1.6 }}>
            {t('auth.footerNote')}
          </div>
        </div>
      </div>

      {/* 右栏：画布 + 白卡表单 */}
      <div className="login-form-side">
        <div className="login-card">
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: '0 0 6px', color: 'var(--ink)' }}>
            {t('auth.welcome')}
          </h2>
          <p className="muted" style={{ fontSize: 'var(--text-xs)', margin: '0 0 20px', lineHeight: 1.6 }}>
            {t('auth.hint')}
          </p>

          {tabs}
          {errorLine}
          {mode === 'login' ? loginPane : registerPane}

          <p
            className="faint"
            style={{ marginTop: 20, marginBottom: 0, fontSize: 'var(--text-2xs)', lineHeight: 1.7 }}
          >
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
          {/* 刻意不放「管理员入口」：/admin 由运营方单独告知地址，
              出现在用户界面会让普通用户误点后看到「无权访问」。 */}
        </div>
      </div>
    </div>
  )
}
