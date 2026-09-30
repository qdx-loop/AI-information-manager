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
import './styles/index.css'

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
  }, [lang])
  // 把主题写到 <html> 上，纯 CSS（状态行底色、点击区）才能跟着切换
  useEffect(() => {
    const el = document.documentElement
    el.setAttribute('data-theme', themeMode === 'dark' ? 'dark' : 'light')
    el.style.colorScheme = themeMode === 'dark' ? 'dark' : 'light'
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
