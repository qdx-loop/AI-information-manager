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
import { buildTheme, semanticOf, FONT_STACK, MONO_STACK } from '@/theme'
import './styles/index.css'

/**
 * 与主题无关的静态 token（字体/字阶/间距/圆角/尺寸/阴影）。
 * 只注入一次：不随亮暗变化，放主题 effect 里会做无谓重排。
 *
 * v3『石墨信号』：现代产品感（Linear/Notion/Figma 一类）。
 * 字体：Inter 自托管 latin 子集 + 系统中文链（禁止网络字体）。
 */
function injectStaticTokens() {
  const el = document.documentElement
  const vars: Record<string, string> = {
    '--font-sans': FONT_STACK,
    '--font-mono': MONO_STACK,
    // v3 全站去衬线；保留变量名只为旧代码不报错，值等同无衬线
    '--font-serif': FONT_STACK,

    // 字阶（只允许这 8 档）
    '--text-2xs': '12px',
    '--text-xs': '13px',
    '--text-sm': '14px',
    '--text-base': '16px',
    '--text-lg': '20px',
    '--text-xl': '24px',
    '--text-2xl': '32px',
    '--text-3xl': '44px',
    '--leading-2xs': '1.4',
    '--leading-xs': '1.45',
    '--leading-sm': '1.5',
    '--leading-base': '1.7',
    '--leading-lg': '1.35',
    '--leading-xl': '1.3',
    '--leading-2xl': '1.2',
    '--leading-3xl': '1.1',

    // 间距：4 的倍数，页面上只用 4/8/12/16/20/24/32/40/48/64
    '--space-1': '4px',
    '--space-2': '8px',
    '--space-3': '12px',
    '--space-4': '16px',
    '--space-5': '20px',
    '--space-6': '24px',
    '--space-7': '32px',
    '--space-8': '40px',
    '--space-9': '48px',
    '--space-10': '64px',

    // 圆角：4 / 8 / 10 / 12（上限 12；999 仅头像与状态点）
    '--r-1': '4px',
    '--r-2': '8px',
    '--r-3': '10px',
    '--r-4': '12px',
    '--r-pill': '999px',

    // 尺寸
    '--control-h': '36px',
    '--control-h-sm': '32px',
    '--control-h-lg': '40px',
    '--row-h': '38px',
    '--row-h-sm': '32px',
    '--row-h-lg': '44px',
    '--table-head-h': '40px',
    '--header-h': '52px',
    '--sider-w': '240px',
    '--ai-w': '360px',
    '--content-max': '1120px',

    // 阴影：三级（卡片 / 浮层 / 弹窗）；其余一律无阴影
    '--shadow-1': '0 1px 2px rgba(16, 24, 40, 0.05)',
    '--shadow-2': '0 1px 2px rgba(16, 24, 40, 0.04), 0 4px 12px rgba(16, 24, 40, 0.08)',
    '--shadow-3': '0 12px 32px rgba(16, 24, 40, 0.14), 0 2px 6px rgba(16, 24, 40, 0.06)',
    // 旧名兼容
    '--shadow-pop': 'var(--shadow-2)',
    '--shadow-sheet': '0 -1px 0 var(--border), 0 -8px 24px rgba(16, 24, 40, 0.08)',
    '--app-mono': MONO_STACK,
  }
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v)
}

dayjs.locale(useAppStore.getState().settings.language === 'en' ? 'en' : 'zh-cn')

// 应用启动前根据设置初始化存储 provider
initFromSettings(useAppStore.getState().settings)

// —— 白屏保险丝：任何未捕获的启动错误都渲染成可见提示，而不是一片空白 ——
// 手机端（尤其 iOS Safari/老安卓 WebView）出问题时用户只看到白屏，无法上报原因。
function renderBootError(err: unknown) {
  const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
  const el = document.getElementById('root')
  if (!el || el.childElementCount > 0) return // React 已挂载成功则不打扰
  el.innerHTML = `<div style="font-family:system-ui;padding:32px 20px;color:#b42318;background:#fafafa;min-height:100vh;word-break:break-all">
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
    // 无障碍/读屏/翻译软件按 <html lang> 判断语言。
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'
  }, [lang])
  // 静态 token 只注入一次
  useEffect(() => {
    injectStaticTokens()
  }, [])
  // 主题色变量注入 <html>：CSS 只消费变量，不重复写死色值
  useEffect(() => {
    const mode = themeMode === 'dark' ? 'dark' : 'light'
    const el = document.documentElement
    el.setAttribute('data-theme', mode)
    el.style.colorScheme = mode
    const c = semanticOf(mode)
    const vars: Record<string, string> = {
      // —— v3 新命名 ——
      '--bg-canvas': c.canvas,
      '--bg-surface': c.surface,
      '--bg-sunken': c.sunken,
      '--bg-raised': c.raised,
      '--bg-overlay': c.overlay,
      '--ink': c.ink,
      '--ink-muted': c.inkMuted,
      '--ink-faint': c.inkFaint,
      '--border': c.border,
      '--border-strong': c.borderStrong,
      '--border-rule': c.borderRule,
      '--accent': c.accent,
      '--accent-hover': c.accentHover,
      '--accent-wash': c.accentWash,
      '--accent-ring': c.accentRing,
      '--action': c.action,
      '--action-hover': c.actionHover,
      '--focus': c.focus,
      '--danger': c.danger,
      '--danger-wash': c.dangerWash,
      '--success': c.success,
      '--success-wash': c.successWash,
      '--warning': c.warning,
      '--warning-wash': c.warningWash,

      // —— 旧变量名兼容映射（旧页面/第三方片段仍可能引用） ——
      '--app-surface': c.surface,
      '--app-surface-sunken': c.sunken,
      '--app-surface-raised': c.raised,
      '--app-canvas': c.canvas,
      '--app-overlay': c.overlay,
      '--app-ink': c.ink,
      '--app-ink-soft': c.inkMuted,
      '--app-ink-faint': c.inkFaint,
      '--app-border': c.border,
      '--app-border-strong': c.borderStrong,
      '--app-border-soft': c.borderRule,
      '--app-rule': c.borderRule,
      '--app-accent': c.accent,
      '--app-accent-text': c.accent,
      '--app-accent-wash': c.accentWash,
      '--app-action': c.action,
      '--app-action-hover': c.actionHover,
      '--app-success': c.success,
      '--app-warning': c.warning,
      '--app-warning-wash': c.warningWash,
      '--app-danger': c.danger,
      '--app-danger-wash': c.dangerWash,
      '--app-focus': c.focus,
      '--app-glaze': c.accent,
      '--app-glaze-text': c.accent,
      '--app-glaze-soft': c.accentWash,
      '--app-glaze-soft-strong': c.sunken,
      '--app-kiln': c.warning,
      '--app-kiln-text': c.warning,
      '--app-kiln-wash': c.warningWash,
      '--app-pinned-wash': c.accentWash,
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
