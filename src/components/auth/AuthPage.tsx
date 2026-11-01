/**
 * 登录 / 注册 · v4「硬边印刷 SIGNAL PRESS」
 *
 * 结构：`.auth-page`（5fr / 6fr）
 *   左 `.auth-poster` = 墨黑海报：lime 几何标 + mono kicker `SIGNAL PRESS` + Outfit 800
 *     标题（关键词用 `<em>` lime 底块）+ 3 条 mono 说明 + 底部 mono 版权。
 *   右 `.auth-form-side` = 骨白画布上 400px `.auth-card`（2px ink 边 + shadow-3 + 0 圆角）。
 *
 * 三条不可退让的行为约束（与视觉无关，契约 §8.6）：
 * 1) 品牌只出现一次（海报即品牌），表单卡里不再重复 logo/名字；
 * 2) Turnstile 未就绪时不预留空洞，按钮可点、点击时才提示（回车提交同样拦截）；
 * 3) 注册成功先 `markWelcomePending()` 再 navigate，**不弹注册成功 toast**
 *    （否则欢迎卡 0.5s 内会再「欢迎」一次）。
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

/** ≥961px 才显示海报底部装饰（移动端 CSS 是单列短版） */
function useMinWidth(min: number): boolean {
  const [ok, setOk] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia(`(min-width:${min}px)`).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(`(min-width:${min}px)`)
    const onChange = () => setOk(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [min])
  return ok
}

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
  const posterWide = useMinWidth(961)
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

  // 人机验证没过 / 加载失败都由提交时拦截（不占位、不禁用整张表单）
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
    <div
      role="alert"
      style={{
        background: 'var(--danger-wash)',
        border: '2px solid var(--danger)',
        padding: '8px 12px',
        marginBottom: 16,
        fontSize: 'var(--t-xs)',
        lineHeight: 1.45,
        color: 'var(--danger)',
      }}
    >
      {errorText}
    </div>
  ) : null

  // 方块 Tabs：两格等宽、2px ink 边、选中 lime 底
  const tabs = (
    <div style={{ display: 'flex', marginBottom: 20 }}>
      {(['login', 'register'] as const).map((k, i) => {
        const active = mode === k
        return (
          <button
            key={k}
            type="button"
            onClick={() => switchMode(k)}
            style={{
              flex: 1,
              height: 'var(--control-h)',
              marginLeft: i === 0 ? 0 : -2,
              border: '2px solid var(--line)',
              background: active ? 'var(--lime)' : 'var(--sheet)',
              color: active ? 'var(--on-lime)' : 'var(--ink-soft)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--t-2xs)',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
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
      validateTrigger={['onSubmit', 'onChange']}
      requiredMark={false}
    >
      <Form.Item name="username" label={t('auth.username')} rules={[{ required: true, message: t('auth.err.username') }]}>
        <Input
          placeholder={t('auth.username')}
          autoComplete="username"
          aria-label={t('auth.username')}
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
      <Form.Item style={{ marginBottom: 16 }}>
        <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)}>
          <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
            {t('auth.remember')}
          </span>
        </Checkbox>
      </Form.Item>
      <Button
        type="primary"
        htmlType="submit"
        block
        loading={loading}
        style={{ height: 'var(--control-h-lg)' }}
      >
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
            border: '2px solid var(--warning)',
            padding: '8px 12px',
            marginBottom: 16,
            fontSize: 'var(--t-xs)',
            lineHeight: 1.45,
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
          label={t('auth.reg.usernameLabel')}
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
          style={{ marginBottom: 12 }}
        >
          <Input
            placeholder={t('auth.reg.contact')}
            autoComplete="email"
            aria-label={t('auth.reg.contact')}
          />
        </Form.Item>

        {/* Turnstile 宿主：脚本未就绪时只有一行状态，不占固定高度 */}
        <div style={{ marginBottom: 8 }}>
          <div ref={tsHost} />
          {tsStatus === 'loading' && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-faint)' }}>
              {t('auth.reg.ts.loading')}
            </div>
          )}
          {tsStatus === 'failed' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--danger)',
              }}
            >
              <SafetyOutlined />
              {t('auth.reg.ts.failed')}
            </div>
          )}
          {tsStatus === 'unavailable' && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-soft)', lineHeight: 1.5 }}>
              {t('auth.reg.ts.unavailable')}
              <Button
                type="link"
                size="small"
                style={{ padding: '0 0 0 4px', fontSize: 'var(--t-2xs)' }}
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
          style={{ height: 'var(--control-h-lg)' }}
        >
          {t('auth.reg.submit')}
        </Button>
        <p
          style={{
            marginTop: 12,
            marginBottom: 0,
            fontSize: 'var(--t-xs)',
            lineHeight: 1.5,
            color: 'var(--ink-soft)',
          }}
        >
          {t('auth.reg.privacy')}
        </p>
      </Form>
    </>
  )

  const features = [t('auth.f1'), t('auth.f2'), t('auth.f3')]

  return (
    <div className="auth-page">
      {/* 左：墨黑海报（品牌只在这里出现） */}
      <aside className="auth-poster" style={{ justifyContent: 'flex-start' }}>
        <div className="auth-brand">
          <span className="rail-mark" aria-hidden />
          {t('auth.brand')}
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minHeight: 0,
          }}
        >
          <div className="auth-poster-kicker">{t('auth.poster.kicker')}</div>
          {/* 固定两层：第一行普通色，第二行整块 lime —— 高亮短语绝不跨行断成单字 */}
          <h1
            className="auth-poster-title"
            style={{ fontSize: 'clamp(36px, 4vw, 56px)', maxWidth: '100%' }}
          >
            <span style={{ display: 'block', whiteSpace: 'nowrap' }}>{t('auth.poster.pre')}</span>
            <span style={{ display: 'block' }}>
              <em style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>{t('auth.poster.mark')}</em>
              <span>{t('auth.poster.post')}</span>
            </span>
          </h1>
          <div className="auth-poster-list">
            {features.map((text, i) => (
              <div key={i} className="auth-poster-item">
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* 底部视觉锚点：印刷对位标 + 一块 lime（移动端隐藏） */}
        {posterWide && (
          <div
            aria-hidden
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 10,
              marginBottom: 32,
            }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 44,
                  height: 44,
                  border: '2px solid var(--on-ink)',
                  background: 'transparent',
                }}
              />
            ))}
            <span
              style={{
                width: 92,
                height: 44,
                background: 'var(--lime)',
                border: '2px solid var(--on-ink)',
              }}
            />
            <span
              style={{
                flex: 1,
                height: 2,
                background: 'var(--on-ink)',
                opacity: 0.35,
                marginBottom: 21,
              }}
            />
          </div>
        )}

        <div className="auth-poster-foot">
          <span>© {new Date().getFullYear()} {t('auth.brand')}</span>
          <span>aiim.de5.net</span>
        </div>
      </aside>

      {/* 右：骨白画布 + 表单卡 */}
      <main className="auth-form-side">
        <div className="auth-card">
          <div className="auth-card-head">
            <h2 className="auth-card-title">{t('auth.welcome')}</h2>
            <p className="auth-card-sub">{t('auth.hint')}</p>
          </div>

          {tabs}
          {errorLine}
          {mode === 'login' ? loginPane : registerPane}

          <div className="auth-foot">
            {!inApp && (
              <button
                type="button"
                onClick={() => navigate('/')}
              >
                {t('auth.backHome')}
              </button>
            )}
            <span>{t('auth.cloudHint')}</span>
          </div>
          {/* 刻意不放「管理员入口」：/admin 由运营方单独告知地址，
              出现在用户界面会让普通用户误点后看到「无权访问」。 */}
        </div>
      </main>
    </div>
  )
}
