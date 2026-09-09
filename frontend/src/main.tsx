import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { I18nProvider } from 'react-aria-components'
import { Toast } from '@heroui/react'
import App from './App'
import { AuthProvider } from './store/auth'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nProvider locale="zh-CN">
        <BrowserRouter>
          <AuthProvider>
            <Toast.Provider />
            <App />
          </AuthProvider>
        </BrowserRouter>
      </I18nProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
