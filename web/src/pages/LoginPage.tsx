import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Car } from 'lucide-react'
import { pb } from '../lib/pb'
import { useSession } from '../auth'
import { Button, Field, Input } from '../components/ui'

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, isAdmin, loading } = useSession()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && (user || isAdmin)) {
    return <Navigate to={isAdmin ? '/admin' : '/app'} replace />
  }

   async function onSubmit(e: FormEvent) {
     e.preventDefault()
     setError('')
     setSubmitting(true)
     try {
       try {
         await pb.collection('users').authWithPassword(email.trim(), password)
         navigate('/app', { replace: true })
         return
       } catch (err) {
         const msg = err instanceof Error ? err.message : ''
         if (msg.includes('pending admin approval')) {
           setError(t('pendingApproval'))
           return
         }
       }
       try {
         await pb.collection('_superusers').authWithPassword(email.trim(), password)
         navigate('/admin', { replace: true })
       } catch {
         setError(t('loginError'))
       }
     } finally {
       setSubmitting(false)
     }
   }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-teal-600 text-white">
            <Car className="size-8" />
          </div>
          <h1 className="text-2xl font-bold">{t('loginTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('loginSubtitle')}</p>
        </div>

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

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" size="lg" loading={submitting}>
            {t('loginButton')}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          {t('loginNoAccount')}{' '}
          <Link to="/register" className="font-medium text-teal-700 hover:underline dark:text-teal-300">
            {t('loginRegister')}
          </Link>
        </p>
      </div>
    </div>
  )
}
