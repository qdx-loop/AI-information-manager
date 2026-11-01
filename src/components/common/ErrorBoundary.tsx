import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from 'antd'
import { tNow } from '@/i18n'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

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
      // 不使用 antd Result 的默认插图：那是「后台模板」最典型的指纹之一。
      // 这里只用文字 + 左对齐的账页排版，并同时给「重试」和「重新加载」两条出路——
      // reset 只清状态，同一子树会再崩一次；reload 才是真正能恢复的那条。
      return (
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '64px 24px' }}>
          <div className="page-kicker">ERROR</div>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            {tNow('errorBoundary.title')}
          </h1>
          <p className="page-sub" style={{ marginTop: 8 }}>
            {this.state.error?.message}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <Button type="primary" onClick={this.handleReset}>
              {tNow('errorBoundary.retry')}
            </Button>
            <Button onClick={() => window.location.reload()}>{tNow('errorBoundary.reload')}</Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
