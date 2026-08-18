import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PocketBase, { BaseAuthStore } from 'pocketbase'
import { Car } from 'lucide-react'
import { pb } from '../lib/pb'
import { clearDualSession, setDualSession, type RoleSession } from '../lib/dualAuth'
import { switchRole, useSession } from '../auth'
import { Button, Field, Input } from '../components/ui'

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, isAdmin, loading } = useSession()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pendingDual, setPendingDual] = useState(false)

  if (!loading && !pendingDual && (user || isAdmin)) {
    return <Navigate to={isAdmin ? '/admin' : '/app'} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      // Probe roles on a throwaway in-memory client so the main auth store is
      // untouched until the final role is known. Otherwise the resident/admin
      // session updates (pb.authStore.onChange) can flush mid-handler and the
      // login redirect fires before the dual-role chooser can render.
      const probe = new PocketBase(import.meta.env.BASE_URL, new BaseAuthStore())
      probe.autoCancellation(false)

      let resident: RoleSession | null = null
      try {
        const rec = await probe.collection('users').authWithPassword(email.trim(), password)
        resident = {
          token: probe.authStore.token,
          model: (rec.record ?? probe.authStore.model) as never,
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        if (msg.includes('pending admin approval')) {
          setError(t('pendingApproval'))
          return
        }
      }

      if (resident) {
        let admin: RoleSession | null = null
        try {
          const rec = await probe.collection('_superusers').authWithPassword(email.trim(), password)
          admin = {
            token: probe.authStore.token,
            model: (rec.record ?? probe.authStore.model) as never,
          }
        } catch {
          // not an admin — single-role resident
        }

        if (admin) {
          setDualSession({
            email: email.trim().toLowerCase(),
            user: resident,
            admin: admin,
            active: 'user',
          })
          setPendingDual(true)
          return
        }

        pb.authStore.save(resident.token, (resident.model as never) ?? null)
        clearDualSession()
        navigate('/app', { replace: true })
        return
      }

      // No resident account: try signing in as a plain admin.
      try {
        await pb.collection('_superusers').authWithPassword(email.trim(), password)
        clearDualSession()
        navigate('/admin', { replace: true })
      } catch {
        setError(t('loginError'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function continueAsResident() {
    await switchRole('user')
    navigate('/app', { replace: true })
  }

  async function continueAsAdmin() {
    await switchRole('admin')
    navigate('/admin', { replace: true })
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white">
            <Car className="size-8" />
          </div>
          <h1 className="text-2xl font-bold">{t('loginTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('loginSubtitle')}</p>
        </div>

        {pendingDual ? (
          <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-600 dark:text-gray-300">{t('loginDualTitle')}</p>
            <Button
              type="button"
              className="w-full"
              size="lg"
              onClick={() => void continueAsResident()}
            >
              {t('loginAsResident')}
            </Button>
            <Button
              type="button"
              className="w-full"
              size="lg"
              variant="secondary"
              onClick={() => void continueAsAdmin()}
            >
              {t('loginAsAdmin')}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-gray-500 hover:underline dark:text-gray-400"
              onClick={() => {
                setPendingDual(false)
                clearDualSession()
              }}
            >
              {t('cancel')}
            </button>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <Field label={t('loginEmail')}>
              <Input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label={t('loginPassword')}>
              <Input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            <div className="text-right">
              <Link
                to="/reset-password"
                className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
              >
                {t('loginForgotPassword')}
              </Link>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" size="lg" loading={submitting}>
              {t('loginButton')}
            </Button>
          </form>
        )}

        {!pendingDual && (
          <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('loginNoAccount')}{' '}
            <Link
              to="/register"
              className="font-medium text-teal-700 hover:underline dark:text-teal-300"
            >
              {t('loginRegister')}
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
