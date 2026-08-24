import { useEffect, useRef, useState } from 'react'
import { Modal, Button, Space, Spin, App } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'

// 按需加载图表库（UMD 版），多个 CDN 依次回退，保证国内外网络环境可用
let echartsPromise: Promise<unknown> | null = null

const CDN_LIST = [
  'https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js',
  'https://unpkg.com/echarts@5.5.1/dist/echarts.min.js',
  'https://cdn.bootcdn.net/ajax/libs/echarts/5.5.1/echarts.min.js',
  'https://lib.baomitu.com/echarts/5.5.1/echarts.min.js',
]

function loadECharts(): Promise<unknown> {
  const win = window as unknown as { echarts?: unknown }
  if (win.echarts) return Promise.resolve(win.echarts)
  if (echartsPromise) return echartsPromise

  echartsPromise = new Promise((resolve, reject) => {
    let idx = 0
    const tryNext = () => {
      if (idx >= CDN_LIST.length) {
        echartsPromise = null
        reject(new Error('图表组件加载失败，请检查网络后重试'))
        return
      }
      const script = document.createElement('script')
      script.src = CDN_LIST[idx++]
      script.onload = () => {
        if ((window as unknown as { echarts?: unknown }).echarts) {
          resolve((window as unknown as { echarts?: unknown }).echarts)
        } else {
          tryNext()
        }
      }
      script.onerror = () => {
        script.remove()
        tryNext()
      }
      document.head.appendChild(script)
    }
    tryNext()
  })
  return echartsPromise
}

export interface ChartPayload {
  title: string
  option: Record<string, unknown>
}

/**
 * 图表弹窗：渲染 AI 生成的图表配置，支持一键下载 PNG。
 */
export default function ChartModal({
  payload,
  onClose,
}: {
  payload: ChartPayload | null
  onClose: () => void
}) {
  const { message } = App.useApp()
  const chartDivRef = useRef<HTMLDivElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!payload || !chartDivRef.current) return
    let disposed = false
    setLoading(true)

    void loadECharts()
      .then((mod) => {
        if (disposed || !chartDivRef.current) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const echarts = mod as any
        chartRef.current?.dispose()
        const chart = echarts.init(chartDivRef.current)
        const option = {
          ...payload.option,
          tooltip: payload.option.tooltip ?? { trigger: 'auto' },
          title: payload.option.title ?? { text: payload.title, left: 'center' },
        }
        chart.setOption(option)
        chartRef.current = chart
      })
      .catch((e: Error) => message.error(e.message))
      .finally(() => !disposed && setLoading(false))

    const onResize = () => chartRef.current?.resize()
    window.addEventListener('resize', onResize)
    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload])

  const handleDownload = () => {
    const canvas = chartDivRef.current?.querySelector('canvas')
    if (!canvas) {
      message.warning('图表尚未渲染完成')
      return
    }
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `${payload?.title || '统计图'}.png`
    a.click()
    message.success('图片已下载')
  }

  return (
    <Modal
      open={!!payload}
      title={`📊 ${payload?.title ?? ''}`}
      width={720}
      onCancel={onClose}
      footer={
        <Space>
          <Button icon={<DownloadOutlined />} type="primary" onClick={handleDownload}>
            下载图片 (PNG)
          </Button>
          <Button onClick={onClose}>关闭</Button>
        </Space>
      }
    >
      <div style={{ position: 'relative', minHeight: 420 }}>
        <div ref={chartDivRef} style={{ width: '100%', height: 420 }} />
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spin tip="正在生成图表…" />
          </div>
        )}
      </div>
    </Modal>
  )
}
