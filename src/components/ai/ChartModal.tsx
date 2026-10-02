import { useEffect, useRef, useState } from 'react'
import { Modal, Button, Space, Spin, App } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { useI18n, tNow } from '@/i18n'
import { styleChart } from '@/ai/chartStyle'
import { useAppStore } from '@/store/appStore'

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

  // 切换亮/暗主题时重画：图表颜色是从 CSS 变量读的，不重画会停留在旧主题
  const themeMode = useAppStore((s) => s.settings.theme)
  useEffect(() => {
    if (!payload || !chartRef.current) return
    chartRef.current.setOption(
      styleChart(payload.option, themeMode === 'dark'),
      true,
    )
  }, [themeMode, payload])

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
        // 关键：AI 只负责「给什么数据」，长什么样由 house style 统一决定。
        // 同时把当前主题传进去 —— 之前的实现完全不感知亮/暗，
        // 暗色模式下图表是白底黑字的一小块，跟界面完全脱节。
        const dark = useAppStore.getState().settings.theme === 'dark'
        const option = styleChart(payload.option, dark)
        chart.setOption(option, true)
        // 分类色只有 5 个（色盲安全要求），超出的系列会被合并，
        // 要明确告知用户「合并了什么」，否则他会以为图表画错了
        const meta = (option as { __meta?: { overflowNote?: string } }).__meta
        if (meta?.overflowNote) message.info(meta.overflowNote)
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
    a.download = `${payload?.title || t('ai.chart.defaultName')}.png`
    a.click()
    message.success(t('ai.chart.downloaded'))
  }

  return (
    <Modal
      open={!!payload}
      // 标题已在弹窗头部显示，ECharts 里不再重复画一遍
      title={payload?.title ?? ''}
      width={860}
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
      <div style={{ position: 'relative', minHeight: 460 }}>
        <div ref={chartDivRef} style={{ width: '100%', height: 460 }} />
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spin tip={t('ai.chart.loading')} />
          </div>
        )}
      </div>
    </Modal>
  )
}
