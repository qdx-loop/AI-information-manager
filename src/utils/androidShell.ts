/**
 * 安卓 App 壳（apk-build）与网页之间的桥。
 *
 * 只有两件事必须走原生，网页自己做不了：
 *  1. **导出落盘**：WebView 不会下载 `blob:` / `data:` URL，纯网页的 `a[download]` 在壳里静默失效。
 *     原生侧暴露 `AndroidDownload.save(name, base64)`（见 apk-build MainActivity 的 DownloadBridge）。
 *  2. **系统栏配色**：状态栏/导航栏是原生画的，网页切深浅主题时必须回传，
 *     否则深色界面配一条白色状态栏。原生侧暴露 `AndroidShell.setTheme('light'|'dark')`。
 *
 * 两个桥都可能不存在（普通浏览器、1.1.3 及更早的壳只有 AndroidDownload），
 * 所以调用点一律「探测后使用」，没有桥时退回网页原生做法。
 * 判断依据是 UA 之外的运行能力，不用 UA 猜版本。
 */

interface AndroidDownloadBridge {
  save?: (name: string, base64: string) => void
}

interface AndroidShellBridge {
  setTheme?: (mode: 'light' | 'dark') => void
}

function shellWindow(): { AndroidDownload?: AndroidDownloadBridge; AndroidShell?: AndroidShellBridge } {
  return window as unknown as { AndroidDownload?: AndroidDownloadBridge; AndroidShell?: AndroidShellBridge }
}

/** 壳是否提供导出落盘能力（1.1.x 的壳就有） */
export function hasAndroidDownloadBridge(): boolean {
  return typeof window !== 'undefined' && typeof shellWindow().AndroidDownload?.save === 'function'
}

/**
 * 单次过桥的体积上限。
 * 桥的入参是一个 base64 字符串：二进制 → base64 会放大 4/3，JS 字符串 + JNI 拷贝再翻一倍，
 * 24 MB 的文件峰值就要上百 MB 内存，低端机直接 OOM。超过就走网页原路径（壳里会提示改用浏览器）。
 */
const MAX_BRIDGE_BYTES = 24 * 1024 * 1024

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 0x8000 // 一次 32 KB，避免 apply 参数过多导致栈溢出
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

/** 交给壳保存到系统「下载」目录。返回 false 表示「这个桥没接住，请调用方走网页原路径」。 */
export async function saveViaAndroidShell(filename: string, blob: Blob): Promise<boolean> {
  const bridge = shellWindow().AndroidDownload
  if (typeof bridge?.save !== 'function') return false
  if (blob.size > MAX_BRIDGE_BYTES) return false
  try {
    bridge.save(filename, toBase64(new Uint8Array(await blob.arrayBuffer())))
    return true
  } catch {
    return false
  }
}

/** 把当前主题同步给壳（状态栏/导航栏底色与图标明暗）。没有壳时是空操作。 */
export function syncAndroidShellTheme(mode: 'light' | 'dark'): void {
  if (typeof window === 'undefined') return
  shellWindow().AndroidShell?.setTheme?.(mode)
}
