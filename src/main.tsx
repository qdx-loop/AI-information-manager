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
import { FluentProvider } from '@fluentui/react-components'
import { fluentWindowsLight, fluentWindowsDark } from '@/theme/fluent'
import './styles/index.css'

/**
 * v9 · WINDOWS 11 NATIVE
 *
 * 视觉 token 全部在 `src/styles/w11/tokens.css`（唯一来源）；这里只负责：
 *   - 主题模式写进 <html data-theme="dark|light">，CSS 变量随之切换
 *   - antd ConfigProvider / FluentProvider 使用 Win11 语义主题
 *   - 语言 / dayjs locale
 *
 * 旧版在 JS 里注入几十个颜色/尺寸变量并层层叠加 CSS 的做法已删除。
 */

const bootTheme = useAppStore.getState().settings.theme === 'light' ? 'light' : 'dark'
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', bootTheme)
  document.documentElement.style.colorScheme = bootTheme
}

dayjs.locale(useAppStore.getState().settings.language === 'en' ? 'en' : 'zh-cn')

// 应用启动前根据设置初始化存储 provider
initFromSettings(useAppStore.getState().settings)

// —— 白屏保险丝：任何未捕获的启动错误都渲染成可见提示，而不是一片空白 ——
function renderBootError(err: unknown) {
  const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
  const el = document.getElementById('root')
  if (!el || el.childElementCount > 0) return
  el.innerHTML = `<div style="font-family:'Segoe UI',system-ui,sans-serif;padding:32px 20px;color:#ff99a4;background:#202020;min-height:100vh;word-break:break-all">
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

  useEffect(() => {
    dayjs.locale(lang === 'en' ? 'en' : 'zh-cn')
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'
  }, [lang])

  // Win11 主题：只切换 data-theme，视觉变量在 CSS 中定义
  useEffect(() => {
    const mode = themeMode === 'dark' ? 'dark' : 'light'
    const el = document.documentElement
    el.setAttribute('data-theme', mode)
    el.style.colorScheme = mode
  }, [themeMode])

  return (
    <ConfigProvider
      locale={lang === 'en' ? enUS : zhCN}
      theme={buildTheme(themeMode === 'dark' ? 'dark' : 'light')}
    >
      <FluentProvider
        theme={themeMode === 'dark' ? fluentWindowsDark : fluentWindowsLight}
        style={{ height: '100%', background: 'transparent' }}
      >
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
