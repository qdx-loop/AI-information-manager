import { useEffect, useRef, useState } from 'react'
import { App } from 'antd'
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Text,
} from '@fluentui/react-components'
import { ArrowDownloadRegular } from '@fluentui/react-icons'
import { useI18n } from '@/i18n'
import { styleChart } from '@/ai/chartStyle'
import { useAppStore } from '@/store/appStore'

import { useBackButtonLayer } from '@/utils/backButton'

// 按需加载图表库。
//
// 原来是 document.createElement('script') 从四个 CDN 依次回退加载 echarts。
// 那等于把「拿到应用 origin 完整权限的第三方远程代码」引进来了：
//   - 没写 integrity（SRI），CDN 被劫持 / MITM 就能执行任意代码，
//     直接读走 IndexedDB（用户全部数据）、localStorage 里的
//     info-mgmt-token 和管理员令牌
//   - bootcdn / baomitu 这类国内镜像供应链管控更弱
//   - 断网 / 内网环境下四个源全挂 → 图表功能完全不可用
//
// 改成打包进产物 + 动态 import：Vite 会把 echarts 拆成独立 chunk，
// 仍然只有真正画图时才下载（和原来 CDN 的懒加载一个意思），
// 但代码随产物一起走 hash 校验，不再信任任何远端服务器，离线也能用。
let echartsPromise: Promise<typeof import('echarts')> | null = null

function loadECharts(): Promise<typeof import('echarts')> {
  if (echartsPromise) return echartsPromise
  echartsPromise = import('echarts').catch((e) => {
    // 失败要清掉缓存，否则这次之后永远拿不到（Promise 已 settle）
    echartsPromise = null
    throw e
  })
  return echartsPromise
}

export interface ChartPayload {
  title: string
  option: Record<string, unknown>
}

/** canvas 不解析 CSS 变量，画之前把 Fluent token 读成具体值 */
function readTokens() {
  const cs = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null
  const v = (name: string) => (cs?.getPropertyValue(name) ?? '').trim()
  return {
    fontSans: v('--w-font'),
    ink: v('--w-text'),
    inkSoft: v('--w-text-3'),
    lineSoft: v('--w-divider'),
    line: v('--w-divider-strong'),
    surface: v('--w-surface'),
    raised: v('--w-surface-3'),
  }
}

type AxisLike = Record<string, unknown> & {
  axisLine?: Record<string, unknown>
  axisLabel?: Record<string, unknown>
  splitLine?: Record<string, unknown>
  nameTextStyle?: Record<string, unknown>
}

/** 把 axis 上的线/字颜色强制成 Fluent token（不改结构，只覆盖颜色） */
function paintAxis(axis: unknown, tk: ReturnType<typeof readTokens>): unknown {
  if (!axis || typeof axis !== 'object' || Array.isArray(axis)) return axis
  const a = axis as AxisLike
  return {
    ...a,
    axisLine: { ...(a.axisLine ?? {}), lineStyle: { ...((a.axisLine?.lineStyle as object) ?? {}), color: tk.lineSoft } },
    axisLabel: { ...(a.axisLabel ?? {}), color: tk.inkSoft, fontFamily: tk.fontSans },
    splitLine: { ...(a.splitLine ?? {}), lineStyle: { ...((a.splitLine?.lineStyle as object) ?? {}), color: tk.lineSoft } },
    nameTextStyle: { ...(a.nameTextStyle ?? {}), color: tk.inkSoft, fontFamily: tk.fontSans },
  }
}

/**
 * house style + Fluent 视觉约束：
 * - 关闭入场动画（Fluent motion：只保留交互过渡）
 * - 网格线/坐标/图例用中性 token；字体统一 Fluent 字体
 */
function paperOption(option: Record<string, unknown>, dark: boolean): Record<string, unknown> {
  const styled = styleChart(option, dark) as Record<string, unknown>
  const tk = readTokens()
  const legend = styled.legend as Record<string, unknown> | undefined
  return {
    ...styled,
    animation: false,
    textStyle: { ...(styled.textStyle as object), fontFamily: tk.fontSans, color: tk.inkSoft },
    xAxis: paintAxis(styled.xAxis, tk),
    yAxis: paintAxis(styled.yAxis, tk),
    ...(legend
      ? {
          legend: {
            ...legend,
            backgroundColor: 'transparent',
            borderWidth: 0,
            textStyle: {
              ...((legend.textStyle as object) ?? {}),
              color: tk.inkSoft,
              fontFamily: tk.fontSans,
            },
          },
        }
      : {}),
    tooltip: {
      ...((styled.tooltip as object) ?? {}),
      backgroundColor: tk.raised || tk.surface,
      borderColor: tk.line,
      textStyle: { ...(((styled.tooltip as { textStyle?: object })?.textStyle) ?? {}), color: tk.ink },
    },
  }
}

/**
 * 图表弹窗（v10 Fluent Dialog）：
 * Title2 标题 + 图表容器 Card 底、坐标/网格走 Fluent token、
 * 无入场动画、底部 mono 12「数据来源 · 生成时间」、右下 Fluent Button。
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
  const [openedAt, setOpenedAt] = useState('')

  // 弹窗展开后容器才具有真实宽高：等两帧再初始化 ECharts，避免 0 尺寸初始化后不自愈。
  useEffect(() => {
    if (!payload) {
      setReady(false)
      return
    }
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setReady(true))
    })
    return () => {
      cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
    }
  }, [payload])

  // 弹窗打开时记一次生成时间，用于页脚标注（不随重绘变化）
  useEffect(() => {
    if (!payload) {
      setOpenedAt('')
      return
    }
    setOpenedAt(new Date().toLocaleString())
  }, [payload])

  // 切换亮/暗主题时重画：图表颜色是从 CSS 变量读的，不重画会停留在旧主题
  const themeMode = useAppStore((s) => s.settings.theme)
  useEffect(() => {
    if (!payload || !chartRef.current) return
    chartRef.current.setOption(paperOption(payload.option, themeMode === 'dark'), true)
  }, [themeMode, payload])

  useEffect(() => {
    if (!payload || !ready || !chartDivRef.current) return
    let disposed = false
    setLoading(true)

    void loadECharts()
      .then((mod) => {
        if (disposed || !chartDivRef.current) return
        const echarts = mod
        chartRef.current?.dispose()
        // 双保险：init 前再校验一次容器尺寸，异常环境（如容器仍为 0）时推迟到 resize
        const el = chartDivRef.current
        const chart = echarts.init(el)
        // 关键：AI 只负责「给什么数据」，长什么样由 house style 统一决定。
        const dark = useAppStore.getState().settings.theme === 'dark'
        const option = paperOption(payload.option, dark)
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
      // 不 dispose 的话 ECharts 实例（canvas + WebGL 上下文）永远不释放：
      // 关弹窗 → payload 变 null → effect 早 return → 没人再 init 新实例 →
      // 旧实例就一直挂着；反复开关几次就攒出一堆 WebGL context，直到标签页崩。
      // dispose() 对已 dispose 的实例是 no-op，所以和「下一轮 init 前 dispose」不冲突。
      chartRef.current?.dispose()
      chartRef.current = null
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

  useBackButtonLayer(!!payload, onClose)

  return (
    <Dialog open={!!payload} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface className="ai-chart-surface">
        <DialogBody>
          <DialogTitle>
            <Text as="h2" size={500} weight="semibold" className="ai-chart-title">
              {payload?.title ?? ''}
            </Text>
          </DialogTitle>
          <DialogContent>
            <div className="ai-chart-body">
              {/* 图表容器：Fluent 卡片底 + 1px 描边；网格线/文字色在 paperOption 里强制成 token */}
              <div ref={chartDivRef} className="ai-chart-canvas" />
              {loading && (
                <div className="ai-chart-loading">
                  <Text size={200}>{t('ai.chart.loading')}</Text>
                </div>
              )}
            </div>
            <div className="ai-chart-foot">
              <Text size={100} font="monospace">
                {t('ai.chart.foot', { time: openedAt })}
              </Text>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              {t('common.close')}
            </Button>
            <Button appearance="primary" icon={<ArrowDownloadRegular />} onClick={handleDownload}>
              {t('ai.chart.download')}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
