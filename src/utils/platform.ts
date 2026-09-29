/**
 * 运行环境判断。
 *
 * 「当前是否在安卓 App 内」的判断以前靠 `document.referrer` 里有没有 `android-app://`
 * —— 那是 Trusted Web Activity（TWA，Chrome 内核）的特征。但 1.1.1 起 App 换成了
 * 纯 WebView 壳，`document.referrer` 恒为空，那个判断从此永远为假。
 * 现在改用 WebView 主动在 User-Agent 上追加的标记（见 apk-build 的 MainActivity），
 * 立即可得、不污染 URL、也不依赖任何 HTTP 头。
 *
 * 注意：判断依据是 UA，可以被伪造。但它只用来决定「显示落地页还是登录页」这类
 * 展示问题，不参与任何鉴权，因此伪造它没有收益，也就没有风险。
 */

// 与 MainActivity.java 里的 APP_UA_TOKEN 保持一致
const APP_UA_TOKEN = 'InfoDeskApp/'

/** TWA 时代的老特征，保留兼容以防旧安装包仍在运行 */
function hasLegacyTwaReferrer(): boolean {
  return typeof document !== 'undefined' && document.referrer.includes('android-app://')
}

/** 是否运行在安卓 App 壳内 */
export function isAndroidApp(): boolean {
  if (typeof navigator !== 'undefined' && navigator.userAgent.includes(APP_UA_TOKEN)) return true
  return hasLegacyTwaReferrer()
}
