import { useEffect, useRef, useState } from 'react'
import { Modal, Input, Button, App, Space, Typography, Divider } from 'antd'
import { ScanOutlined } from '@ant-design/icons'
import jsQR from 'jsqr'
import { decodeSyncCode } from '@/utils/syncCode'

const { Text } = Typography

interface Decoded {
  cloudUrl: string
  cloudKey: string
  aiBaseUrl: string
  aiApiKey: string
  aiModel: string
}

/**
 * 同步码导入弹窗：支持 ① 摄像头扫描二维码 ② 手动粘贴同步码
 * 场景：电脑上配置好并展示二维码 → 手机登录后打开此弹窗扫码，一键填入云端和 AI 配置。
 */
export default function SyncImportModal({
  open,
  onClose,
  onDecoded,
}: {
  open: boolean
  onClose: () => void
  onDecoded: (d: Decoded) => void
}) {
  const { message } = App.useApp()
  const [pasting, setPasting] = useState('')
  const [cameraOn, setCameraOn] = useState(false)
  const [scanning, setScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  // 打开弹窗时尝试启动摄像头
  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
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
        setScanning(false)
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
      if (code?.data) handleDetected(code.data)
    }

    function handleDetected(text: string) {
      const decoded = decodeSyncCode(text)
      stopCamera()
      if (!decoded) {
        message.error('识别到二维码，但不是有效的同步码')
        return
      }
      onDecoded(decoded as unknown as Decoded)
    }

    if (typeof navigator.mediaDevices?.getUserMedia === 'function') {
      setScanning(true)
      void startCamera()
    } else {
      setCameraOn(false)
      setScanning(false)
    }

    return () => {
      cancelled = true
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function stopCamera() {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraOn(false)
    setScanning(false)
  }

  const handlePasteImport = () => {
    const decoded = decodeSyncCode(pasting.trim())
    if (!decoded) {
      message.error('同步码无效或已损坏')
      return
    }
    stopCamera()
    onDecoded(decoded as unknown as Decoded)
  }

  return (
    <Modal title="导入同步配置" open={open} footer={null} onCancel={() => { stopCamera(); onClose() }} width={420}>
      {/* 摄像头扫码区 */}
      <div style={{ position: 'relative', background: '#000', borderRadius: 8, overflow: 'hidden', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video ref={videoRef} style={{ width: '100%', display: cameraOn ? 'block' : 'none' }} playsInline muted />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {!cameraOn && (
          <Text type="secondary" style={{ color: '#999', padding: 24, textAlign: 'center' }}>
            {scanning ? '正在启动摄像头…' : '摄像头不可用（未授权或设备无摄像头），可改用下方粘贴方式'}
          </Text>
        )}
        {cameraOn && (
          <div
            style={{
              position: 'absolute',
              width: 180,
              height: 180,
              border: '2px solid #52c41a',
              borderRadius: 8,
              boxShadow: '0 0 0 2000px rgba(0,0,0,0.35)',
            }}
          />
        )}
      </div>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
        将摄像头对准电脑上「设置 → 存储」页面中的同步二维码即可自动填入。
      </Text>

      <Divider>或者粘贴同步码</Divider>
      <Space.Compact style={{ width: '100%' }}>
        <Input
          placeholder="粘贴从其他设备复制的同步码"
          value={pasting}
          onChange={(e) => setPasting(e.target.value)}
          onPressEnter={handlePasteImport}
        />
        <Button type="primary" icon={<ScanOutlined />} onClick={handlePasteImport} disabled={!pasting.trim()}>
          导入
        </Button>
      </Space.Compact>
    </Modal>
  )
}
