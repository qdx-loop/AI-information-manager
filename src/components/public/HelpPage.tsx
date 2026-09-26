import { Card, Typography, Collapse, Space, Button } from 'antd'
import { SafetyOutlined, CloudOutlined, BellOutlined, SyncOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'

const { Title, Paragraph, Text } = Typography

// 买家帮助页：售前售后高频问题集中回答（数据存哪/安全吗/到期怎么办/如何跨设备/提醒机制）
export default function HelpPage() {
  const t = useI18n()
  const navigate = useNavigate()

  const items = [
    { key: 'data', label: <Space><SafetyOutlined style={{ color: '#0D9488' }} />{t('help.q.data')}</Space>, children: <Paragraph style={{ marginBottom: 0 }}>{t('help.a.data')}</Paragraph> },
    { key: 'expire', label: <Space><BellOutlined style={{ color: '#0D9488' }} />{t('help.q.expire')}</Space>, children: <Paragraph style={{ marginBottom: 0 }}>{t('help.a.expire')}</Paragraph> },
    { key: 'sync', label: <Space><SyncOutlined style={{ color: '#0D9488' }} />{t('help.q.sync')}</Space>, children: <Paragraph style={{ marginBottom: 0 }}>{t('help.a.sync')}</Paragraph> },
    { key: 'cloud', label: <Space><CloudOutlined style={{ color: '#0D9488' }} />{t('help.q.cloud')}</Space>, children: <Paragraph style={{ marginBottom: 0 }}>{t('help.a.cloud')}</Paragraph> },
    { key: 'tips', label: t('help.q.tips'), children: <Paragraph style={{ marginBottom: 0 }}>{t('help.a.tips')}</Paragraph> },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#F0FDFA', padding: '48px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Card>
          <Title level={3} style={{ marginTop: 0 }}>{t('help.title')}</Title>
          <Text type="secondary">{t('help.subtitle')}</Text>
          <Collapse items={items} defaultActiveKey={['data']} style={{ marginTop: 20 }} />
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Space>
              <Button type="primary" onClick={() => navigate('/')}>{t('help.backHome')}</Button>
            </Space>
          </div>
        </Card>
      </div>
    </div>
  )
}
