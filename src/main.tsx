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
import { buildTheme, semanticOf, FONT_STACK, SERIF_STACK, MONO_STACK } from '@/theme'
import './styles/index.css'

/**
 * 与主题无关的静态 token（字体/字阶/间距/圆角/高度/阴影）。
 * 只注入一次：它们不随亮暗变化，放在 theme 切换的 effect 里会做无谓的重排。
 *
 * 命名沿用研究 brief 的 `--text-* / --space-* / --r-*`，业务组件可以直接消费；
 * 颜色仍然全部来自 semanticOf()，避免「TS 改了 CSS 忘同步」的漂移。
 */
function injectStaticTokens() {
  const el = document.documentElement
  const vars: Record<string, string> = {
    '--font-sans': FONT_STACK,
    '--font-serif': SERIF_STACK,
    '--font-mono': MONO_STACK,
    // 字阶：8 档，删掉一切半像素（旧 CSS 有 17 种 font-size / 6 个半像素档）
    '--text-2xs': '11px',
    '--text-xs': '12px',
    '--text-sm': '13px',
    '--text-base': '14px',
    '--text-md': '16px',
    '--text-lg': '20px',
    '--text-xl': '26px',
    '--text-2xl': '34px',
    '--leading-2xs': '1.4',
    '--leading-xs': '1.5',
    '--leading-sm': '1.5',
    '--leading-base': '1.6',
    '--leading-md': '1.75',
    '--leading-lg': '1.4',
    '--leading-xl': '1.3',
    '--leading-2xl': '1.2',
    // 间距档位：只允许 4/8/12/16/20/24/32/48
    '--space-1': '4px',
    '--space-2': '8px',
    '--space-3': '12px',
    '--space-4': '16px',
    '--space-5': '20px',
    '--space-6': '24px',
    '--space-7': '32px',
    '--space-8': '48px',
    // 圆角：表格 0 / 输入 2 / 按钮卡片 4 / 浮层 6；禁止药丸
    '--r-1': '2px',
    '--r-2': '4px',
    '--r-3': '6px',
    '--control-h': '32px',
    '--control-h-sm': '28px',
    '--row-h': '32px',
    '--row-h-compact': '28px',
    // 只有浮层允许阴影；卡片/按钮/表格行为 0
    '--shadow-pop': '0 1px 2px rgba(28,26,22,.06), 0 8px 24px rgba(28,26,22,.10)',
    '--shadow-sheet': '0 -1px 0 var(--app-border-soft), 0 -8px 24px rgba(28,26,22,.08)',
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
  el.innerHTML = `<div style="font-family:system-ui;padding:32px 20px;color:#b91c1c;background:#fff;min-height:100vh;word-break:break-all">
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
    // 无障碍/读屏/翻译软件按 <html lang> 判断语言。切到英文后必须同步更新，
    // 否则英文界面仍被当成中文渲染（字重、断行、读屏发音都会错）。
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'
  }, [lang])
  // 静态 token 只注入一次（字体/字阶/间距/圆角/阴影，与亮暗无关）
  useEffect(() => {
    injectStaticTokens()
  }, [])
  // 把主题写到 <html> 上，纯 CSS（状态行底色、点击区）才能跟着切换
  useEffect(() => {
    const mode = themeMode === 'dark' ? 'dark' : 'light'
    const el = document.documentElement
    el.setAttribute('data-theme', mode)
    el.style.colorScheme = mode
    // --app-* 变量直接由语义层注入，CSS 里不再重复写死色值，
    // 避免「TS 里改了、忘记同步 CSS」这种漂移。
    const c = semanticOf(mode)
    const vars: Record<string, string> = {
      // —— 表面 ——
      '--app-surface': c.surface,
      '--app-surface-sunken': c.surfaceSunken,
      '--app-surface-raised': c.surfaceRaised,
      '--app-canvas': c.canvas,
      '--app-overlay': c.overlay,
      // —— 墨阶 ——
      '--app-ink': c.ink,
      '--app-ink-soft': c.inkSoft,
      '--app-ink-faint': c.inkFaint,
      // —— 线 ——
      '--app-border': c.border,
      '--app-border-strong': c.borderStrong,
      '--app-border-soft': c.borderSoft,
      '--app-rule': c.rule,
      // —— 朱砂：只做标记（选中/焦点/批注/印章） ——
      '--app-accent': c.accent,
      '--app-accent-text': c.accentText,
      '--app-accent-wash': c.accentWash,
      // —— 墨色主按钮 ——
      '--app-action': c.action,
      '--app-action-hover': c.actionHover,
      // —— 状态 ——
      '--app-success': c.success,
      '--app-warning': c.warning,
      '--app-warning-wash': c.warningWash,
      '--app-danger': c.danger,
      '--app-danger-wash': c.dangerWash,
      '--app-focus': c.focus,
      // —— 旧变量名兼容映射（组件里仍有引用，值已按新体系重映射） ——
      '--app-glaze': c.glaze,
      '--app-glaze-text': c.glazeText,
      '--app-glaze-soft': c.glazeSoft,
      '--app-glaze-soft-strong': c.glazeSoftStrong,
      '--app-kiln': c.kiln,
      '--app-kiln-text': c.kilnText,
      '--app-kiln-wash': c.kilnWash,
      '--app-pinned-wash': c.pinnedWash,
      '--app-mono': MONO_STACK,
    }
    for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v)
    c.series.forEach((col, i) => el.style.setProperty(`--app-series-${i}`, col))
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
