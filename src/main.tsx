import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import App from './App'
import { initFromSettings } from '@/db/providerFactory'
import { useAppStore } from '@/store/appStore'
import { autoSyncManager } from '@/utils/autoSync'
import { buildTheme, semanticOf, DISPLAY_STACK, BODY_STACK, MONO_STACK } from '@/theme'
import './styles/index.css'

/**
 * 静态 token（字体/字阶/间距/圆角/尺寸），与亮暗无关，只注入一次。
 *
 * v4『硬边印刷 SIGNAL PRESS』：
 *   Display = Outfit（自托管 latin 子集），Body = Work Sans（自托管 latin 子集），
 *   Mono = 系统等宽（标签/编号/ID/时间）；中文回退系统黑体。
 *   零圆角、2px 硬边、硬投影、12 列栅格。
 */
function injectStaticTokens() {
  const el = document.documentElement
  const vars: Record<string, string> = {
    '--font-display': DISPLAY_STACK,
    '--font-body': BODY_STACK,
    '--font-mono': MONO_STACK,

    // 字阶：12→64，标题与正文分工明确
    '--t-2xs': '11px',
    '--t-xs': '12px',
    '--t-sm': '13px',
    '--t-base': '14px',
    '--t-md': '15px',
    '--t-lg': '16px',
    '--t-xl': '18px',
    '--t-2xl': '22px',
    '--t-3xl': '28px',
    '--t-4xl': '36px',
    '--t-5xl': '48px',
    '--t-6xl': '64px',
    '--lh-2xs': '1.3',
    '--lh-xs': '1.4',
    '--lh-sm': '1.45',
    '--lh-base': '1.55',
    '--lh-md': '1.55',
    '--lh-lg': '1.5',
    '--lh-xl': '1.4',
    '--lh-2xl': '1.3',
    '--lh-3xl': '1.2',
    '--lh-4xl': '1.12',
    '--lh-5xl': '1.05',
    '--lh-6xl': '1.0',

    // 间距：4 的倍数
    '--s1': '4px',
    '--s2': '8px',
    '--s3': '12px',
    '--s4': '16px',
    '--s5': '20px',
    '--s6': '24px',
    '--s7': '32px',
    '--s8': '40px',
    '--s9': '48px',
    '--s10': '64px',
    '--s11': '80px',
    '--s12': '96px',

    // 圆角：玻璃语言（12/16/20/28 + 胶囊）
    '--radius-sm': '6px',
    '--radius-md': '8px',
    '--radius-lg': '10px',
    '--radius-xl': '12px',
    '--radius-pill': '999px',
    '--border-width': '1px',
    '--glass-blur': '0px',
    '--glass-blur-strong': '0px',

    // 尺寸
    '--topbar-h': '56px',
    '--rail-w': '264px',
    '--control-h': '40px',
    '--control-h-sm': '32px',
    '--control-h-lg': '48px',
    '--row-h': '44px',
    '--row-h-sm': '36px',
    '--row-h-lg': '52px',
    '--table-head-h': '44px',
    '--content-max': '1440px',
    '--ai-w': '400px',
  }
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v)
}

dayjs.locale(useAppStore.getState().settings.language === 'en' ? 'en' : 'zh-cn')

// 应用启动前根据设置初始化存储 provider
initFromSettings(useAppStore.getState().settings)

// —— 白屏保险丝：任何未捕获的启动错误都渲染成可见提示，而不是一片空白 ——
function renderBootError(err: unknown) {
  const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
  const el = document.getElementById('root')
  if (!el || el.childElementCount > 0) return
  el.innerHTML = `<div style="font-family:system-ui;padding:32px 20px;color:#DC2626;background:#EEF1F8;min-height:100vh;word-break:break-all">
    <h2 style="margin:0 0 12px">页面加载出错</h2>
    <p style="margin:0 0 12px">请截图反馈给管理员。常见解决方式：更新浏览器 / 清除该网站数据后重试。</p>
    <pre style="white-space:pre-wrap;font-size:12px;line-height:1.6">${msg.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))}</pre>
  </div>`
  console.error('[boot]', err)
}
window.addEventListener('error', (e) => { if (document.getElementById('root')?.childElementCount === 0) renderBootError(e.error ?? e.message) })
window.addEventListener('unhandledrejection', (e) => { if (document.getElementById('root')?.childElementCount === 0) renderBootError(e.reason) })

// 关闭/切走页面时自动上传数据到云端（云端模式下生效）
autoSyncManager.installGlobalHooks()

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeMode = useAppStore((s) => s.settings.theme)
  const lang = useAppStore((s) => s.settings.language ?? 'zh')
  useEffect(() => {
    dayjs.locale(lang === 'en' ? 'en' : 'zh-cn')
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'
  }, [lang])
  useEffect(() => {
    injectStaticTokens()
  }, [])
  // 主题变量注入 <html>：CSS 只消费变量
  useEffect(() => {
    const mode = themeMode === 'dark' ? 'dark' : 'light'
    const el = document.documentElement
    el.setAttribute('data-theme', mode)
    el.style.colorScheme = mode
    const c = semanticOf(mode)
    const vars: Record<string, string> = {
      // —— 画布与玻璃 ——
      '--bg': c.bg,
      '--surface': c.surface,
      '--surface-solid': c.surfaceSolid,
      '--surface-2': c.surface2,
      '--glass-border': c.glassBorder,
      '--border': c.border,
      '--border-strong': c.borderStrong,
      // —— 文字 ——
      '--text': c.text,
      '--text-secondary': c.textSecondary,
      '--text-muted': c.textMuted,
      // —— 品牌 ——
      '--accent': c.accent,
      '--accent-hover': c.accentHover,
      '--accent-soft': c.accentSoft,
      '--accent-2': c.accent2,
      '--accent-gradient': c.accentGradient,
      // —— 语义 ——
      '--danger': c.danger,
      '--danger-soft': c.dangerSoft,
      '--success': c.success,
      '--success-soft': c.successSoft,
      '--warning': c.warning,
      '--warning-soft': c.warningSoft,
      '--on-accent': c.onAccent,
      '--on-dark': c.onDark,
      '--dark-panel': c.darkPanel,
      '--overlay': c.overlay,
      '--shadow-color': c.shadowColor,
      '--focus': c.focus,
      // —— 柔和阴影（无硬投影） ——
      '--shadow-1': '0 1px 2px rgba(9,9,11,0.04)',
      '--shadow-2': '0 1px 3px rgba(9,9,11,0.06), 0 8px 24px rgba(9,9,11,0.08)',
      '--shadow-3': '0 24px 64px rgba(9,9,11,0.16)',
      '--shadow-glow': '0 0 0 3px rgba(37,99,235,0.14)',
      '--shadow-inset': 'none',
      // —— 极光光球（画布背景由 CSS 组合） ——
      '--aurora-1': mode === 'dark' ? 'rgba(99,102,241,0.40)' : 'rgba(99,102,241,0.46)',
      '--aurora-2': mode === 'dark' ? 'rgba(34,211,238,0.24)' : 'rgba(34,211,238,0.34)',
      '--aurora-3': mode === 'dark' ? 'rgba(244,114,182,0.18)' : 'rgba(244,114,182,0.26)',
      '--aurora-base': mode === 'dark' ? '#09090B' : '#FAFAFA',
      '--glass-sheen': 'none',
    }
    for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v)
    c.series.forEach((col, i) => {
      el.style.setProperty(`--chart-${i + 1}`, col)
      el.style.setProperty(`--app-series-${i}`, col)
    })
  }, [themeMode])
  return (
    <ConfigProvider
      locale={lang === 'en' ? enUS : zhCN}
      theme={buildTheme(themeMode === 'dark' ? 'dark' : 'light')}
    >
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
