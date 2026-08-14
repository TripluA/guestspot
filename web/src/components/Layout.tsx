import { Link, NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CalendarDays,
  Car,
  Globe,
  House,
  LogOut,
  Moon,
  Shield,
  Sun,
  User,
} from 'lucide-react'
import { signOut, useSession } from '../auth'
import { getTheme, setTheme } from '../lib/theme'
import { setLang } from '../i18n'
import { cn } from './ui'

function LangToggle() {
  const { i18n } = useTranslation()
  const current = i18n.language === 'ro' ? 'ro' : 'en'
  const toggle = () => setLang(current === 'ro' ? 'en' : 'ro')
  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
      title="Language"
    >
      <span className="flex items-center gap-1">
        <Globe className="size-4" />
        <span className="text-sm font-semibold uppercase">{current === 'ro' ? 'RO' : 'EN'}</span>
      </span>
    </button>
  )
}

function ThemeToggle() {
  const toggle = () => setTheme(getTheme() === 'dark' ? 'light' : 'dark')
  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
      title="Theme"
    >
      <Sun className="size-5 dark:hidden" />
      <Moon className="hidden size-5 dark:block" />
    </button>
  )
}

const navItems = [
  { to: '/app', label: 'navDashboard', icon: House, end: true },
  { to: '/app/requests', label: 'navRequests', icon: CalendarDays, end: false },
  { to: '/app/spots', label: 'navMySpots', icon: Car, end: false },
  { to: '/app/profile', label: 'navProfile', icon: User, end: false },
]

export default function Layout() {
  const { t } = useTranslation()
  const { user, isAdmin } = useSession()

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link to="/app" className="flex items-center gap-2 text-lg font-bold text-teal-700 dark:text-teal-300">
            <Car className="size-6" />
            GuestSpot
          </Link>
          <div className="flex items-center gap-1">
            <LangToggle />
            <ThemeToggle />
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              title={t('signOut')}
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-6 px-4">
        <aside className="hidden w-44 shrink-0 py-6 md:block">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
                    isActive
                      ? 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
                  )
                }
              >
                <item.icon className="size-4" />
                {t(item.label)}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
                    isActive
                      ? 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
                  )
                }
              >
                <Shield className="size-4" />
                {t('navAdmin')}
              </NavLink>
            )}
          </nav>
          {user && (
            <p className="mt-6 px-3 text-xs text-gray-400 dark:text-gray-500">
              {t('building')} {user.building} · {user.name}
            </p>
          )}
        </aside>

        <main className="min-w-0 flex-1 py-6 pb-24 md:pb-10">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur md:hidden dark:border-gray-800 dark:bg-gray-950/95">
        <div className="mx-auto flex max-w-md items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                  isActive ? 'text-teal-700 dark:text-teal-300' : 'text-gray-500 dark:text-gray-400',
                )
              }
            >
              <item.icon className="size-5" />
              {t(item.label)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
