import { useState, useEffect } from 'react'
import { Card, Form, Input, Button, Tabs, Checkbox, App, Collapse, Alert } from 'antd'
import { UserOutlined, LockOutlined, CloudOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'
import { useNavigate } from 'react-router-dom'
import { initFromSettings, pullCloudToLocal } from '@/db/providerFactory'
import { decodeSyncCode } from '@/utils/syncCode'

export default function AuthPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { login, register, account } = useAuthStore()
  const { settings, setCloud, setStorageMode } = useAppStore()
  const { setAI } = useAppStore()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [remember, setRemember] = useState(false)
  const [cloudSync, setCloudSync] = useState(false)
  const [cloudUrl, setCloudUrl] = useState(settings.cloud.url)
  const [cloudKey, setCloudKey] = useState(settings.cloud.anonKey)
  const [form] = Form.useForm<{ username: string; password: string }>()

  // 如果 init() 在跳转到 /login 后才完成恢复，自动跳回主页
  useEffect(() => {
    if (account) navigate('/', { replace: true })
  }, [account, navigate])

  const onFinish = async (values: { username: string; password: string }) => {
    // 云端同步模式：先验证配置
    const prevMode = useAppStore.getState().settings.storageMode
    const prevCloud = { ...useAppStore.getState().settings.cloud }
    if (cloudSync) {
      if (!cloudUrl.trim() || !cloudKey.trim()) {
        message.warning('请填写 Supabase 连接信息')
        return
      }
    }

    setLoading(true)
    try {
      if (cloudSync) {
        // 保存云端配置并切换到 cloud 模式
        setCloud({ url: cloudUrl.trim(), anonKey: cloudKey.trim() })
        setStorageMode('cloud')
        const updated = useAppStore.getState().settings
        initFromSettings(updated)
      }

      if (mode === 'login') {
        await login(values.username, values.password, remember)
      } else {
        await register(values.username, values.password, remember)
      }

      // 云端模式：登录后拉取数据到本地缓存
      if (cloudSync) {
        const accId = useAuthStore.getState().account?.id
        if (accId) {
          try {
            await pullCloudToLocal(accId)
            message.success('登录成功，云端数据已同步')
          } catch {
            message.warning('登录成功，但云端数据同步失败')
          }
        }
      } else {
        message.success(mode === 'login' ? '登录成功' : '注册并登录成功')
      }

      navigate('/')
    } catch (e) {
      message.error((e as Error).message)
      // 云端登录失败，回滚到之前的模式
      if (cloudSync) {
        setCloud(prevCloud)
        setStorageMode(prevMode)
        initFromSettings(useAppStore.getState().settings)
      }
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
      <Card style={{ width: '100%', maxWidth: 380, margin: '0 12px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
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

          {/* 云端同步选项 */}
          {cloudUrl.trim() && cloudKey.trim() ? (
            // 已保存云端配置：直接显示复选框
            <Form.Item style={{ marginBottom: 12 }}>
              <Checkbox checked={cloudSync} onChange={(e) => setCloudSync(e.target.checked)}>
                <CloudOutlined style={{ marginRight: 4 }} />
                云端同步（{cloudUrl.trim().replace(/^https?:\/\//, '').split('.')[0]}）
              </Checkbox>
            </Form.Item>
          ) : null}

          <Collapse
            ghost
            size="small"
            style={{ marginBottom: 8, marginLeft: -8, marginRight: -8 }}
            items={[
              {
                key: 'cloud',
                label: (
                  <span style={{ fontSize: 13 }}>
                    <CloudOutlined style={{ marginRight: 4 }} />
                    云端同步登录
                  </span>
                ),
                children: (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 8, fontSize: 12 }}
                      message="粘贴从其他设备获取的同步码，自动填入云端和 AI 配置。"
                    />
                    <Form.Item label="同步码" style={{ marginBottom: 8 }}>
                      <Input.Search
                        placeholder="粘贴同步码"
                        enterButton="填入"
                        size="middle"
                        onSearch={(val) => {
                          const decoded = decodeSyncCode(val)
                          if (decoded) {
                            setCloudUrl(decoded.cloudUrl)
                            setCloudKey(decoded.cloudKey)
                            setCloudSync(true)
                            if (decoded.aiBaseUrl || decoded.aiApiKey || decoded.aiModel) {
                              setAI({ baseUrl: decoded.aiBaseUrl, apiKey: decoded.aiApiKey, model: decoded.aiModel })
                              message.success('已填入云端和 AI 配置')
                            } else {
                              message.success('已填入云端配置')
                            }
                          } else {
                            message.error('同步码无效或已损坏')
                          }
                        }}
                      />
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />

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
