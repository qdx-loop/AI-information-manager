import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorCircleRegular } from '@fluentui/react-icons'
import { tNow } from '@/i18n'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * 全局错误边界 v9：Windows 11 设置式错误页（居中图标 + 标题 + 说明 + 两条出路）。
 * reset 只清状态；reload 才是真正能恢复的那条。
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="w-page" style={{ maxWidth: 720 }}>
          <div
            className="w-card"
            style={{ marginTop: 48, padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <span
              className="w-home-empty-icon"
              aria-hidden
              style={{ background: 'var(--w-danger-soft)', color: 'var(--w-danger)' }}
            >
              <ErrorCircleRegular fontSize={24} />
            </span>
            <h1 className="w-title w-title--sm">{tNow('errorBoundary.title')}</h1>
            <p className="w-desc" style={{ wordBreak: 'break-word' }}>
              {this.state.error?.message}
            </p>
            <div className="w-actions" style={{ marginTop: 8 }}>
              <button type="button" className="w-btn w-btn--accent" onClick={this.handleReset}>
                {tNow('errorBoundary.retry')}
              </button>
              <button type="button" className="w-btn" onClick={() => window.location.reload()}>
                {tNow('errorBoundary.reload')}
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
