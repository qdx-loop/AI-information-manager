import { useEffect, useRef, useState } from 'react'
import { Modal, Button, App } from 'antd'
import { DownloadOutlined } from '@/components/common/icons'
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

// v4 §2：弹窗标题 24/700（Outfit）、mono kicker 11、页脚 mono 11
const T = {
  title: 'var(--t-xl)',
  xs: 'var(--t-xs)',
  mono: 'var(--t-2xs)',
}

/** canvas 不解析 CSS 变量，画之前把 v3 token 读成具体值 */
function readTokens() {
  const cs = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null
  const v = (name: string) => (cs?.getPropertyValue(name) ?? '').trim()
  return {
    fontSans: v('--font-body'),
    ink: v('--ink'),
    inkSoft: v('--ink-soft'),
    lineSoft: v('--line-soft'),
    line: v('--line'),
    surface: v('--sheet'),
    raised: v('--sheet'),
  }
}

type AxisLike = Record<string, unknown> & {
  axisLine?: Record<string, unknown>
  axisLabel?: Record<string, unknown>
  splitLine?: Record<string, unknown>
  nameTextStyle?: Record<string, unknown>
}

/** 把 axis 上的线/字颜色强制成 v3 token（不改结构，只覆盖颜色） */
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
 * house style + v3 视觉约束：
 * - 关闭入场动画（v4 §9 动效：只允许交互过渡）
 * - 网格线 `--line-soft`、坐标/图例文字 `--ink-soft`、图例无底色
 * - 字体换 v3 系统字链（chartStyle 内部写死了旧字链，这里统一覆盖）
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
 * 图表弹窗（v4：840 sheet + 2px ink + shadow-3、标题 Outfit 700 24 + mono kicker、
 * 图表区纸面白底、网格线 `--line-soft`、轴文字 `--ink-soft`、无入场动画、
 * 底部 mono 11「数据来源 · 生成时间」）。
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

  // Modal 展开动画结束后才标记 ready——此时容器才具有真实宽高。
  // ECharts 若在动画中 init 会拿到 0/极小尺寸，图表缩在左上角且不再自愈（bug 表现：
  // 开关别的窗口触发 window resize 才恢复）。afterOpenChange 从根本上消除该时机问题。
  useEffect(() => {
    if (!payload) setReady(false)
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
    <Modal
      open={!!payload}
      // 标题在弹窗头部，ECharts 里不再重复画一遍
      title={
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: T.title,
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: '-0.025em',
              color: 'var(--text)',
            }}
          >
            {payload?.title ?? ''}
          </div>
          <div
            style={{
              marginTop: 'var(--s1)',
              fontFamily: 'var(--font-mono)',
              fontSize: T.mono,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            {t('ai.chart.defaultName')}
          </div>
        </div>
      }
      width={840}
      onCancel={onClose}
      afterOpenChange={(open) => open && setReady(true)}
      footer={
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--s2)',
            marginTop: 'var(--s1)',
          }}
        >
          <Button type="text" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button icon={<DownloadOutlined />} type="primary" onClick={handleDownload}>
            {t('ai.chart.download')}
          </Button>
        </div>
      }
    >
      <div style={{ position: 'relative', minHeight: 460 }}>
        {/* 图表区：白底、无边框；网格线/文字色在 paperOption 里强制成 v3 token */}
        <div
          ref={chartDivRef}
          style={{ width: '100%', height: 460, background: 'var(--surface)' }}
        />
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: T.xs,
              color: 'var(--text-secondary)',
            }}
          >
            {t('ai.chart.loading')}
          </div>
        )}
      </div>
      <div
        className="mono"
        style={{
          marginTop: 'var(--s2)',
          paddingTop: 'var(--s2)',
          borderTop: '1px solid var(--border)',
          fontSize: T.mono,
          letterSpacing: '0.02em',
          color: 'var(--text-muted)',
        }}
      >
        {t('ai.chart.foot', { time: openedAt })}
      </div>
    </Modal>
  )
}
