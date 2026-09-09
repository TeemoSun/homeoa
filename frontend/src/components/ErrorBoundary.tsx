import { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@heroui/react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg border border-gray-100">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
              <svg
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">页面发生异常</h2>
            <p className="mt-2 text-sm text-gray-600">
              系统遇到未预期的错误，请刷新页面或重试。
            </p>
            {this.state.error?.message && (
              <div className="mt-4 max-h-24 overflow-auto rounded bg-gray-50 p-2 text-left font-mono text-xs text-red-600">
                {this.state.error.message}
              </div>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <Button size="md" variant="ghost" onPress={this.handleReset}>
                返回首页
              </Button>
              <Button size="md" variant="primary" onPress={this.handleReload}>
                重新加载
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
