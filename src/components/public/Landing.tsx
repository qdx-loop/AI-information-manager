import { Button, Card, Space, Tag, Typography } from 'antd'
import { LoginOutlined, WechatOutlined } from '@ant-design/icons'
import { SITE } from '@/config/site'

const { Title, Text, Paragraph } = Typography

/**
 * 公开落地页：所有推广渠道的安全着陆点（未登录时访问根路径展示）。
 * 内容来自 src/config/site.ts，卖家自行维护。
 */
export default function Landing() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #F0FDFA 0%, #FFFFFF 320px)',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 64px' }}>
        {/* 顶栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 }}>
          <Space align="center">
            <span style={{ width: 14, height: 14, borderRadius: 4, background: '#0D9488', display: 'inline-block' }} />
            <Text strong style={{ fontSize: 16, color: '#134E4A' }}>{SITE.brand}</Text>
          </Space>
          <Button type="primary" icon={<LoginOutlined />} href="#/login">
            登录使用
          </Button>
        </div>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <Tag color="teal" style={{ marginBottom: 12 }}>AI 驱动 · 数据存在自己设备里</Tag>
          <Title level={1} style={{ fontSize: 36, marginBottom: 12 }}>{SITE.slogan}</Title>
          <Paragraph type="secondary" style={{ fontSize: 16, maxWidth: 560, margin: '0 auto 24px' }}>
            {SITE.subtitle}
          </Paragraph>
          <Space size="middle" wrap style={{ justifyContent: 'center', display: 'flex' }}>
            <Button type="primary" size="large" icon={<LoginOutlined />} href="#/login">
              立即登录使用
            </Button>
            <Button size="large" href="#price">
              查看价格
            </Button>
          </Space>
        </div>

        {/* 功能亮点 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 56 }}>
          {SITE.features.map((f) => (
            <Card key={f.title} size="small" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32 }}>{f.icon}</div>
              <Text strong style={{ display: 'block', margin: '8px 0 4px' }}>{f.title}</Text>
              <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }}>{f.desc}</Paragraph>
            </Card>
          ))}
        </div>

        {/* 三步上手 */}
        <Card size="small" style={{ marginBottom: 56 }}>
          <Title level={4} style={{ textAlign: 'center' }}>三步上手</Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {SITE.steps.map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#0D9488',
                    color: '#fff',
                    lineHeight: '32px',
                    margin: '0 auto 8px',
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </div>
                <Text>{s}</Text>
              </div>
            ))}
          </div>
        </Card>

        {/* 价格 */}
        <div id="price" style={{ marginBottom: 56 }}>
          <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>卡种价格</Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {SITE.prices.map((p) => (
              <Card key={p.name} size="small" style={{ textAlign: 'center' }}>
                <Text strong>{p.name}</Text>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#0D9488', margin: '6px 0 2px' }}>{p.price}</div>
                <Text type="secondary">{p.days}</Text>
                {p.note && (
                  <div style={{ marginTop: 6 }}>
                    <Tag color="green">{p.note}</Tag>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* 联系方式 */}
        <Card id="contact" size="small" style={{ textAlign: 'center', border: '1px solid #99F6E4' }}>
          <WechatOutlined style={{ fontSize: 28, color: '#0D9488' }} />
          <Title level={4} style={{ margin: '8px 0 4px' }}>购买 / 免费试用</Title>
          <Paragraph type="secondary" style={{ marginBottom: 8 }}>
            {SITE.contactNote}
          </Paragraph>
          {SITE.qrImage && (
            <img
              src={SITE.qrImage}
              alt="二维码"
              width={160}
              height={160}
              style={{ borderRadius: 8, border: '1px solid #eee' }}
            />
          )}
          <div style={{ marginTop: 8 }}>
            <Text code copyable style={{ fontSize: 18 }}>
              {SITE.contactWechat}
            </Text>
          </div>
          <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
            已有账号？<a href="#/login">直接登录 →</a>
          </Paragraph>
        </Card>

        <Paragraph type="secondary" style={{ textAlign: 'center', fontSize: 12, marginTop: 40 }}>
          © {new Date().getFullYear()} {SITE.brand} · 数据由你的账号独立隔离
        </Paragraph>
      </div>
    </div>
  )
}
