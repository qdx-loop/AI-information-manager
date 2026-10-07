/**
 * AI 图表的「house style」。
 *
 * 之前的做法是把 AI 吐出的 ECharts 配置原样 setOption，只补了 tooltip 和 title，
 * 其余全是 ECharts 默认值：默认蓝、默认字体、挤在一起的网格线、没有数据标签、
 * 饼图切了 8 片还没图例。表现出来就是「能画，但很难看」。
 *
 * 这里按数据可视化的通行规则重做一遍外观。规则来源（多方一致）：
 * - 英国国家统计局 ONS：柱状/面积图的数值轴必须从 0 起，否则长度比例会骗人；
 *   网格线 3–6 条即可；不要用没有数值标签的次网格线；刻度线和网格线不要同时出现。
 * - NN/g：加了数据标签之后，纵轴和网格线就变成 chartjunk，应当去掉。
 * - 密苏里大学 IR：饼图优先环形，切片控制在 3–5 片、绝不超过 6 片。
 * - 加拿大统计局：类目名长时，纵向条形图放不下名字，应改用横向条形图。
 * - Berkeley BPM 清单：能用文字和数字讲清楚的（小数据），不要硬画图；
 *   边框、底色、3D 一律去掉。
 * - Fluent：品牌色不要铺满，大面积用中性色，颜色只用来区分系列。
 *
 * 做法是「从 AI 的输出里抽出数据，再按本套规范重建视觉配置」，
 * 而不是逐项覆盖 —— 这样无论 AI 写得多潦草，出来的图都是同一套样子。
 */

const MAX_PIE_SLICES = 5
/** 色盲安全的分类色只有 5 个（Okabe-Ito 子集），超出必须合并而不是再加颜色 */
const MAX_SERIES = 5
const MAX_BAR_CATEGORIES_INLINE = 14
const BAR_LABELS_MAX = 8
const LONG_LABEL = 7

export type ChartKind = 'bar' | 'line' | 'pie' | 'scatter' | 'other'

interface SeriesLite {
  name?: string
  type?: string
  data?: unknown[]
  stack?: string
  yAxisIndex?: number
  [k: string]: unknown
}

interface Parsed {
  kind: ChartKind
  categories: string[]
  series: SeriesLite[]
  xName: string
  yName: string
  /** 类目名平均长度，用来决定纵轴标签要不要转/截 */
  avgLabelLen: number
}

/** 读取当前主题的语义色（canvas 不解析 CSS 变量，必须在运行时取值） */
export interface ChartTokens {
  ink: string
  inkSoft: string
  inkFaint: string
  border: string
  borderSoft: string
  surface: string
  canvas: string
  series: string[]
  font: string
  danger: string
}

export function readChartTokens(dark: boolean): ChartTokens {
  const cs = getComputedStyle(document.documentElement)
  const v = (n: string, fb: string) => (cs.getPropertyValue(n) || '').trim() || fb
  const series: string[] = []
  for (let i = 0; i < 5; i++) series.push(v(`--app-series-${i}`, '#009E73'))
  return {
    ink: v('--app-ink', '#1F2328'),
    inkSoft: v('--app-ink-soft', '#4E5866'),
    inkFaint: v('--app-ink-faint', dark ? '#727C87' : '#66717E'),
    border: v('--app-border', dark ? '#2B3137' : '#D3D9DE'),
    borderSoft: v('--app-border-soft', dark ? '#23282D' : '#E3E8EC'),
    surface: v('--app-surface', '#FFFFFF'),
    canvas: v('--app-canvas', '#F5F7F8'),
    danger: v('--app-danger', dark ? '#F4785F' : '#C5351F'),
    series,
    font:
      "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
  }
}

// ── 数字排版 ────────────────────────────────────────────────

/** 大数字压缩成「万 / 亿 / k」，避免坐标轴出现 12345678 这种噪音 */
export function compactNumber(n: number): string {
  const abs = Math.abs(n)
  if (!isFinite(n)) return '—'
  if (abs >= 1e8) return `${+(n / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${+(n / 1e4).toFixed(abs >= 1e6 ? 0 : 1)}万`
  if (abs >= 1000) return n.toLocaleString('zh-CN')
  if (Number.isInteger(n)) return String(n)
  return String(+(+n).toFixed(2))
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    // 兼容 "1,234"、"73.5元"、"12%" 这类脏数据
    const cleaned = v.replace(/[,\s]/g, '').replace(/[^0-9.-]/g, '')
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : NaN
  }
  if (v && typeof v === 'object' && 'value' in (v as object)) {
    return toNum((v as { value: unknown }).value)
  }
  return NaN
}

// ── 解析 AI 的输出 ──────────────────────────────────────────

export function parseChartOption(raw: Record<string, unknown>): Parsed | null {
  const seriesRaw = raw.series
  if (!Array.isArray(seriesRaw) || seriesRaw.length === 0) return null
  const series = (seriesRaw as SeriesLite[]).filter((s) => s && typeof s === 'object')

  const first = series[0]?.type ?? 'bar'
  let kind: ChartKind = 'other'
  if (first === 'bar') kind = 'bar'
  else if (first === 'line') kind = 'line'
  else if (first === 'pie' || first === 'doughnut') kind = 'pie'
  else if (first === 'scatter') kind = 'scatter'

  const xAxis = raw.xAxis as { data?: unknown[]; name?: string } | undefined
  const xData = Array.isArray(xAxis?.data) ? xAxis!.data : []

  // 饼图的类目在 data 里 [{name,value}]
  let categories: string[] = []
  if (kind === 'pie') {
    categories = (series[0]?.data ?? []).map((d, i) => {
      const o = d as { name?: string }
      return typeof o === 'object' && o?.name ? String(o.name) : `第${i + 1}项`
    })
  } else {
    categories = xData.map((c, i) => (c == null ? `第${i + 1}项` : String(c)))
  }

  const yAxis = raw.yAxis as { name?: string } | { name?: string }[] | undefined
  const yName = Array.isArray(yAxis) ? (yAxis[0]?.name ?? '') : (yAxis?.name ?? '')
  const xName = xAxis?.name ?? ''

  const avgLabelLen = categories.length
    ? categories.reduce((s, c) => s + c.length, 0) / categories.length
    : 0

  return { kind, categories, series, xName, yName, avgLabelLen }
}

// ── 主入口：把 AI 的配置重建成规范外观 ──────────────────────

export function styleChart(raw: Record<string, unknown>, dark: boolean): Record<string, unknown> {
  const parsed = parseChartOption(raw)
  if (!parsed) return raw
  const tk = readChartTokens(dark)
  const p = parsed

  const base = {
    backgroundColor: 'transparent',
    animationDuration: 420,
    animationEasing: 'cubicOut',
    textStyle: { fontFamily: tk.font, color: tk.inkSoft },
    color: tk.series,
  }

  if (p.kind === 'pie') return stylePie(p, tk, base)
  if (p.kind === 'scatter') return styleScatter(p, tk, base)

  const isBar = p.kind === 'bar'
  const isStacked = p.series.some((s) => s.stack) || p.series.length > 1
  // 类目太多或名字太长 → 纵向条形图放不下，改横向（加拿大统计局的建议）
  const goHorizontal = isBar && (p.categories.length > MAX_BAR_CATEGORIES_INLINE || p.avgLabelLen > LONG_LABEL)
  const showLabels = isBar && p.categories.length <= BAR_LABELS_MAX
  // 有数据标签时纵轴刻度就是冗余信息（NN/g）
  const showAxisTicks = !showLabels

  // ONS：柱状图的数值轴必须从 0 起，否则条形长度会骗人
  let yMin: number | undefined
  if (isBar) yMin = 0

  const catAxis = {
    type: 'category',
    data: p.categories,
    name: p.xName || undefined,
    nameLocation: 'end' as const,
    nameGap: 12,
    nameTextStyle: { color: tk.inkFaint, fontSize: 12, align: 'left' as const },
    axisTick: { show: false },
    axisLine: { lineStyle: { color: tk.border } },
    axisLabel: { color: tk.inkSoft, fontSize: 12, hideOverlap: true, margin: 10 },
  }

  const valAxis = {
    type: 'value',
    name: p.yName || undefined,
    nameGap: 14,
    nameTextStyle: { color: tk.inkFaint, fontSize: 12, align: 'end' as const },
    min: yMin,
    // 3–6 条网格线（ONS 的建议上限），不画没有数值标签的次网格线
    splitNumber: 4,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      show: showAxisTicks,
      color: tk.inkFaint,
      fontSize: 12,
      formatter: (v: number) => compactNumber(v),
    },
    splitLine: { lineStyle: { color: tk.borderSoft, width: 1, type: 'solid' as const } },
  }

  // 系列超过色盲安全色数（5）时合并尾部，而不是循环取色 ——
  // 循环取色会让第 6 条和第 1 条同色，读者完全无法区分
  let seriesToDraw = p.series
  let mergedNote = ''
  if (p.series.length > MAX_SERIES) {
    const head = p.series.slice(0, MAX_SERIES - 1)
    const tail = p.series.slice(MAX_SERIES - 1)
    const mergedData: unknown[] = []
    const len = Math.max(...tail.map((s) => s.data?.length ?? 0), 0)
    for (let i = 0; i < len; i++) {
      let sum = 0
      for (const s of tail) {
        const v = (s.data ?? [])[i]
        const n = typeof v === 'number' ? v : Number(v) || 0
        sum += Number.isFinite(n) ? n : 0
      }
      mergedData.push(sum)
    }
    seriesToDraw = [...head, { name: `其他（${tail.length} 项）`, type: tail[0]?.type ?? 'bar', data: mergedData }]
    mergedNote = `已把 ${tail.length} 个次要系列合并为「其他」`
  }

  const styledSeries = seriesToDraw.map((s, i) => {
    const color = tk.series[i % tk.series.length]
    if (isBar) {
      return {
        ...s,
        type: goHorizontal ? 'bar' : 'bar',
        color,
        barMaxWidth: goHorizontal ? 18 : 26,
        // 圆角一点，视觉上比直角柱柔和
        itemStyle: { color, borderRadius: goHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
        label: showLabels
          ? {
              // 横向条形的数值放在条末端，纵向放在柱顶
              show: true,
              position: goHorizontal ? ('right' as const) : ('top' as const),
              color: tk.inkSoft,
              fontSize: 11,
              fontFamily: tk.font,
              formatter: (v: unknown) => compactNumber(toNum(v)),
            }
          : { show: false },
        emphasis: { itemStyle: { color, opacity: 0.85 } },
      }
    }
    return {
      ...s,
      type: 'line',
      color,
      smooth: 0.28,
      showSymbol: (s.data?.length ?? 0) <= 12,
      symbolSize: 6,
      lineStyle: { width: 2.4, color },
      itemStyle: { color },
      // 折线图不用数据标签，否则点一多就是一片糊
      areaStyle: isStacked ? undefined : { color, opacity: 0.07 },
      emphasis: { focus: 'series' as const },
    }
  })

  const tooltip = {
    trigger: 'axis' as const,
    backgroundColor: tk.surface,
    borderColor: tk.border,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: tk.ink, fontSize: 12, fontFamily: tk.font },
    axisPointer: {
      type: isBar ? ('shadow' as const) : ('line' as const),
      lineStyle: { color: tk.border },
      shadowStyle: { color: dark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)' },
    },
    // 大数字在提示里要显示完整值，不能用坐标轴那套压缩写法
    valueFormatter: (v: unknown) => {
      const n = toNum(v)
      if (Number.isNaN(n)) return String(v ?? '')
      return n.toLocaleString('zh-CN')
    },
  }

  // 标题由外层 Modal 显示，图内不再重复画一遍
  const legend =
    seriesToDraw.length > 1
      ? {
          show: true,
          top: 0,
          right: 0,
          icon: 'roundRect',
          itemWidth: 10,
          itemHeight: 10,
          itemGap: 14,
          // 图例要比它标注的数据更不显眼
          textStyle: { color: tk.inkFaint, fontSize: 12, fontFamily: tk.font },
        }
      : { show: false }

  return {
    ...base,
    grid: goHorizontal
      ? { left: 8, right: 56, top: seriesToDraw.length > 1 ? 34 : 16, bottom: 8, containLabel: true }
      : { left: 8, right: 16, top: seriesToDraw.length > 1 ? 34 : 16, bottom: 8, containLabel: true },
    tooltip,
    legend,
    xAxis: goHorizontal ? valAxis : catAxis,
    yAxis: goHorizontal ? { ...catAxis, inverse: true } : valAxis,
    series: styledSeries,
    __meta: mergedNote ? { overflowNote: mergedNote } : undefined,
  }
}


function stylePie(p: Parsed, tk: ChartTokens, base: Record<string, unknown>) {
  const raw = p.series[0]?.data ?? []
  let rows = raw
    .map((d) => {
      const o = d as { name?: string; value?: unknown }
      const name = typeof o === 'object' && o?.name ? String(o.name) : String(d)
      return { name, value: toNum(o?.value) }
    })
    .filter((r) => !Number.isNaN(r.value))

  rows = rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value)

  // 切片过多就读不动了：合并尾部（密苏里大学：绝不超过 6 片）
  let overflowNote = ''
  if (rows.length > MAX_PIE_SLICES) {
    const head = rows.slice(0, MAX_PIE_SLICES - 1)
    const tail = rows.slice(MAX_PIE_SLICES - 1)
    const sum = tail.reduce((s, r) => s + r.value, 0)
    rows = [...head, { name: `其他（${tail.length} 项）`, value: sum }]
    overflowNote = `已把 ${tail.length} 个小类合并为「其他」`
  }

  const total = rows.reduce((s, r) => s + r.value, 0) || 1
  const colors = rows.map((_, i) => tk.series[i % tk.series.length])

  return {
    ...base,
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: tk.surface,
      borderColor: tk.border,
      borderWidth: 1,
      textStyle: { color: tk.ink, fontSize: 12, fontFamily: tk.font },
      formatter: (o: { name: string; value: number; percent: number }) =>
        `${o.name}<br/>${o.value.toLocaleString('zh-CN')}（${o.percent}%）`,
    },
    legend: {
      // 环形图的中心空白提高可读性，且图例比数据更次要（密苏里大学 / NN/g）
      show: true,
      orient: 'vertical' as const,
      right: 8,
      top: 'middle' as const,
      icon: 'circle',
      itemWidth: 9,
      itemHeight: 9,
      itemGap: 12,
      textStyle: { color: tk.inkSoft, fontSize: 12, fontFamily: tk.font },
    },
    series: [
      {
        type: 'pie',
        // 环形而非实心饼图
        radius: ['46%', '72%'],
        center: ['38%', '52%'],
        avoidLabelOverlap: true,
        padAngle: 1.2,
        itemStyle: {
          borderColor: tk.surface,
          borderWidth: 2,
          borderRadius: 3,
        },
        // 直接标在扇区上，不依赖图例去读数
        label: {
          show: true,
          formatter: (o: { name: string; percent: number }) => `${o.percent}%`,
          color: tk.inkSoft,
          fontSize: 11,
          fontFamily: tk.font,
        },
        labelLine: { show: true, length: 8, length2: 8, lineStyle: { color: tk.border } },
        emphasis: { scaleSize: 4 },
        data: rows.map((r, i) => ({ ...r, itemStyle: { color: colors[i] } })),
      },
    ],
    __meta: { overflowNote, total },
  }
}

function styleScatter(p: Parsed, tk: ChartTokens, base: Record<string, unknown>) {
  return {
    ...base,
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: tk.surface,
      borderColor: tk.border,
      borderWidth: 1,
      textStyle: { color: tk.ink, fontSize: 12, fontFamily: tk.font },
    },
    legend: { show: p.series.length > 1, top: 0, right: 0, textStyle: { color: tk.inkFaint, fontSize: 12 } },
    xAxis: {
      type: 'value',
      scale: true,
      // 散点的点不连到轴上，可以裁剪坐标轴以看清差异（ONS）
      name: p.xName || undefined,
      nameTextStyle: { color: tk.inkFaint, fontSize: 12 },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: tk.inkFaint, fontSize: 12, formatter: (v: number) => compactNumber(v) },
      splitLine: { lineStyle: { color: tk.borderSoft } },
    },
    yAxis: {
      type: 'value',
      scale: true,
      name: p.yName || undefined,
      nameTextStyle: { color: tk.inkFaint, fontSize: 12 },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: tk.inkFaint, fontSize: 12, formatter: (v: number) => compactNumber(v) },
      splitLine: { lineStyle: { color: tk.borderSoft } },
    },
    series: p.series.map((s, i) => ({
      ...s,
      type: 'scatter',
      color: tk.series[i % tk.series.length],
      symbolSize: 9,
      itemStyle: { color: tk.series[i % tk.series.length], opacity: 0.85 },
    })),
  }
}
