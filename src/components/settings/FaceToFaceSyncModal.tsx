import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal, Button, Space, Typography, Input, Progress, Alert, App, Divider, Result } from 'antd'
import { ScanOutlined, CopyOutlined, SwapOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import jsQR from 'jsqr'
import QRCode from 'qrcode'
import { useI18n } from '@/i18n'
import { useAuthStore } from '@/store/authStore'
import { useLibraryStore } from '@/store/libraryStore'
import { exportBackup } from '@/db/backup'
import { mergeNativeIntoLocal, type MergeResult } from '@/db/syncService'
import {
  P2PSession,
  P2PError,
  decodeSignal,
  type P2PProgress,
  type P2PErrorCode,
} from '@/utils/p2pTransfer'
import type { BackupBlob } from '@/types'

const { Text, Paragraph } = Typography

type Stage =
  | 'choose'       // 选择发起/加入
  | 'init-offer'   // 发起方：展示 offer 码，等待对端 answer
  | 'join-scan'    // 加入方：扫码/粘贴 offer
  | 'join-answer'  // 加入方：展示 answer 码，等待连通
  | 'transferring' // 双向传输中
  | 'done'         // 完成
  | 'error'        // 出错

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * 面对面互传：两台设备登录同一账号、同一局域网，经 WebRTC 数据通道直接互传并合并数据。
 * 配对信令通过二维码/粘贴码手动交换，数据不经过任何服务器。
 */
export default function FaceToFaceSyncModal({ open, onClose }: Props) {
  const { message } = App.useApp()
  const t = useI18n()
  const account = useAuthStore((s) => s.account)

  const [stage, setStage] = useState<Stage>('choose')
  const [myCode, setMyCode] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [pasteInput, setPasteInput] = useState('')
  const [progress, setProgress] = useState<P2PProgress>({ sent: 0, recv: 0 })
  const [peerUsername, setPeerUsername] = useState('')
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null)
  const [errorCode, setErrorCode] = useState<P2PErrorCode | 'BAD_PAYLOAD' | ''>('')
  const [busy, setBusy] = useState(false)

  // 扫码相关
  const [scanOpen, setScanOpen] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  const sessionRef = useRef<P2PSession | null>(null)
  const sentDoneRef = useRef(false)
  const recvDoneRef = useRef(false)
  const mergeResultRef = useRef<MergeResult | null>(null)
  // 扫码结果交给哪个阶段处理（发起方收 answer / 加入方收 offer）
  const scanTargetRef = useRef<'answer' | 'offer'>('offer')

  const resetState = useCallback(() => {
    setStage('choose')
    setMyCode('')
    setQrDataUrl('')
    setPasteInput('')
    setProgress({ sent: 0, recv: 0 })
    setPeerUsername('')
    setMergeResult(null)
    setErrorCode('')
    setBusy(false)
    sentDoneRef.current = false
    recvDoneRef.current = false
    mergeResultRef.current = null
  }, [])

  const teardownSession = useCallback(() => {
    sessionRef.current?.close()
    sessionRef.current = null
  }, [])

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
    setCameraOn(false)
  }, [])

  // 关闭弹窗 / 组件卸载：释放会话与摄像头
  useEffect(() => {
    if (!open) {
      teardownSession()
      stopCamera()
      setScanOpen(false)
    }
    return () => {
      teardownSession()
      stopCamera()
    }
  }, [open, teardownSession, stopCamera])

  const failWith = useCallback((code: P2PErrorCode | 'BAD_PAYLOAD') => {
    setErrorCode(code)
    setStage('error')
  }, [])

  const maybeFinish = useCallback(() => {
    if (sentDoneRef.current && recvDoneRef.current) {
      setMergeResult(mergeResultRef.current)
      setStage('done')
    }
  }, [])

  // 收到对端完整负载 → 合并进本机
  const handleReceivedPayload = useCallback(
    async (payload: string) => {
      if (!account) return
      try {
        const blob = JSON.parse(payload) as BackupBlob
        if (!blob || !Array.isArray(blob.libraries) || !Array.isArray(blob.items)) {
          throw new Error('bad payload')
        }
        const r = await mergeNativeIntoLocal(account.id, {
          libraries: blob.libraries,
          fields: Array.isArray(blob.fields) ? blob.fields : [],
          items: blob.items,
        })
        mergeResultRef.current = r
        recvDoneRef.current = true
        await useLibraryStore.getState().loadLibraries()
        await useLibraryStore.getState().refreshCurrent()
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

  // 生成本端待发送的完整数据负载
  const makePayload = useCallback(async (): Promise<string> => {
    if (!account) return ''
    const blob = await exportBackup(account.id)
    return JSON.stringify(blob)
  }, [account])

  const renderQr = useCallback((code: string) => {
    setMyCode(code)
    QRCode.toDataURL(code, { width: 260, margin: 1, errorCorrectionLevel: 'L' })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''))
  }, [])

  // —— 发起方：生成 offer ——
  const startInitiate = useCallback(async () => {
    if (!account) return
    setBusy(true)
    try {
      const session = buildSession()
      if (!session) return
      const payload = await makePayload()
      const offer = await session.createOffer(payload)
      scanTargetRef.current = 'answer'
      renderQr(offer)
      setStage('init-offer')
    } catch (e) {
      failWith(e instanceof P2PError ? e.code : 'NO_WEBRTC')
    } finally {
      setBusy(false)
    }
  }, [account, buildSession, makePayload, renderQr, failWith])

  // —— 发起方：收到 answer 后连通 ——
  const submitAnswer = useCallback(
    async (code: string) => {
      const session = sessionRef.current
      if (!session) return
      setBusy(true)
      try {
        await session.acceptAnswer(code.trim())
        setPasteInput('')
        setStage('transferring')
      } catch {
        failWith('BAD_SIGNAL')
      } finally {
        setBusy(false)
      }
    },
    [failWith],
  )

  // —— 加入方：收到 offer 后生成 answer ——
  const submitOffer = useCallback(
    async (code: string) => {
      if (!account) return
      setBusy(true)
      try {
        const session = buildSession()
        if (!session) return
        await session.acceptOffer(code.trim())
        const payload = await makePayload()
        const answer = await session.createAnswer(payload)
        renderQr(answer)
        setStage('join-answer')
      } catch (e) {
        teardownSession()
        failWith(e instanceof P2PError ? e.code : 'BAD_SIGNAL')
      } finally {
        setBusy(false)
      }
    },
    [account, buildSession, makePayload, renderQr, teardownSession, failWith],
  )

  // 扫码识别回调：按当前目标分发
  const handleScanned = useCallback(
    (text: string) => {
      setScanOpen(false)
      stopCamera()
      if (!decodeSignal(text)) {
        message.error(t('settings.f2f.err.BAD_SIGNAL'))
        return
      }
      if (scanTargetRef.current === 'answer') void submitAnswer(text)
      else void submitOffer(text)
    },
    [message, t, stopCamera, submitAnswer, submitOffer],
  )

  // 粘贴提交
  const handlePasteSubmit = useCallback(() => {
    const code = pasteInput.trim()
    if (!code) return
    if (!decodeSignal(code)) {
      message.error(t('settings.f2f.err.BAD_SIGNAL'))
      return
    }
    if (stage === 'init-offer') void submitAnswer(code)
    else if (stage === 'join-scan') void submitOffer(code)
  }, [pasteInput, stage, message, t, submitAnswer, submitOffer])

  const openScanner = useCallback((target: 'answer' | 'offer') => {
    scanTargetRef.current = target
    setPasteInput('')
    setScanOpen(true)
  }, [])

  // 摄像头扫码 effect
  useEffect(() => {
    if (!scanOpen) return
    let cancelled = false

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop())
          return
        }
        streamRef.current = stream
        setCameraOn(true)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => undefined)
        }
        tick()
      } catch {
        setCameraOn(false)
      }
    }

    function tick() {
      rafRef.current = requestAnimationFrame(tick)
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
      if (code?.data) handleScanned(code.data)
    }

    if (typeof navigator.mediaDevices?.getUserMedia === 'function') {
      void startCamera()
    } else {
      setCameraOn(false)
    }

    return () => {
      cancelled = true
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanOpen])

  const handleClose = useCallback(() => {
    teardownSession()
    stopCamera()
    resetState()
    onClose()
  }, [teardownSession, stopCamera, resetState, onClose])

  const handleRetry = useCallback(() => {
    teardownSession()
    stopCamera()
    resetState()
  }, [teardownSession, stopCamera, resetState])

  const copyMyCode = useCallback(() => {
    navigator.clipboard.writeText(myCode).then(
      () => message.success(t('settings.f2f.copied')),
      () => undefined,
    )
  }, [myCode, message, t])

  // ———————— 渲染 ————————

  const renderCodeDisplay = (hintKey: string, showScan: boolean) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="QR" width={220} height={220} style={{ borderRadius: 8, border: '1px solid #eee' }} />
        ) : (
          <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #d9d9d9', borderRadius: 8 }}>
            <Text type="secondary" style={{ padding: 16, textAlign: 'center', fontSize: 12 }}>{t('settings.f2f.qrTooBig')}</Text>
          </div>
        )}
      </div>
      <Input.TextArea readOnly value={myCode} autoSize={{ minRows: 2, maxRows: 4 }} style={{ fontSize: 11, marginBottom: 8 }} />
      <Space style={{ width: '100%', justifyContent: showScan ? 'space-between' : 'flex-end' }}>
        <Button icon={<CopyOutlined />} onClick={copyMyCode}>{t('settings.f2f.copy')}</Button>
        {showScan && (
          <Button icon={<ScanOutlined />} onClick={() => openScanner(scanTargetRef.current)}>{t('settings.f2f.scanBtn')}</Button>
        )}
      </Space>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>{t(hintKey)}</Text>
    </div>
  )

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
              <Button block size="large" icon={<ScanOutlined />} disabled={busy} onClick={() => { scanTargetRef.current = 'offer'; setStage('join-scan') }}>
                {t('settings.f2f.choose.join')}
              </Button>
              <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', display: 'block' }}>{t('settings.f2f.choose.joinDesc')}</Text>
            </Space>
          </div>
        )

      case 'init-offer':
        return (
          <div>
            <Button type="link" size="small" icon={<ArrowLeftOutlined />} onClick={handleRetry} style={{ padding: 0, marginBottom: 8 }}>
              {t('settings.f2f.back')}
            </Button>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>{t('settings.f2f.offer.title')}</Text>
            {renderCodeDisplay('settings.f2f.offer.hint', true)}
            <Divider style={{ margin: '16px 0' }}>{t('settings.f2f.pasteOr')}</Divider>
            <Space.Compact style={{ width: '100%' }}>
              <Input.TextArea
                placeholder={t('settings.f2f.answer.pastePlaceholder')}
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                autoSize={{ minRows: 2, maxRows: 4 }}
              />
            </Space.Compact>
            <Button block type="primary" style={{ marginTop: 8 }} loading={busy} disabled={!pasteInput.trim()} onClick={handlePasteSubmit}>
              {t('settings.f2f.answer.connect')}
            </Button>
          </div>
        )

      case 'join-scan':
        return (
          <div>
            <Button type="link" size="small" icon={<ArrowLeftOutlined />} onClick={handleRetry} style={{ padding: 0, marginBottom: 8 }}>
              {t('settings.f2f.back')}
            </Button>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>{t('settings.f2f.join.scanTitle')}</Text>
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Button block size="large" type="primary" icon={<ScanOutlined />} onClick={() => openScanner('offer')}>
                {t('settings.f2f.scanBtn')}
              </Button>
              <Divider style={{ margin: 0 }}>{t('settings.f2f.pasteOr')}</Divider>
              <Input.TextArea
                placeholder={t('settings.f2f.offer.pastePlaceholder')}
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                autoSize={{ minRows: 2, maxRows: 4 }}
              />
              <Button block type="primary" loading={busy} disabled={!pasteInput.trim()} onClick={handlePasteSubmit}>
                {t('settings.f2f.next')}
              </Button>
            </Space>
          </div>
        )

      case 'join-answer':
        return (
          <div>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>{t('settings.f2f.answer.title')}</Text>
            {renderCodeDisplay('settings.f2f.answer.hint', false)}
            <Alert type="info" showIcon style={{ marginTop: 12 }} message={t('settings.f2f.waitConnect')} />
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
    <>
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

      {/* 摄像头扫码弹窗 */}
      <Modal
        title={t('settings.f2f.scanBtn')}
        open={scanOpen}
        footer={null}
        onCancel={() => { setScanOpen(false); stopCamera() }}
        width={420}
        destroyOnClose
      >
        <div style={{ position: 'relative', background: '#000', borderRadius: 8, overflow: 'hidden', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video ref={videoRef} style={{ width: '100%', display: cameraOn ? 'block' : 'none' }} playsInline muted />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          {!cameraOn && (
            <Text type="secondary" style={{ color: 'rgba(255,255,255,0.72)', padding: 24, textAlign: 'center' }}>
              {t('settings.f2f.cameraUnavailable')}
            </Text>
          )}
          {cameraOn && (
            <div style={{ position: 'absolute', width: 200, height: 200, border: '2px solid #52c41a', borderRadius: 8, boxShadow: '0 0 0 2000px rgba(0,0,0,0.35)' }} />
          )}
        </div>
        <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          {t('settings.f2f.cameraHint')}
        </Paragraph>
      </Modal>
    </>
  )
}

function errorKey(code: P2PErrorCode | 'BAD_PAYLOAD' | ''): string {
  switch (code) {
    case 'BAD_SIGNAL': return 'settings.f2f.err.BAD_SIGNAL'
    case 'ACCOUNT_MISMATCH': return 'settings.f2f.err.ACCOUNT_MISMATCH'
    case 'CONNECT_FAILED': return 'settings.f2f.err.CONNECT_FAILED'
    case 'SEND_FAILED': return 'settings.f2f.err.SEND_FAILED'
    case 'NO_WEBRTC': return 'settings.f2f.err.NO_WEBRTC'
    case 'BAD_PAYLOAD': return 'settings.f2f.err.BAD_PAYLOAD'
    default: return 'settings.f2f.err.CONNECT_FAILED'
  }
}
