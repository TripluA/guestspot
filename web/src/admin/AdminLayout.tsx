import { Link, NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Car, LogOut, Moon, Shield, Sun } from 'lucide-react'
import { signOut } from '../auth'
import { getTheme, setTheme } from '../lib/theme'
import { setLang } from '../i18n'
import { cn } from '../components/ui'

function LangToggle() {
  const { i18n } = useTranslation()
  const current = i18n.language === 'ro' ? 'ro' : 'en'
  return (
    <button
      type="button"
      onClick={() => setLang(current === 'ro' ? 'en' : 'ro')}
      className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      <span className="text-sm font-semibold uppercase">{current === 'ro' ? 'EN' : 'RO'}</span>
    </button>
  )
}

const tabs = [
  { to: '/admin', label: 'adminOverview', end: true },
  { to: '/admin/approvals', label: 'adminApprovals', end: false },
  { to: '/admin/users', label: 'adminUsers', end: false },
  { to: '/admin/spots', label: 'adminSpots', end: false },
]

export default function AdminLayout() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-teal-600 text-white">
              <Shield className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="font-bold">GuestSpot</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('navAdmin')}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <LangToggle />
            <button
              type="button"
              onClick={() => setTheme(getTheme() === 'dark' ? 'light' : 'dark')}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Sun className="size-5 dark:hidden" />
              <Moon className="hidden size-5 dark:block" />
            </button>
            <Link
              to="/app"
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              title={t('navDashboard')}
            >
              <Car className="size-5" />
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <nav className="mb-6 flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium',
                  isActive
                    ? 'bg-white text-teal-700 shadow-sm dark:bg-gray-700 dark:text-teal-300'
                    : 'text-gray-500 dark:text-gray-400',
                )
              }
            >
              {t(tab.label)}
            </NavLink>
          ))}
        </nav>
        <Outlet />
      </div>
    </div>
  )
}
