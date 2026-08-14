import { type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { SessionProvider, useSession } from './auth'
import { Spinner } from './components/ui'
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
import SpotsPage from './admin/SpotsPage'

function RequireUser({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useSession()
  if (loading) return <Spinner />
  if (isAdmin) return <Navigate to="/admin" replace />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useSession()
  if (loading) return <Spinner />
  if (!isAdmin) return <Navigate to={user ? '/app' : '/login'} replace />
  return <>{children}</>
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
        <Route path="spots" element={<SpotsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <AppRoutes />
    </SessionProvider>
  )
}
