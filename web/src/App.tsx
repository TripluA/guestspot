import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { SessionProvider, switchRole, useSession } from './auth'
import type { Role } from './lib/dualAuth'
import { Spinner } from './components/ui'
import { ToastProvider } from './components/feedback'
import { ErrorBoundary } from './components/ErrorBoundary'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import RequestsPage from './pages/RequestsPage'
import MySpotsPage from './pages/MySpotsPage'
import ProfilePage from './pages/ProfilePage'
import PasswordResetPage from './pages/PasswordResetPage'
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
      <Route path="/reset-password" element={<PasswordResetPage />} />
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

function CrashFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-white p-6 dark:border-red-900 dark:bg-gray-900">
        <h1 className="text-xl font-bold text-red-700 dark:text-red-300">Something went wrong</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          An unexpected error occurred. You can reload the page or try resetting this view.
        </p>
        {import.meta.env.DEV && (
          <pre className="mt-3 whitespace-pre-wrap break-all rounded-md bg-gray-100 p-3 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
            {error.message}
          </pre>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={reset}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700"
          >
            Reset
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <SessionProvider>
        <ErrorBoundary
          fallbackRender={(error, reset) => <CrashFallback error={error} reset={reset} />}
        >
          <AppRoutes />
        </ErrorBoundary>
      </SessionProvider>
    </ToastProvider>
  )
}
