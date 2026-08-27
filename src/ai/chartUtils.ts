// AI 生成图表的规范化与校验：把模型的自由输出收敛为安全的 ECharts 配置。
// 不合格……返回 null，由调用方告知 AI 重试（形成自我纠错闭环）。

const PALETTE = ['#0D9488', '#0EA5E9', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981']

interface SeriesLike {
  type?: string
  data?: unknown
  [k: string]: unknown
}

export function normalizeChartOption(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const opt = JSON.parse(JSON.stringify(raw)) as Record<string, unknown> // 深拷贝去污染
  const series = opt.series
  if (!Array.isArray(series) || series.length === 0) return null

  const first = series[0] as SeriesLike
  const isPie = first?.type === 'pie'

  // 数据量校验：至少要有一条可画的数据
  const hasData = series.some((s) => Array.isArray((s as SeriesLike).data) && ((s as SeriesLike).data as unknown[]).length > 0)
  if (!hasData) return null

  // 柱/折线必须给出分类轴数据，否则画面是空的——退回让 AI 补齐
  if (!isPie) {
    const x = opt.xAxis as { type?: string; data?: unknown } | undefined
    const hasCategories = x && (x.type === 'category' ? Array.isArray(x.data) && x.data.length > 0 : true)
    if (!hasCategories) return null
  }

  if (!opt.color) opt.color = PALETTE
  if (!opt.tooltip) opt.tooltip = { trigger: isPie ? 'item' : 'axis' }

  return opt
}
