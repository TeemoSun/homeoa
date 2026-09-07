import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Spinner } from '@heroui/react'
import type { ReactNode } from 'react'
import { useAuth } from './store/auth'
import MainLayout from './layouts/MainLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewRequest from './pages/NewRequest'
import RequestsList from './pages/RequestsList'
import RequestDetail from './pages/RequestDetail'
import Users from './pages/Users'
import RequestTypes from './pages/RequestTypes'
import Settings from './pages/Settings'
import MailLogs from './pages/MailLogs'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) {
    return (
      <div className="flex justify-center pt-40">
        <Spinner size="lg" />
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return children
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />
  }
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <MainLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="requests/new" element={<NewRequest />} />
        <Route path="requests" element={<RequestsList scope="mine" />} />
        <Route path="approvals" element={<RequestsList scope="pending" />} />
        <Route
          path="manage/requests"
          element={
            <RequireAdmin>
              <RequestsList scope="all" />
            </RequireAdmin>
          }
        />
        <Route path="requests/:id" element={<RequestDetail />} />
        <Route
          path="manage/users"
          element={
            <RequireAdmin>
              <Users />
            </RequireAdmin>
          }
        />
        <Route
          path="manage/types"
          element={
            <RequireAdmin>
              <RequestTypes />
            </RequireAdmin>
          }
        />
        <Route
          path="manage/mail-logs"
          element={
            <RequireAdmin>
              <MailLogs />
            </RequireAdmin>
          }
        />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
