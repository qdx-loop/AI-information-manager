import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal, Button, Progress } from 'antd'
import { App as AntdApp } from 'antd'
import {
  SwapOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
} from '@/components/common/icons'
import { useI18n } from '@/i18n'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'
import { useLibraryStore } from '@/store/libraryStore'
import { exportBackup, validateBackupBlob } from '@/db/backup'
import { mergeNativeIntoLocal, type MergeResult } from '@/db/syncService'
import { createSnapshot } from '@/db/snapshotService'
import { initFromSettings } from '@/db/providerFactory'
import {
  P2PSession,
  P2PError,
  primeMediaPermission,
  SIGNAL_PREFIX,
  b64EncodeUtf8,
  b64DecodeUtf8,
  type P2PProgress,
  type P2PErrorCode,
} from '@/utils/p2pTransfer'
import { apiSignalHost, apiSignalGuest, apiSignalPoll, apiSignalCancel, type P2PSignalRow } from '@/lib/serverApi'

import { useBackButtonLayer } from '@/utils/backButton'

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
  const { modal } = AntdApp.useApp()
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
    // 从未发起过同步时 deviceId 为空：此时没必要打 /api/sync/signal（服务端会 400）
    if (deviceIdRef.current) void apiSignalCancel(deviceIdRef.current).catch(() => {})
  }, [open, stopPolling, teardownSession])

  useEffect(() => {
    return () => {
      closedRef.current = true
      stopPolling()
      teardownSession()
    }
  }, [stopPolling, teardownSession])

  /**
   * 关键前置：先拿一次麦克风权限。
   * 浏览器在没有录音/摄像头授权时，会把 WebRTC 的本机内网地址换成
   * mDNS 的 .local 名字（防隐私指纹），两台同 Wi-Fi 的设备就经常连不上；
   * Safari/iOS 在未授权时更是只有 mDNS 候选。授权之后 ICE 收集到的是
   * 真实内网 IP，同网段直连立刻变稳。拿到的流会立即停掉，不录制任何声音。
   */
  const [priming, setPriming] = useState(false)
  const [primed, setPrimed] = useState(false)
  const ensurePrimed = useCallback(async () => {
    if (primed || priming) return
    setPriming(true)
    try {
      const ok = await primeMediaPermission()
      // 拒绝也没关系：后续会走 mDNS，失败时提示会针对这种情况给出说明
      setPrimed(ok)
    } finally {
      setPriming(false)
    }
  }, [primed, priming])

  const failWith = useCallback((code: P2PErrorCode | 'BAD_PAYLOAD' | 'SIGNAL') => {
    stopPolling()
    setErrorCode(code)
    setStage('error')
  }, [stopPolling])

  const maybeFinish = useCallback(() => {
    if (sentDoneRef.current && recvDoneRef.current) {
      // 传输完成：结束两端会话。不然各自那边 armStallWatchdog 挂着的定时器
      // 还会过约 45s 触发一次 fail(STALLED)，把已进入 done 的成功页又拨回错误。
      try {
        sessionRef.current?.close()
      } catch { /* ignore */ }
      sessionRef.current = null
      setMergeResult(mergeResultRef.current)
      setStage('done')
    }
  }, [])

  // 收到对端完整负载 → 应用配置 + 合并数据进本机
  const handleReceivedPayload = useCallback(
    async (payload: string) => {
      if (!account) return
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
          // 云端配置是高风险项：accountId 不是密钥（它就在每份导出备份里），
          // 拿到它的人 + 同一局域网就能冒充对端。若无条件接受 cfg.cloud，
          // 之后本机的自动同步会**把所有数据上传到对端指定的 Supabase**，
          // 而且几乎没有界面提示。所以在生效前明确问一次。
          if (cfg.cloud && cfg.cloud.url && cfg.cloud.anonKey) {
            const cur = useAppStore.getState().settings.cloud
            const changed = cur?.url !== cfg.cloud.url || cur?.anonKey !== cfg.cloud.anonKey
            let approved = true
            if (changed) {
              approved = await new Promise<boolean>((resolve) => {
                modal.confirm({
                  title: t('settings.f2f.cloudConfigTitle'),
                  content: t('settings.f2f.cloudConfigBody', { url: cfg.cloud.url }),
                  okText: t('common.confirm'),
                  cancelText: t('common.cancel'),
                  onOk: () => resolve(true),
                  onCancel: () => resolve(false),
                })
              })
            }
            if (approved) {
              app.setCloud({ url: cfg.cloud.url, anonKey: cfg.cloud.anonKey })
              if (cfg.storageMode === 'cloud') {
                app.setStorageMode('cloud')
                initFromSettings(useAppStore.getState().settings)
              }
            }
          }
        }

        // 合并前自动拍一张快照（兜底，失败不阻断合并）
        try {
          await createSnapshot(account.id, 'transfer')
        } catch (e) {
          console.warn('[f2f] 合并前快照失败：', e)
        }
        // 对端负载和「从磁盘选的备份文件」一样不可信：旧版本 schema 不同、
        // bug、乃至恶意构造的 payload 都可能进来。走同一套校验，
        // 不合格的直接拒掉，不进 mergeNativeIntoLocal（否则写进去后
        // 一打开库就 Object.values(it.fields) 崩白屏）。
        validateBackupBlob(backup)
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
    [account, maybeFinish, teardownSession, failWith, modal, t],
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
      await ensurePrimed()
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
            // 必须 catch。原来是 `void session.acceptAnswer(...)`：
            // 轮询已经停了，这个 promise 再失败就没有第二次机会，
            // rejection 变成 unhandledrejection（无声），
            // 弹窗永远停在「等待连接」0%，用户只能手动关窗。
            session.acceptAnswer(r.signal.answer).catch((e: unknown) => {
              failWith(e instanceof P2PError ? e.code : 'BAD_SIGNAL')
            })
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
  }, [account, buildSession, makePayload, stopPolling, failWith, ensurePrimed])

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
      await ensurePrimed()
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
  }, [account, pendingHost, buildSession, makePayload, teardownSession, failWith, ensurePrimed])

  const handleClose = useCallback(() => {
    closedRef.current = true
    stopPolling()
    teardownSession()
    if (deviceIdRef.current) void apiSignalCancel(deviceIdRef.current).catch(() => {})
    resetState()
    onClose()
  }, [stopPolling, teardownSession, resetState, onClose])

  const handleRetry = useCallback(() => {
    stopPolling()
    teardownSession()
    resetState()
  }, [stopPolling, teardownSession, resetState])
  // ———————— 渲染 ————————

  /** Win11 InfoBar：说明与麦克风权限提示（不再用彩色 Alert 大块） */
  const note = (
    kind: 'info' | 'warning',
    title: string,
    body: string,
  ) => {
    const Icon = kind === 'info' ? InfoCircleOutlined : WarningOutlined
    return (
      <div className={`w-set-note${kind === 'warning' ? ' w-set-note--warning' : ''}`}>
        <span className="w-set-note-icon" aria-hidden>
          <Icon />
        </span>
        <div className="w-set-note-main">
          <div className="w-set-note-title">{title}</div>
          <div className="w-set-note-body">{body}</div>
        </div>
      </div>
    )
  }

  const backButton = (
    <button type="button" className="w-btn w-btn--subtle w-btn--sm w-f2f-back" onClick={handleRetry}>
      <ArrowLeftOutlined />
      {t('settings.f2f.back')}
    </button>
  )

  const renderBody = () => {
    switch (stage) {
      case 'choose':
        return (
          <div className="w-f2f">
            {/* 提前告知会请求麦克风权限 —— 这是修复「同一 Wi-Fi 却连不上」的关键，
                浏览器不授权就不会给出真实内网地址。不提前说会显得唐突。 */}
            <div className="w-f2f-notes">
              {note('info', t('settings.f2f.intro.title'), t('settings.f2f.intro.body'))}
              {note('warning', t('settings.f2f.mic.title'), t('settings.f2f.mic.body'))}
            </div>
            <div className="w-f2f-actions">
              <Button
                block
                size="large"
                type="primary"
                icon={<SwapOutlined />}
                loading={busy}
                onClick={() => void startInitiate()}
              >
                {t('settings.f2f.choose.initiate')}
              </Button>
              <div className="w-f2f-hint">{t('settings.f2f.choose.initiateDesc')}</div>
              <Button block size="large" onClick={startJoinScan} disabled={busy}>
                {t('settings.f2f.choose.join')}
              </Button>
              <div className="w-f2f-hint">{t('settings.f2f.choose.joinDesc')}</div>
            </div>
          </div>
        )

      case 'waiting':
        return (
          <div className="w-f2f">
            {backButton}
            <div className="w-f2f-stage">
              <div className="w-f2f-stage-title">{t('settings.f2f.waitPeer')}</div>
              <div className="w-f2f-stage-desc">{t('settings.f2f.waitPeerDesc')}</div>
              <div className="w-f2f-progress">
                <Progress percent={0} size="small" status="active" showInfo={false} />
              </div>
            </div>
          </div>
        )

      case 'joining':
        return (
          <div className="w-f2f">
            {backButton}
            {pendingHost ? (
              <div className="w-f2f-stage">
                <div className="w-f2f-stage-title">{t('settings.f2f.foundPeer')}</div>
                <div className="w-f2f-stage-desc">{t('settings.f2f.foundPeerDesc')}</div>
                <div className="w-set-actions w-set-actions--top" style={{ marginTop: 8 }}>
                  <Button block type="primary" size="large" loading={busy} onClick={() => void confirmJoin()}>
                    {t('settings.f2f.confirmJoin')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-f2f-stage">
                <div className="w-f2f-stage-title">{t('settings.f2f.scanning')}</div>
                <div className="w-f2f-stage-desc">{t('settings.f2f.scanningDesc')}</div>
                <div className="w-f2f-progress">
                  <Progress percent={0} size="small" status="active" showInfo={false} />
                </div>
              </div>
            )}
          </div>
        )

      case 'transferring':
        return (
          <div className="w-f2f">
            <div className="w-f2f-stage">
              <div className="w-f2f-stage-title">
                {peerUsername ? t('settings.f2f.withPeer', { name: peerUsername }) : t('settings.f2f.transferring')}
              </div>
              <div className="w-f2f-stage-desc">{t('settings.f2f.keepOpen')}</div>
              <div className="w-f2f-progress">
                <div className="w-f2f-progress-label">
                  <span>{t('settings.f2f.sendProgress')}</span>
                  <span className="w-f2f-progress-value">{Math.round(progress.sent * 100)}%</span>
                </div>
                <Progress percent={Math.round(progress.sent * 100)} size="small" showInfo={false} />
              </div>
              <div className="w-f2f-progress">
                <div className="w-f2f-progress-label">
                  <span>{t('settings.f2f.recvProgress')}</span>
                  <span className="w-f2f-progress-value">{Math.round(progress.recv * 100)}%</span>
                </div>
                <Progress percent={Math.round(progress.recv * 100)} size="small" showInfo={false} />
              </div>
            </div>
          </div>
        )

      case 'done':
        return (
          <div className="w-f2f-result">
            <span className="w-f2f-result-mark" aria-hidden>
              <CheckCircleOutlined />
            </span>
            <div className="w-f2f-result-title">{t('settings.f2f.done.title')}</div>
            <div className="w-f2f-result-desc">
              {mergeResult
                ? t('settings.f2f.done.summary', {
                    libs: mergeResult.addedLibraries,
                    items: mergeResult.addedItems,
                    updated: mergeResult.updatedItems,
                  })
                : t('settings.f2f.done.title')}
            </div>
            <div className="w-f2f-result-actions">
              <Button onClick={handleRetry}>{t('settings.f2f.again')}</Button>
              <Button type="primary" onClick={handleClose}>
                {t('settings.f2f.close')}
              </Button>
            </div>
          </div>
        )

      case 'error':
        return (
          <div className="w-f2f-result">
            <span className="w-f2f-result-mark w-f2f-result-mark--error" aria-hidden>
              <WarningOutlined />
            </span>
            <div className="w-f2f-result-title">{t('settings.f2f.err.title')}</div>
            <div className="w-f2f-result-desc">{t(errorKey(errorCode))}</div>
            <div className="w-f2f-result-actions">
              <Button type="primary" onClick={handleRetry}>
                {t('settings.f2f.retry')}
              </Button>
              <Button onClick={handleClose}>{t('settings.f2f.close')}</Button>
            </div>
          </div>
        )
    }
  }

  useBackButtonLayer(open, handleClose)

  return (
    <Modal
      title={t('settings.f2f.title')}
      open={open}
      footer={null}
      onCancel={handleClose}
      width={480}
      destroyOnHidden
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
    case 'STALLED': return 'settings.f2f.err.STALLED'
    case 'NO_WEBRTC': return 'settings.f2f.err.NO_WEBRTC'
    case 'READ_ONLY': return 'settings.f2f.err.READ_ONLY'
    case 'NO_CANDIDATE': return 'settings.f2f.err.NO_CANDIDATE'
    case 'MDNS_ONLY': return 'settings.f2f.err.MDNS_ONLY'
    case 'ISOLATED': return 'settings.f2f.err.ISOLATED'
    case 'BAD_PAYLOAD': return 'settings.f2f.err.BAD_PAYLOAD'
    case 'SIGNAL': return 'settings.f2f.err.SIGNAL'
    default: return 'settings.f2f.err.CONNECT_FAILED'
  }
}

// 保留导出避免其它文件仍在引用（p2pTransfer 的信令编码/解码不再用于 UI）
export { SIGNAL_PREFIX, b64EncodeUtf8, b64DecodeUtf8 }
