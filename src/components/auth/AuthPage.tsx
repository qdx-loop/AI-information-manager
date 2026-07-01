import { useState, useEffect } from 'react'
import { Card, Form, Input, Button, Tabs, Checkbox, App } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'

export default function AuthPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { login, register, account } = useAuthStore()
  const [mode, setMode] = useState<'login' | 'register'>('login')
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
      if (mode === 'login') {
        await login(values.username, values.password, remember)
        message.success('登录成功')
      } else {
        await register(values.username, values.password, remember)
        message.success('注册并登录成功')
      }
      navigate('/')
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card style={{ width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 24 }}>信息管理</h2>
        <Tabs
          activeKey={mode}
          onChange={(k) => setMode(k as 'login' | 'register')}
          items={[
            { key: 'login', label: '登录' },
            { key: 'register', label: '注册' },
          ]}
          centered
        />
        <Form
          form={form}
          onFinish={onFinish}
          layout="vertical"
          size="large"
          validateTrigger={['onSubmit', 'onChange']}
        >
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input
              prefix={<UserOutlined />}
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
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              aria-label="密码"
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 12 }}>
            <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)}>
              记住登录状态
            </Checkbox>
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            {mode === 'login' ? '登录' : '注册并登录'}
          </Button>
        </Form>
        <p style={{ textAlign: 'center', marginTop: 12, color: '#999', fontSize: 12 }}>
          {mode === 'login'
            ? '勾选「记住登录状态」可关闭浏览器后仍保持登录'
            : '注册后自动登录并进入应用'}
        </p>
      </Card>
    </div>
  )
}
