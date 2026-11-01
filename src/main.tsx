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

    // 字阶：8 档 + 3 档展示用（Display 只给标题/大数字）
    '--t-2xs': '11px',
    '--t-xs': '12px',
    '--t-sm': '13px',
    '--t-base': '15px',
    '--t-md': '17px',
    '--t-lg': '20px',
    '--t-xl': '24px',
    '--t-2xl': '32px',
    '--t-3xl': '40px',
    '--t-4xl': '56px',
    '--t-5xl': '72px',
    '--lh-2xs': '1.3',
    '--lh-xs': '1.35',
    '--lh-sm': '1.45',
    '--lh-base': '1.6',
    '--lh-md': '1.6',
    '--lh-lg': '1.3',
    '--lh-xl': '1.2',
    '--lh-2xl': '1.15',
    '--lh-3xl': '1.05',
    '--lh-4xl': '0.98',
    '--lh-5xl': '0.95',

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

    // 圆角：硬边语言，只允许 0/2 与状态点
    '--r-0': '0px',
    '--r-1': '2px',
    '--r-pill': '999px',
    '--bw': '2px',

    // 尺寸
    '--topbar-h': '64px',
    '--rail-w': '264px',
    '--control-h': '40px',
    '--control-h-sm': '32px',
    '--control-h-lg': '48px',
    '--row-h': '40px',
    '--row-h-sm': '32px',
    '--row-h-lg': '48px',
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
  el.innerHTML = `<div style="font-family:system-ui;padding:32px 20px;color:#C22A1C;background:#ECE9E0;min-height:100vh;word-break:break-all">
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
      '--paper': c.paper,
      '--sheet': c.sheet,
      '--panel': c.panel,
      '--ink': c.ink,
      '--ink-soft': c.inkSoft,
      '--ink-faint': c.inkFaint,
      '--line': c.line,
      '--line-soft': c.lineSoft,
      '--lime': c.lime,
      '--lime-hover': c.limeHover,
      '--lime-wash': c.limeWash,
      '--signal': c.signal,
      '--danger': c.danger,
      '--danger-wash': c.dangerWash,
      '--success': c.success,
      '--success-wash': c.successWash,
      '--warning': c.warning,
      '--warning-wash': c.warningWash,
      '--on-lime': c.onLime,
      '--on-ink': c.onInk,
      '--overlay': c.overlay,
      '--shadow-ink': c.shadowInk,
      '--focus': c.focus,
      '--shadow-1': `2px 2px 0 ${c.shadowInk}`,
      '--shadow-2': `4px 4px 0 ${c.shadowInk}`,
      '--shadow-3': `8px 8px 0 ${c.shadowInk}`,
      '--shadow-press': `1px 1px 0 ${c.shadowInk}`,

      // —— 过渡期兼容：旧页面在重排完成前仍会引用 v2/v3 变量，全部映射到 v4 ——
      '--app-surface': c.sheet,
      '--app-surface-sunken': c.panel,
      '--app-surface-raised': c.sheet,
      '--app-canvas': c.paper,
      '--app-overlay': c.overlay,
      '--app-ink': c.ink,
      '--app-ink-soft': c.inkSoft,
      '--app-ink-faint': c.inkFaint,
      '--app-border': c.line,
      '--app-border-strong': c.line,
      '--app-border-soft': c.lineSoft,
      '--app-rule': c.lineSoft,
      '--app-accent': c.lime,
      '--app-accent-text': c.ink,
      '--app-accent-wash': c.limeWash,
      '--app-action': c.ink,
      '--app-action-hover': c.signal,
      '--app-focus': c.focus,
      '--app-danger': c.danger,
      '--app-danger-wash': c.dangerWash,
      '--app-success': c.success,
      '--app-warning': c.warning,
      '--app-warning-wash': c.warningWash,
      '--app-glaze': c.lime,
      '--app-glaze-text': c.ink,
      '--app-glaze-soft': c.limeWash,
      '--app-glaze-soft-strong': c.panel,
      '--app-kiln': c.signal,
      '--app-kiln-text': c.signal,
      '--app-kiln-wash': c.warningWash,
      '--app-pinned-wash': c.limeWash,
      '--bg-canvas': c.paper,
      '--bg-surface': c.sheet,
      '--bg-sunken': c.panel,
      '--bg-raised': c.sheet,
      '--border': c.line,
      '--border-strong': c.line,
      '--border-rule': c.lineSoft,
      '--accent': c.lime,
      '--accent-hover': c.limeHover,
      '--accent-wash': c.limeWash,
      '--action': c.ink,
      '--action-hover': c.signal,
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
