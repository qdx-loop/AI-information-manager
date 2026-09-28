import { useState, useEffect, useCallback } from 'react'
import { Form, Input, Button, Checkbox, App, Tabs, Alert, Spin } from 'antd'
import {
  UserOutlined,
  LockOutlined,
  MessageOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  MailOutlined,
  SafetyOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'
import { apiRegistrationOpen } from '@/lib/serverApi'
import { useI18n } from '@/i18n'
import { useNavigate } from 'react-router-dom'
import { useTurnstile } from './useTurnstile'

const BRAND = '#0D9488'

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
  const { login, register, account } = useAuthStore()
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loginForm] = Form.useForm<{ username: string; password: string }>()
  const [regForm] = Form.useForm<RegisterValues>()
  const t = useI18n()
  const [regOpen, setRegOpen] = useState<boolean | null>(null)
  // Turnstile token：拿不到时留空，服务端会按故障降级逻辑处理
  const [tsToken, setTsToken] = useState('')
  const onTsToken = useCallback((tok: string) => setTsToken(tok), [])
  const { hostRef: tsHost, status: tsStatus, reset: tsReset } = useTurnstile(onTsToken)

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
      setMode(next)
      loginForm.resetFields()
      regForm.resetFields()
    },
    [loginForm, regForm],
  )

  const onLogin = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      await login(values.username, values.password, remember)
      message.success(t('auth.ok.plain'))
      navigate('/')
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const onRegister = async (values: RegisterValues) => {
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
      message.error((e as Error).message)
      // token 是一次性的，任何失败后都要重置 widget 才能重试
      tsReset()
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: <MessageOutlined />, text: t('auth.f1') },
    { icon: <DatabaseOutlined />, text: t('auth.f2') },
    { icon: <BarChartOutlined />, text: t('auth.f3') },
  ]

  const loginPane = (
    <Form
      form={loginForm}
      onFinish={onLogin}
      layout="vertical"
      size="large"
      validateTrigger={['onSubmit', 'onChange']}
      requiredMark={false}
    >
      <Form.Item name="username" rules={[{ required: true, message: t('auth.err.username') }]}>
        <Input
          prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
          placeholder={t('auth.username')}
          autoComplete="username"
          aria-label={t('auth.username')}
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
          prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
          placeholder={t('auth.password')}
          autoComplete="current-password"
          aria-label={t('auth.password')}
        />
      </Form.Item>
      <Form.Item style={{ marginBottom: 16 }}>
        <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)}>
          <span style={{ fontSize: 13, color: '#475569' }}>{t('auth.remember')}</span>
        </Checkbox>
      </Form.Item>

      <Button type="primary" htmlType="submit" block loading={loading} style={{ fontWeight: 600 }}>
        {t('auth.login')}
      </Button>
    </Form>
  )

  const registerPane = (
    <>
      {regOpen === false && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('auth.reg.closedTitle')}
          description={t('auth.reg.closedBody')}
        />
      )}
      <Form
        form={regForm}
        onFinish={onRegister}
        layout="vertical"
        size="large"
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
            prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
            placeholder={t('auth.reg.username')}
            autoComplete="username"
            aria-label={t('auth.reg.username')}
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
            prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
            placeholder={t('auth.reg.password')}
            autoComplete="new-password"
            aria-label={t('auth.reg.password')}
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
            prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
            placeholder={t('auth.reg.confirm')}
            autoComplete="new-password"
            aria-label={t('auth.reg.confirm')}
          />
        </Form.Item>
        <Form.Item
          name="contact"
          rules={[{ max: 120, message: t('auth.err.contactMax') }]}
          style={{ marginBottom: 16 }}
        >
          <Input
            prefix={<MailOutlined style={{ color: '#94a3b8' }} />}
            placeholder={t('auth.reg.contact')}
            autoComplete="email"
            aria-label={t('auth.reg.contact')}
          />
        </Form.Item>

        {/* 人机验证：挡住脚本自动注册。脚本加载失败时显示降级提示并照常允许提交 */}
        <div style={{ marginBottom: 12, minHeight: 65 }}>
          <div ref={tsHost} />
          {tsStatus === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#94A3B8' }}>
              <Spin size="small" />
              {t('auth.reg.ts.loading')}
            </div>
          )}
          {tsStatus === 'failed' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#FA8C16' }}>
              <SafetyOutlined />
              {t('auth.reg.ts.failed')}
            </div>
          )}
          {tsStatus === 'unavailable' && (
            <div style={{ fontSize: 12, color: '#FA8C16', lineHeight: 1.6 }}>
              {t('auth.reg.ts.unavailable')}
              <Button
                type="link"
                size="small"
                style={{ padding: '0 0 0 6px', fontSize: 12 }}
                onClick={() => window.location.reload()}
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
          style={{ fontWeight: 600 }}
        >
          {t('auth.reg.submit')}
        </Button>
        <p style={{ marginTop: 12, marginBottom: 0, fontSize: 12, color: '#64748B', lineHeight: 1.7 }}>
          {t('auth.reg.privacy')}
        </p>
      </Form>
    </>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#F0FDFA' }}>
      {/* 左侧品牌区（≥900px 显示） */}
      <div className="login-brand">
        <div style={{ maxWidth: 420 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 4,
                background: '#fff',
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>{t('auth.brand')}</span>
          </div>
          <h1 style={{ fontSize: 32, lineHeight: 1.35, fontWeight: 700, margin: '0 0 16px' }}>{t('auth.hero.title')}
          </h1>
          <p style={{ fontSize: 15, opacity: 0.92, margin: '0 0 36px', lineHeight: 1.7 }}>
            {t('auth.hero.subtitle')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {features.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  {f.icon}
                </span>
                <span style={{ fontSize: 14, lineHeight: '34px', opacity: 0.95 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 28, left: 64, fontSize: 12, opacity: 0.6 }}>
          {t('auth.footerNote')}
        </div>
      </div>

      {/* 右侧表单区 */}
      <div className="login-form-side">
        <div style={{ width: '100%', maxWidth: 320, padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: BRAND, display: 'inline-block' }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#134E4A' }}>{t('auth.brand')}</span>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', color: '#134E4A' }}>{t('auth.welcome')}</h2>
          <p style={{ color: '#475569', fontSize: 13, margin: '0 0 20px' }}>{t('auth.hint')}</p>

          <Tabs
            activeKey={mode}
            onChange={(k) => switchMode(k as Mode)}
            centered
            style={{ marginBottom: 8 }}
            items={[
              { key: 'login', label: t('auth.tab.login'), children: null },
              { key: 'register', label: t('auth.tab.register'), children: null },
            ]}
          />

          {mode === 'login' ? loginPane : registerPane}

          <p style={{ textAlign: 'center', marginTop: 24, color: '#475569', fontSize: 12, lineHeight: 1.8 }}>
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault()
                navigate('/')
              }}
            >
              {t('auth.backHome')}
            </a>
            <br />
            {t('auth.cloudHint')}
          </p>
        </div>
      </div>
    </div>
  )
}
