import { useEffect, useMemo, useState } from 'react'
import { Result, Button, Card, Typography, Alert, Input, Modal, App, Select } from 'antd'
import { AppstoreAddOutlined, WarningOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useLibraryStore } from '@/store/libraryStore'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'
import { useI18n } from '@/i18n'
import { LIB_TEMPLATES, applyTemplate, copyTemplateToLibrary } from '@/utils/libraryTemplates'
import { getProvider } from '@/db/providerFactory'
import HomeDashboard from './HomeDashboard'
import GettingStarted from './GettingStarted'

const { Paragraph } = Typography

// iOS Safari 会对"7 天未使用"的网站清除本地存储（含 IndexedDB）。
// 本地模式下数据只存在浏览器里，必须提醒买家开启云同步或定期导出备份（红队报告 P6）。
function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document)
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|EdgiOS|FxiOS|Opt/.test(ua)
  const standalone =
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  return isIOS && isSafari && !standalone
}

const RISK_KEY = 'info-mgmt-safari-risk-dismissed'

export default function EmptyHome() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const t = useI18n()
  const { account } = useAuthStore()
  const { settings } = useAppStore()
  const { libraries, createLibrary, selectLibrary, loadLibraries } = useLibraryStore()

  // 建库命名弹窗（替代原先一键创建"未命名管理库"的草率路径）
  const [namingOpen, setNamingOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [tplKey, setTplKey] = useState('blank')
  const [parentId, setParentId] = useState<string | null>(null)

  const safariRisk = useMemo(
    () => settings.storageMode === 'local' && isIosSafari(),
    [settings.storageMode],
  )
  const [riskDismissed, setRiskDismissed] = useState(true)
  useEffect(() => {
    setRiskDismissed(localStorage.getItem(RISK_KEY) === '1')
  }, [])

  const openNaming = () => {
    setNewName('')
    setParentId(null)
    setNamingOpen(true)
  }

  const handleCreate = async () => {
    const name = newName.trim() || '未命名管理库'
    setCreating(true)
    try {
      const id = await createLibrary(name, undefined, parentId)
      const tpl = LIB_TEMPLATES.find((x) => x.key === tplKey)
      if (tpl && tpl.fields.length > 0) {
        await applyTemplate(id, tpl)
      } else if (parentId) {
        // 选了父库但未选行业模板：继承父库字段结构
        try {
          const parentTpl = await getProvider().getTemplate(parentId)
          if (parentTpl.length > 0) await copyTemplateToLibrary(parentTpl, id)
        } catch { /* 忽略 */ }
      }
      await loadLibraries()
      await selectLibrary(id)
      navigate(`/library/${id}`)
      message.success(
        tpl && tpl.fields.length > 0
          ? t('home.create.doneTpl', { name })
          : t('home.create.done', { name }),
      )
      setNamingOpen(false)
      setNewName('')
    } catch (e) {
      message.error(t('home.create.failed', { msg: (e as Error).message }))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{ padding: 24, height: '100%' }}>
      <Card>
        {safariRisk && !riskDismissed && (
          <Alert
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            style={{ marginBottom: 16 }}
            message={t('home.safari.title')}
            description={
              <span>
                {t('home.safari.body')}
              </span>
            }
            closable
            onClose={() => {
              localStorage.setItem(RISK_KEY, '1')
              setRiskDismissed(true)
            }}
          />
        )}

        <GettingStarted />

        {libraries.length > 0 ? (
          <>
            <Result
              icon={<AppstoreAddOutlined style={{ color: '#0D9488' }} />}
              title={t('home.greeting', { name: account?.username ?? '' })}
              subTitle={t('home.pick')}
              style={{ paddingBottom: 12 }}
            />
            <HomeDashboard />
          </>
        ) : (
          <>
            <Result
              icon={<AppstoreAddOutlined style={{ color: '#0D9488' }} />}
              title={t('home.greeting', { name: account?.username ?? '' })}
              subTitle={t('home.empty')}
              extra={
                <Button type="primary" size="large" icon={<AppstoreAddOutlined />} onClick={openNaming}>
                  {t('home.createFirst')}
                </Button>
              }
            />
            <Paragraph type="secondary" style={{ textAlign: 'center' }}>
              {t('home.tip')}
            </Paragraph>
          </>
        )}
      </Card>

      <Modal
        title={t('home.create.modalTitle')}
        open={namingOpen}
        onOk={handleCreate}
        onCancel={() => setNamingOpen(false)}
        okText={t('home.create.ok')}
        confirmLoading={creating}
      >
        <Input
          placeholder={t('home.create.placeholder')}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onPressEnter={handleCreate}
          autoFocus
          style={{ marginTop: 8 }}
        />
        <Select
          value={parentId ?? undefined}
          onChange={(v) => setParentId(v ?? null)}
          allowClear
          placeholder={t('home.create.parentHint')}
          style={{ width: '100%', marginTop: 12 }}
          options={(() => {
            const sorted = [...libraries].sort((a, b) => a.sortOrder - b.sortOrder)
            const byParent = new Map<string | null, typeof sorted>()
            for (const l of sorted) byParent.set(l.parentId ?? null, [...(byParent.get(l.parentId ?? null) ?? []), l])
            const out: { label: string; value: string }[] = []
            const walk = (pid: string | null, depth: number) => {
              for (const l of byParent.get(pid) ?? []) {
                out.push({ label: `${'　'.repeat(depth)}${l.name}（${l.category}）`, value: l.id })
                walk(l.id, depth + 1)
              }
            }
            walk(null, 0)
            return out
          })()}
        />
        <Select
          value={tplKey}
          onChange={setTplKey}
          style={{ width: '100%', marginTop: 12 }}
          options={LIB_TEMPLATES.map((t) => ({
            label: `${t.name} · ${t.desc}`,
            value: t.key,
          }))}
          listHeight={260}
        />
        <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          {t('home.create.tplHint')}
        </Paragraph>
      </Modal>
    </div>
  )
}
