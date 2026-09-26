import { useEffect, useRef, useState } from 'react'
import { Modal, Button, Space, Spin, App } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { useI18n, tNow } from '@/i18n'

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
        reject(new Error(tNow('ai.chart.loadFailed')))
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
  const t = useI18n()
  const chartDivRef = useRef<HTMLDivElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null)
  const [loading, setLoading] = useState(false)

  const [ready, setReady] = useState(false)

  // Modal 展开动画结束后才标记 ready——此时容器才具有真实宽高。
  // ECharts 若在动画中 init 会拿到 0/极小尺寸，图表缩在左上角且不再自愈（bug 表现：
  // 开关别的窗口触发 window resize 才恢复）。afterOpenChange 从根本上消除该时机问题。
  useEffect(() => {
    if (!payload) setReady(false)
  }, [payload])

  useEffect(() => {
    if (!payload || !ready || !chartDivRef.current) return
    let disposed = false
    setLoading(true)

    void loadECharts()
      .then((mod) => {
        if (disposed || !chartDivRef.current) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const echarts = mod as any
        chartRef.current?.dispose()
        // 双保险：init 前再校验一次容器尺寸，异常环境（如容器仍为 0）时推迟到 resize
        const el = chartDivRef.current
        const chart = echarts.init(el)
        const option = {
          ...payload.option,
          tooltip: payload.option.tooltip ?? { trigger: 'auto' },
          title: payload.option.title ?? { text: payload.title, left: 'center' },
        }
        chart.setOption(option)
        // init 完成后若容器尺寸与画布不一致（时序竞态兜底），立即修正
        requestAnimationFrame(() => {
          if (!disposed && chartRef.current) chartRef.current.resize()
        })
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
  }, [payload, ready])

  const handleDownload = () => {
    const canvas = chartDivRef.current?.querySelector('canvas')
    if (!canvas) {
      message.warning(t('ai.chart.notReady'))
      return
    }
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `${payload?.title || '统计图'}.png`
    a.click()
    message.success(t('ai.chart.downloaded'))
  }

  return (
    <Modal
      open={!!payload}
      title={`📊 ${payload?.title ?? ''}`}
      width={720}
      onCancel={onClose}
      afterOpenChange={(open) => open && setReady(true)}
      footer={
        <Space>
          <Button icon={<DownloadOutlined />} type="primary" onClick={handleDownload}>
            {t('ai.chart.download')}
          </Button>
          <Button onClick={onClose}>{t('common.close')}</Button>
        </Space>
      }
    >
      <div style={{ position: 'relative', minHeight: 420 }}>
        <div ref={chartDivRef} style={{ width: '100%', height: 420 }} />
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spin tip={t('ai.chart.loading')} />
          </div>
        )}
      </div>
    </Modal>
  )
}
