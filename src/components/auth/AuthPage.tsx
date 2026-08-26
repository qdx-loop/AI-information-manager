import { useState, useEffect } from 'react'
import { Form, Input, Button, Checkbox, App } from 'antd'
import {
  UserOutlined,
  LockOutlined,
  MessageOutlined,
  DatabaseOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'
import { useI18n } from '@/i18n'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

const BRAND = '#0D9488'

export default function AuthPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { login, account } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [remember, setRemember] = useState(false)
  const [form] = Form.useForm<{ username: string; password: string }>()
  const t = useI18n()

  // 如果 init() 在跳转到 /login 后才完成恢复，自动跳回主页
  useEffect(() => {
    if (account) navigate('/', { replace: true })
  }, [account, navigate])

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const acc = await login(values.username, values.password, remember)
      message.success(
        acc.expiresAt
          ? t('auth.ok.expires', { time: dayjs(acc.expiresAt).format('YYYY-MM-DD HH:mm') })
          : t('auth.ok.plain'),
      )
      navigate('/')
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: <MessageOutlined />, text: t('auth.f1') },
    { icon: <DatabaseOutlined />, text: t('auth.f2') },
    { icon: <BarChartOutlined />, text: t('auth.f3') },
  ]

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 36 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: BRAND, display: 'inline-block' }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#134E4A' }}>{t('auth.brand')}</span>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', color: '#134E4A' }}>{t('auth.welcome')}</h2>
          <p style={{ color: '#475569', fontSize: 13, margin: '0 0 28px' }}>
            {t('auth.hint')}
          </p>

          <Form
            form={form}
            onFinish={onFinish}
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

          <p style={{ textAlign: 'center', marginTop: 28, color: '#475569', fontSize: 12, lineHeight: 1.8 }}>
            {t('auth.noAccount')}
            <br />
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
