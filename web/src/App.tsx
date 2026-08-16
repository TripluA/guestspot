import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { SessionProvider, switchRole, useSession } from './auth'
import type { Role } from './lib/dualAuth'
import { Spinner } from './components/ui'
import { ToastProvider } from './components/feedback'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import RequestsPage from './pages/RequestsPage'
import MySpotsPage from './pages/MySpotsPage'
import ProfilePage from './pages/ProfilePage'
import AdminLayout from './admin/AdminLayout'
import OverviewPage from './admin/OverviewPage'
import ApprovalsPage from './admin/ApprovalsPage'
import UsersPage from './admin/UsersPage'
import AdminRequestsPage from './admin/RequestsPage'
import SpotsPage from './admin/SpotsPage'
import SettingsPage from './admin/SettingsPage'
import AuditPage from './admin/AuditPage'

// Swaps the active session to the role the guarded area expects. Needed for
// dual-role identities (same email as resident + admin): admin pages must run
// with the superuser token and user pages with the users token.
function EnsureRole({ role, children }: { role: Role; children: ReactNode }) {
  const { isAdmin, dual, loading } = useSession()
  const [switching, setSwitching] = useState(false)
  const targetActive = role === 'user' ? !isAdmin : isAdmin

  useEffect(() => {
    if (dual && !targetActive && !switching) {
      setSwitching(true)
      void switchRole(role).finally(() => setSwitching(false))
    }
  }, [dual, targetActive, switching, role])

  if (loading || (switching && !targetActive)) return <Spinner />
  return <>{children}</>
}

function RequireUser({ children }: { children: ReactNode }) {
  const { user, isAdmin, dual, loading } = useSession()
  if (loading) return <Spinner />
  if (isAdmin && !dual) return <Navigate to="/admin" replace />
  if (!user && !dual) return <Navigate to="/login" replace />
  return <EnsureRole role="user">{children}</EnsureRole>
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, dual, loading } = useSession()
  if (loading) return <Spinner />
  if (!isAdmin && !dual) return <Navigate to={user ? '/app' : '/login'} replace />
  return <EnsureRole role="admin">{children}</EnsureRole>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/app"
        element={
          <RequireUser>
            <Layout />
          </RequireUser>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="spots" element={<MySpotsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="requests" element={<AdminRequestsPage />} />
        <Route path="spots" element={<SpotsPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </ToastProvider>
  )
}
