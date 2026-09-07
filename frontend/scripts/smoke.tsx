// 冒烟测试：SSR 渲染各路由，捕获运行时结构错误（仅本地验证用）
import { renderToString } from 'react-dom/server'
import { StrictMode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nProvider } from 'react-aria-components'
import { Toast } from '@heroui/react'
import App from '../src/App'
import MainLayout from '../src/layouts/MainLayout'
import Dashboard from '../src/pages/Dashboard'
import NewRequest from '../src/pages/NewRequest'
import RequestsList from '../src/pages/RequestsList'
import RequestDetail from '../src/pages/RequestDetail'
import Users from '../src/pages/Users'
import RequestTypes from '../src/pages/RequestTypes'
import Settings from '../src/pages/Settings'
import MailLogs from '../src/pages/MailLogs'
import { AuthProvider } from '../src/store/auth'

const ROUTES = ['/', '/login', '/requests/new', '/requests', '/approvals', '/settings', '/manage/users', '/manage/types', '/manage/mail-logs', '/requests/1']

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <StrictMode>
      <I18nProvider locale="zh-CN">
        <AuthProvider>
          <Toast.Provider />
          {children}
        </AuthProvider>
      </I18nProvider>
    </StrictMode>
  )
}

// 第一轮：完整 App（未登录，验证重定向链路）
let failed = false
for (const route of ROUTES) {
  try {
    const html = renderToString(
      <Shell>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="*" element={<App />} />
          </Routes>
        </MemoryRouter>
      </Shell>,
    )
    console.log(`OK(app)   ${route}  (${html.length} chars)`)
  } catch (e) {
    failed = true
    console.error(`FAIL(app) ${route}:`, (e as Error).message)
  }
}

// 第二轮：绕过鉴权直渲染 MainLayout + 各页面（API 失败走 catch 分支，验证组件结构）
const INNER = (
  <Routes>
    <Route path="/" element={<MainLayout />}>
      <Route index element={<Dashboard />} />
      <Route path="requests/new" element={<NewRequest />} />
      <Route path="requests" element={<RequestsList scope="mine" />} />
      <Route path="approvals" element={<RequestsList scope="pending" />} />
      <Route path="manage/requests" element={<RequestsList scope="all" />} />
      <Route path="requests/:id" element={<RequestDetail />} />
      <Route path="manage/users" element={<Users />} />
      <Route path="manage/types" element={<RequestTypes />} />
      <Route path="manage/mail-logs" element={<MailLogs />} />
      <Route path="settings" element={<Settings />} />
    </Route>
  </Routes>
)
for (const route of ROUTES) {
  try {
    const html = renderToString(
      <Shell>
        <MemoryRouter initialEntries={[route]}>{INNER}</MemoryRouter>
      </Shell>,
    )
    if (html.length < 2000) {
      console.error(`SUSPICIOUS-SHORT ${route}: only ${html.length} chars`)
    } else {
      console.log(`OK(inner) ${route}  (${html.length} chars)`)
    }
  } catch (e) {
    failed = true
    console.error(`FAIL(inner) ${route}:`, (e as Error).message)
  }
}
process.exit(failed ? 1 : 0)
