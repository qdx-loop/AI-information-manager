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

  // 如果 init() 在跳转到 /login 后才完成恢复，自动跳回主页
  useEffect(() => {
    if (account) navigate('/', { replace: true })
  }, [account, navigate])

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const acc = await login(values.username, values.password, remember)
      message.success(
        acc.expiresAt ? `登录成功，有效期至 ${dayjs(acc.expiresAt).format('YYYY-MM-DD HH:mm')}` : '登录成功',
      )
      navigate('/')
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: <MessageOutlined />, text: '自然语言操作数据，AI 帮你录入、检索、统计' },
    { icon: <DatabaseOutlined />, text: '自定义管理库与字段模板，想怎么管就怎么管' },
    { icon: <BarChartOutlined />, text: '一句话生成统计图表，随时下载保存' },
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
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>信息管理</span>
          </div>
          <h1 style={{ fontSize: 32, lineHeight: 1.35, fontWeight: 700, margin: '0 0 16px' }}>
            AI 智能信息管理助手
          </h1>
          <p style={{ fontSize: 15, opacity: 0.92, margin: '0 0 36px', lineHeight: 1.7 }}>
            用说话的方式管理你的数据。建库、录数据、查资料、出报表，都交给 AI。
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
          登录即代表同意合理使用本服务 · 数据由你的账号独立隔离
        </div>
      </div>

      {/* 右侧表单区 */}
      <div className="login-form-side">
        <div style={{ width: '100%', maxWidth: 320, padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 36 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: BRAND, display: 'inline-block' }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#134E4A' }}>信息管理</span>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', color: '#134E4A' }}>欢迎回来</h2>
          <p style={{ color: '#475569', fontSize: 13, margin: '0 0 28px' }}>
            请输入管理员发放的账号密码登录
          </p>

          <Form
            form={form}
            onFinish={onFinish}
            layout="vertical"
            size="large"
            validateTrigger={['onSubmit', 'onChange']}
            requiredMark={false}
          >
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input
                prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                placeholder="用户名"
                autoComplete="username"
                aria-label="用户名"
              />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少 6 位' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                placeholder="密码"
                autoComplete="current-password"
                aria-label="密码"
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 16 }}>
              <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)}>
                <span style={{ fontSize: 13, color: '#475569' }}>记住登录状态</span>
              </Checkbox>
            </Form.Item>

            <Button type="primary" htmlType="submit" block loading={loading} style={{ fontWeight: 600 }}>
              登 录
            </Button>
          </Form>

          <p style={{ textAlign: 'center', marginTop: 28, color: '#475569', fontSize: 12, lineHeight: 1.8 }}>
            没有账号？请联系管理员购买开通
            <br />
            云端同步请在登录后到「设置 → 存储」配置
          </p>
        </div>
      </div>
    </div>
  )
}
