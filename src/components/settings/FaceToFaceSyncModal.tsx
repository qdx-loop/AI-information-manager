import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal, Button, Space, Typography, Progress, Alert, Result } from 'antd'
import { SwapOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useI18n } from '@/i18n'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'
import { useLibraryStore } from '@/store/libraryStore'
import { exportBackup } from '@/db/backup'
import { mergeNativeIntoLocal, type MergeResult } from '@/db/syncService'
import { createSnapshot } from '@/db/snapshotService'
import { initFromSettings } from '@/db/providerFactory'
import { getSubStatus } from '@/utils/subscription'
import {
  P2PSession,
  P2PError,
  SIGNAL_PREFIX,
  b64EncodeUtf8,
  b64DecodeUtf8,
  type P2PProgress,
  type P2PErrorCode,
} from '@/utils/p2pTransfer'
import { apiSignalHost, apiSignalGuest, apiSignalPoll, apiSignalCancel, type P2PSignalRow } from '@/lib/serverApi'

const { Text } = Typography

type Stage =
  | 'choose'       // 选择发起/加入
  | 'waiting'      // 发起方：等待对端加入（自动轮询）
  | 'joining'      // 加入方：自动发现请求，待确认
  | 'transferring' // 双向传输中
  | 'done'         // 完成
  | 'error'        // 出错

interface Props {
  open: boolean
  onClose: () => void
}

// 本设备稳定标识（同一浏览器多标签页共享，用于区分两台设备）
function getDeviceId(): string {
  const KEY = 'info-mgmt-device-id'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}

/**
 * 局域网数据同步：两台设备登录同一账号、连同一 Wi-Fi。
 * 配对经服务器信令自动完成（offer/answer 中转，无二维码/无同步码）；
 * 数据经 WebRTC 数据通道在局域网内直连互传并合并，不经过任何服务器。
 */
export default function FaceToFaceSyncModal({ open, onClose }: Props) {
  const t = useI18n()
  const account = useAuthStore((s) => s.account)

  const [stage, setStage] = useState<Stage>('choose')
  const [progress, setProgress] = useState<P2PProgress>({ sent: 0, recv: 0 })
  const [peerUsername, setPeerUsername] = useState('')
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null)
  const [errorCode, setErrorCode] = useState<P2PErrorCode | 'BAD_PAYLOAD' | 'SIGNAL' | ''>('')
  const [busy, setBusy] = useState(false)
  const [pendingHost, setPendingHost] = useState<P2PSignalRow | null>(null) // 加入方发现的对端请求

  const sessionRef = useRef<P2PSession | null>(null)
  const deviceIdRef = useRef<string>('')
  const rowIdRef = useRef<string>('')
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const closedRef = useRef(false)
  const sentDoneRef = useRef(false)
  const recvDoneRef = useRef(false)
  const mergeResultRef = useRef<MergeResult | null>(null)

  const resetState = useCallback(() => {
    setStage('choose')
    setProgress({ sent: 0, recv: 0 })
    setPeerUsername('')
    setMergeResult(null)
    setErrorCode('')
    setBusy(false)
    setPendingHost(null)
    sentDoneRef.current = false
    recvDoneRef.current = false
    mergeResultRef.current = null
  }, [])

  const teardownSession = useCallback(() => {
    sessionRef.current?.close()
    sessionRef.current = null
  }, [])

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current != null) clearInterval(pollTimerRef.current)
    pollTimerRef.current = null
  }, [])

  // 关闭弹窗：释放会话、停止轮询、作废服务端信令
  useEffect(() => {
    if (open) {
      closedRef.current = false
      deviceIdRef.current = getDeviceId()
      return
    }
    closedRef.current = true
    stopPolling()
    teardownSession()
    void apiSignalCancel(deviceIdRef.current).catch(() => {})
  }, [open, stopPolling, teardownSession])

  useEffect(() => {
    return () => {
      closedRef.current = true
      stopPolling()
      teardownSession()
    }
  }, [stopPolling, teardownSession])

  const failWith = useCallback((code: P2PErrorCode | 'BAD_PAYLOAD' | 'SIGNAL') => {
    stopPolling()
    setErrorCode(code)
    setStage('error')
  }, [stopPolling])

  const maybeFinish = useCallback(() => {
    if (sentDoneRef.current && recvDoneRef.current) {
      setMergeResult(mergeResultRef.current)
      setStage('done')
    }
  }, [])

  // 收到对端完整负载 → 应用配置 + 合并数据进本机
  const handleReceivedPayload = useCallback(
    async (payload: string) => {
      if (!account) return
      // 只读宽限期内本机数据不允许被合并改写（对端不受影响，可继续发送）
      if (account.expiresAt != null && getSubStatus(account.expiresAt) === 'grace') {
        teardownSession()
        failWith('READ_ONLY')
        return
      }
      try {
        const data = JSON.parse(payload)
        const isEnvelope = data && data.type === 'f2f-data' && data.backup
        const backup = isEnvelope ? data.backup : data
        if (!backup || !Array.isArray(backup.libraries) || !Array.isArray(backup.items)) {
          throw new Error('bad payload')
        }

        // 同账号同局域网互信：把对端的 AI / 云端配置一并带入，本机与对端完全一致
        if (isEnvelope && data.config) {
          const cfg = data.config
          const app = useAppStore.getState()
          if (cfg.ai && (cfg.ai.baseUrl || cfg.ai.apiKey || cfg.ai.model || cfg.ai.usePlatformAI)) {
            app.setAI({
              baseUrl: cfg.ai.baseUrl || '',
              apiKey: cfg.ai.apiKey || '',
              model: cfg.ai.model || '',
              usePlatformAI: !!cfg.ai.usePlatformAI,
              memory: cfg.ai.memory || '',
              customPrompt: cfg.ai.customPrompt || '',
            })
          }
          if (cfg.cloud && cfg.cloud.url && cfg.cloud.anonKey) {
            app.setCloud({ url: cfg.cloud.url, anonKey: cfg.cloud.anonKey })
            if (cfg.storageMode === 'cloud') {
              app.setStorageMode('cloud')
              initFromSettings(useAppStore.getState().settings)
            }
          }
        }

        // 合并前自动拍一张快照（兜底，失败不阻断合并）
        try {
          await createSnapshot(account.id, 'transfer')
        } catch (e) {
          console.warn('[f2f] 合并前快照失败：', e)
        }
        const r = await mergeNativeIntoLocal(account.id, {
          libraries: backup.libraries,
          fields: Array.isArray(backup.fields) ? backup.fields : [],
          items: backup.items,
        })
        mergeResultRef.current = r
        recvDoneRef.current = true
        await useLibraryStore.getState().loadLibraries()
        await useLibraryStore.getState().refreshCurrent()
        useLibraryStore.getState().bumpDataVersion()
        maybeFinish()
      } catch {
        teardownSession()
        failWith('BAD_PAYLOAD')
      }
    },
    [account, maybeFinish, teardownSession, failWith],
  )

  const buildSession = useCallback(() => {
    if (!account) return null
    const session = new P2PSession(
      {
        onConnected: (name) => {
          setPeerUsername(name)
          setStage('transferring')
        },
        onProgress: (p) => setProgress(p),
        onReceivedPayload: (payload) => { void handleReceivedPayload(payload) },
        onSentComplete: () => {
          sentDoneRef.current = true
          maybeFinish()
        },
        onError: (err) => {
          const code = err instanceof P2PError ? err.code : 'CONNECT_FAILED'
          failWith(code)
        },
      },
      { accountId: account.id, username: account.username },
    )
    sessionRef.current = session
    return session
  }, [account, handleReceivedPayload, maybeFinish, failWith])

  // 生成本端待发送的完整负载：库数据 + 配置（AI / 云端连接）→ 局域网同步携带全部数据
  const makePayload = useCallback(async (): Promise<string> => {
    if (!account) return ''
    const blob = await exportBackup(account.id)
    const s = useAppStore.getState().settings
    const envelope = {
      type: 'f2f-data',
      version: 1,
      config: {
        storageMode: s.storageMode,
        cloud: { url: s.cloud.url, anonKey: s.cloud.anonKey },
        ai: {
          baseUrl: s.ai.baseUrl,
          apiKey: s.ai.apiKey,
          model: s.ai.model,
          usePlatformAI: !!s.ai.usePlatformAI,
          memory: s.ai.memory,
          customPrompt: s.ai.customPrompt,
        },
      },
      backup: { libraries: blob.libraries, fields: blob.fields, items: blob.items },
    }
    return JSON.stringify(envelope)
  }, [account])

  // —— 发起方：创建 offer → 发布到信令服务 → 轮询等 answer ——
  const startInitiate = useCallback(async () => {
    if (!account) return
    setBusy(true)
    try {
      const session = buildSession()
      if (!session) return
      const payload = await makePayload()
      const offer = await session.createOffer(payload)
      const rowId = await apiSignalHost(deviceIdRef.current, offer)
      rowIdRef.current = rowId
      setStage('waiting')

      // 每 2 秒轮询是否已有对端 answer
      let ticks = 0
      stopPolling()
      pollTimerRef.current = setInterval(async () => {
        if (closedRef.current) return stopPolling()
        if (++ticks > 300) return failWith('SIGNAL') // 10 分钟兜底
        try {
          const r = await apiSignalPoll(deviceIdRef.current)
          if (r.pending && r.signal?.answer && r.signal.status === 'done') {
            stopPolling()
            void session.acceptAnswer(r.signal.answer)
          }
        } catch {
          /* 单次轮询失败忽略，下轮重试 */
        }
      }, 2000)
    } catch (e) {
      const code = e instanceof P2PError ? e.code : 'SIGNAL'
      failWith(code)
    } finally {
      setBusy(false)
    }
  }, [account, buildSession, makePayload, stopPolling, failWith])

  // —— 加入方：轮询发现对端请求 → 用户确认 → 完成 answer 握手 ——
  const startJoinScan = useCallback(() => {
    setStage('joining')
    stopPolling()
    let ticks = 0
    pollTimerRef.current = setInterval(async () => {
      if (closedRef.current) return stopPolling()
      if (++ticks > 300) return failWith('SIGNAL')
      try {
        const r = await apiSignalPoll(deviceIdRef.current)
        if (r.pending && r.signal?.offer && r.signal.status === 'waiting') {
          stopPolling()
          setPendingHost(r.signal)
        }
      } catch {
        /* 忽略单次失败 */
      }
    }, 2000)
  }, [stopPolling, failWith])

  // 加入方确认加入
  const confirmJoin = useCallback(async () => {
    if (!account || !pendingHost?.offer) return
    setBusy(true)
    try {
      const session = buildSession()
      if (!session) return
      await session.acceptOffer(pendingHost.offer)
      const payload = await makePayload()
      const answer = await session.createAnswer(payload)
      await apiSignalGuest(deviceIdRef.current, pendingHost.id, answer)
      // 等待 WebRTC 连通（onConnected 会切到 transferring）
    } catch (e) {
      teardownSession()
      const code = e instanceof P2PError ? e.code : 'SIGNAL'
      failWith(code)
    } finally {
      setBusy(false)
    }
  }, [account, pendingHost, buildSession, makePayload, teardownSession, failWith])

  const handleClose = useCallback(() => {
    closedRef.current = true
    stopPolling()
    teardownSession()
    void apiSignalCancel(deviceIdRef.current).catch(() => {})
    resetState()
    onClose()
  }, [stopPolling, teardownSession, resetState, onClose])

  const handleRetry = useCallback(() => {
    stopPolling()
    teardownSession()
    resetState()
  }, [stopPolling, teardownSession, resetState])

  // ———————— 渲染 ————————

  const renderBody = () => {
    switch (stage) {
      case 'choose':
        return (
          <div>
            <Alert type="info" showIcon style={{ marginBottom: 16 }} message={t('settings.f2f.intro.title')} description={t('settings.f2f.intro.body')} />
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Button block size="large" type="primary" icon={<SwapOutlined />} loading={busy} onClick={() => void startInitiate()}>
                {t('settings.f2f.choose.initiate')}
              </Button>
              <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', display: 'block' }}>{t('settings.f2f.choose.initiateDesc')}</Text>
              <Button block size="large" onClick={startJoinScan} disabled={busy}>
                {t('settings.f2f.choose.join')}
              </Button>
              <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', display: 'block' }}>{t('settings.f2f.choose.joinDesc')}</Text>
            </Space>
          </div>
        )

      case 'waiting':
        return (
          <div style={{ padding: '8px 0' }}>
            <Button type="link" size="small" icon={<ArrowLeftOutlined />} onClick={handleRetry} style={{ padding: 0, marginBottom: 8 }}>
              {t('settings.f2f.back')}
            </Button>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>{t('settings.f2f.waitPeer')}</Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>{t('settings.f2f.waitPeerDesc')}</Text>
            <Progress percent={0} size="small" status="active" />
          </div>
        )

      case 'joining':
        return (
          <div style={{ padding: '8px 0' }}>
            <Button type="link" size="small" icon={<ArrowLeftOutlined />} onClick={handleRetry} style={{ padding: 0, marginBottom: 8 }}>
              {t('settings.f2f.back')}
            </Button>
            {pendingHost ? (
              <div>
                <Text strong style={{ display: 'block', marginBottom: 12 }}>{t('settings.f2f.foundPeer')}</Text>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>{t('settings.f2f.foundPeerDesc')}</Text>
                <Button block type="primary" size="large" loading={busy} onClick={() => void confirmJoin()}>
                  {t('settings.f2f.confirmJoin')}
                </Button>
              </div>
            ) : (
              <div>
                <Text strong style={{ display: 'block', marginBottom: 12 }}>{t('settings.f2f.scanning')}</Text>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>{t('settings.f2f.scanningDesc')}</Text>
                <Progress percent={0} size="small" status="active" />
              </div>
            )}
          </div>
        )

      case 'transferring':
        return (
          <div style={{ padding: '8px 0' }}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              {peerUsername ? t('settings.f2f.withPeer', { name: peerUsername }) : t('settings.f2f.transferring')}
            </Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>{t('settings.f2f.keepOpen')}</Text>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('settings.f2f.sendProgress')}</Text>
              <Progress percent={Math.round(progress.sent * 100)} size="small" />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('settings.f2f.recvProgress')}</Text>
              <Progress percent={Math.round(progress.recv * 100)} size="small" />
            </div>
          </div>
        )

      case 'done':
        return (
          <Result
            status="success"
            title={t('settings.f2f.done.title')}
            subTitle={
              mergeResult
                ? t('settings.f2f.done.summary', {
                    libs: mergeResult.addedLibraries,
                    items: mergeResult.addedItems,
                    updated: mergeResult.updatedItems,
                  })
                : t('settings.f2f.done.title')
            }
            extra={[
              <Button key="again" onClick={handleRetry}>{t('settings.f2f.again')}</Button>,
              <Button key="close" type="primary" onClick={handleClose}>{t('settings.f2f.close')}</Button>,
            ]}
          />
        )

      case 'error':
        return (
          <Result
            status="error"
            title={t('settings.f2f.err.title')}
            subTitle={t(errorKey(errorCode))}
            extra={[
              <Button key="retry" type="primary" onClick={handleRetry}>{t('settings.f2f.retry')}</Button>,
              <Button key="close" onClick={handleClose}>{t('settings.f2f.close')}</Button>,
            ]}
          />
        )
    }
  }

  return (
    <Modal
      title={t('settings.f2f.title')}
      open={open}
      footer={null}
      onCancel={handleClose}
      width={440}
      destroyOnClose
    >
      {renderBody()}
    </Modal>
  )
}

function errorKey(code: P2PErrorCode | 'BAD_PAYLOAD' | 'SIGNAL' | ''): string {
  switch (code) {
    case 'BAD_SIGNAL': return 'settings.f2f.err.BAD_SIGNAL'
    case 'ACCOUNT_MISMATCH': return 'settings.f2f.err.ACCOUNT_MISMATCH'
    case 'CONNECT_FAILED': return 'settings.f2f.err.CONNECT_FAILED'
    case 'SEND_FAILED': return 'settings.f2f.err.SEND_FAILED'
    case 'NO_WEBRTC': return 'settings.f2f.err.NO_WEBRTC'
    case 'READ_ONLY': return 'settings.f2f.err.READ_ONLY'
    case 'BAD_PAYLOAD': return 'settings.f2f.err.BAD_PAYLOAD'
    case 'SIGNAL': return 'settings.f2f.err.SIGNAL'
    default: return 'settings.f2f.err.CONNECT_FAILED'
  }
}

// 保留导出避免其它文件仍在引用（p2pTransfer 的信令编码/解码不再用于 UI）
export { SIGNAL_PREFIX, b64EncodeUtf8, b64DecodeUtf8 }
