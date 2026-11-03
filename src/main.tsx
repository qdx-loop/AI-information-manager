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
import { buildTheme } from '@/theme'
import { applyFluentThemeVars, fluentThemeOf } from '@/theme/win11'
import { FluentProvider } from '@fluentui/react-components'
import './styles/index.css'

/**
 * v10 · FLUENT UI 2 · Windows 11 应用（不是操作系统）
 *
 * 设计系统 = Fluent UI React v9（microsoft/fluentui）：
 *   - <FluentProvider theme={win11FluentLight|Dark}> 注入官方 Fluent theme；
 *   - 同一份 theme 的全部 token 映射到 <html> 的 CSS 变量，供布局 CSS 与 antd portal 使用；
 *   - antd ConfigProvider 的 token 由同一份 Fluent theme 派生（无第二套色板）；
 *   - 页面不再有壁纸/任务栏/窗口模拟。
 */

const bootMode: 'light' | 'dark' =
  useAppStore.getState().settings.theme === 'light' ? 'light' : 'dark'

if (typeof document !== 'undefined') {
  const el = document.documentElement
  el.setAttribute('data-theme', bootMode)
  el.style.colorScheme = bootMode
  // 首帧之前就把 Fluent token 写到 html，避免闪烁；应用内切换主题时也走同一函数
  applyFluentThemeVars(fluentThemeOf(bootMode), el)
}

dayjs.locale(useAppStore.getState().settings.language === 'en' ? 'en' : 'zh-cn')

// 应用启动前根据设置初始化存储 provider
initFromSettings(useAppStore.getState().settings)

// —— 白屏保险丝：任何未捕获的启动错误都渲染成可见提示，而不是一片空白 ——
function renderBootError(err: unknown) {
  const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
  const el = document.getElementById('root')
  if (!el || el.childElementCount > 0) return
  el.innerHTML = `<div style="font-family:'Segoe UI',system-ui,sans-serif;padding:32px 20px;color:#c50f1f;background:#202020;min-height:100vh;word-break:break-all">
    <h2 style="margin:0 0 12px">页面加载出错</h2>
    <p style="margin:0 0 12px;color:#d6d6d6">请截图反馈给管理员。常见解决方式：更新浏览器 / 清除该网站数据后重试。</p>
    <pre style="white-space:pre-wrap;font-size:12px;line-height:1.6;color:#a0a0a0">${msg.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))}</pre>
  </div>`
  console.error('[boot]', err)
}
window.addEventListener('error', (e) => {
  if (document.getElementById('root')?.childElementCount === 0) renderBootError(e.error ?? e.message)
})
window.addEventListener('unhandledrejection', (e) => {
  if (document.getElementById('root')?.childElementCount === 0) renderBootError(e.reason)
})

// 关闭/切走页面时自动上传数据到云端（云端模式下生效）
autoSyncManager.installGlobalHooks()

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeMode = useAppStore((s) => s.settings.theme)
  const lang = useAppStore((s) => s.settings.language ?? 'zh')
  const mode: 'light' | 'dark' = themeMode === 'dark' ? 'dark' : 'light'
  const fluentTheme = fluentThemeOf(mode)

  useEffect(() => {
    dayjs.locale(lang === 'en' ? 'en' : 'zh-cn')
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'
  }, [lang])

  // 主题：Fluent theme → <html> CSS 变量；页面只消费 token
  useEffect(() => {
    const el = document.documentElement
    el.setAttribute('data-theme', mode)
    el.style.colorScheme = mode
    applyFluentThemeVars(fluentTheme, el)
  }, [fluentTheme, mode])

  return (
    <ConfigProvider locale={lang === 'en' ? enUS : zhCN} theme={buildTheme(mode)}>
      <FluentProvider theme={fluentTheme} style={{ height: '100%', background: 'transparent' }}>
        <AntdApp>{children}</AntdApp>
      </FluentProvider>
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
