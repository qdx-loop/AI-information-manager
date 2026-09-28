import { useCallback, useEffect, useRef, useState } from 'react'
import { SITE } from '@/config/site'

/**
 * Cloudflare Turnstile 显式渲染封装。
 *
 * 为什么用显式渲染（render/reset）而不是 <Turnstile> 组件：不想为此新增 npm 依赖，
 * 而且注册表单提交后需要显式 reset 同一个 widget，逻辑放在这里更清楚。
 *
 * 关键行为：
 *  - 脚本 6 秒内没加载好就放弃（loadFailed）。此时**照常把 token 交给服务端**——
 *    服务端会按「故障降级」逻辑处理（见 functions/lib/turnstile.js），
 *    客户端不自行决定放行与否。
 *  - 脚本加载失败 / 渲染失败 / 用户被判定为机器人，都会把状态交给父组件，
 *    父组件据此禁用提交按钮并显示提示。
 */

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__iiTurnstileOnload'
const LOAD_TIMEOUT_MS = 6000

export type TurnstileStatus = 'loading' | 'ready' | 'passed' | 'failed' | 'unavailable'

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string
      action: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    },
  ) => string | undefined
  reset: (id?: string) => void
  remove: (id?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
    __iiTurnstileOnload?: () => void
  }
}

let scriptPromise: Promise<TurnstileApi | null> | null = null

/** 加载 Turnstile 脚本（全局只加载一次）。6 秒超时即放弃，不阻塞注册。 */
function loadScript(): Promise<TurnstileApi | null> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<TurnstileApi | null>((resolve) => {
    let settled = false
    const done = (v: TurnstileApi | null) => {
      if (settled) return
      settled = true
      resolve(v)
    }
    const timer = window.setTimeout(() => done(null), LOAD_TIMEOUT_MS)

    window.__iiTurnstileOnload = () => {
      window.clearTimeout(timer)
      done(window.turnstile ?? null)
    }
    const el = document.createElement('script')
    el.src = SCRIPT_SRC
    el.async = true
    el.defer = true
    el.onerror = () => {
      window.clearTimeout(timer)
      done(null)
    }
    document.head.appendChild(el)
  })

  return scriptPromise
}

export function useTurnstile(onToken: (token: string) => void) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | undefined>(undefined)
  const [status, setStatus] = useState<TurnstileStatus>('loading')

  useEffect(() => {
    let alive = true
    loadScript().then((api) => {
      if (!alive) return
      if (!api || !hostRef.current) {
        // 拿不到 Turnstile：交给服务端降级处理，前端不拦截
        setStatus('unavailable')
        return
      }
      widgetIdRef.current = api.render(hostRef.current, {
        sitekey: SITE.turnstileSiteKey,
        action: SITE.turnstileAction,
        callback: (token) => {
          onToken(token)
          setStatus('passed')
        },
        'expired-callback': () => {
          onToken('')
          setStatus('ready')
        },
        'error-callback': () => {
          onToken('')
          setStatus('failed')
        },
      })
      setStatus('ready')
    })

    return () => {
      alive = false
      const api = window.turnstile
      if (api && widgetIdRef.current) {
        try {
          api.remove(widgetIdRef.current)
        } catch {
          /* widget 可能已被浏览器回收，忽略 */
        }
      }
      widgetIdRef.current = undefined
    }
    // onToken 由父组件用 useCallback 固定，避免每次渲染重建 widget
  }, [onToken])

  /** 提交后重置，让用户可以再试一次（token 是一次性的，不能复用） */
  const reset = useCallback(() => {
    onToken('')
    try {
      window.turnstile?.reset(widgetIdRef.current)
    } catch {
      /* 忽略 */
    }
    setStatus('ready')
  }, [onToken])

  return { hostRef, status, reset }
}
