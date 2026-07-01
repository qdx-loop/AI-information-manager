import { Result, Button, Card, Typography } from 'antd'
import { AppstoreAddOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useLibraryStore } from '@/store/libraryStore'
import { useAuthStore } from '@/store/authStore'
import { App } from 'antd'

const { Paragraph } = Typography

export default function EmptyHome() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { account } = useAuthStore()
  const { libraries, createLibrary, selectLibrary, loadLibraries } = useLibraryStore()

  const handleCreate = async () => {
    const id = await createLibrary('未命名管理库')
    await loadLibraries()
    await selectLibrary(id)
    navigate(`/library/${id}`)
    message.success('已创建，请重命名并配置字段模板')
  }

  return (
    <div style={{ padding: 24, height: '100%' }}>
      <Card>
        <Result
          icon={<AppstoreAddOutlined style={{ color: '#1677ff' }} />}
          title={`你好，${account?.username ?? ''}`}
          subTitle={
            libraries.length === 0
              ? '还没有管理库，从创建第一个开始吧'
              : '请从左侧选择一个管理库，或创建新的'
          }
          extra={
            <Button type="primary" size="large" icon={<AppstoreAddOutlined />} onClick={handleCreate}>
              创建管理库
            </Button>
          }
        />
        <Paragraph type="secondary" style={{ textAlign: 'center' }}>
          可在「设置」中开启云端存储实现跨设备同步，或配置 AI 助手辅助管理数据。
        </Paragraph>
      </Card>
    </div>
  )
}
