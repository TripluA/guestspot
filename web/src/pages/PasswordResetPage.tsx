import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { pb } from '../lib/pb'
import { pbErrorMessage } from '../lib/pbError'
import { Button, Field, Input } from '../components/ui'
import { useToast } from '../components/feedback'

export default function PasswordResetPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [sending, setSending] = useState(false)
  const [reset, setReset] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  const token = searchParams.get('token') ?? searchParams.get('passwordResetToken')

  async function handleRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSending(true)
    setError(null)

    const email = e.currentTarget.elements.namedItem('email') as HTMLInputElement
    try {
      await pb.collection('users').requestPasswordReset(email.value)
      setSending(false)
      setReset(true)
      toast.success(t('passwordResetEmailSent'))
    } catch (err) {
      setSending(false)
      setError(pbErrorMessage(err, t) || t('error'))
    }
  }

  async function handlePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSending(true)
    setError(null)

    if (!token) {
      setSending(false)
      setError(t('error'))
      return
    }

    const password = e.currentTarget.elements.namedItem('password') as HTMLInputElement
    const passwordConfirm = e.currentTarget.elements.namedItem('passwordConfirm') as HTMLInputElement

    if (password.value.length < 6) {
      setSending(false)
      setError(t('profilePasswordTooShort'))
      return
    }

    if (password.value !== passwordConfirm.value) {
      setSending(false)
      setError(t('profilePasswordMismatch'))
      return
    }

    try {
      await pb.collection('users').confirmPasswordReset(token, password.value, password.value)
      setSending(false)
      setSaved(true)
      toast.success(t('passwordResetSuccess'))
      navigate('/login', { replace: true })
    } catch (err) {
      setSending(false)
      setError(pbErrorMessage(err, t) || t('error'))
    }
  }

  if (reset) {
    return (
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold">{t('passwordResetTitle')}</h1>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            {t('passwordResetCheckEmail')}
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  if (saved) {
    return (
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold">{t('passwordResetSuccess')}</h1>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            {t('passwordResetSuccessMessage')}
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">
            {token ? t('passwordResetNewPassword') : t('passwordResetTitle')}
          </h1>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {!token ? (
            <form onSubmit={handleRequest} className="space-y-4">
              <Field label={t('loginEmail')}>
                <Input type="email" required name="email" autoComplete="email" />
              </Field>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={sending} className="w-full" size="lg">
                {sending ? t('sending') : t('passwordResetRequest')}
              </Button>
            </form>
          ) : (
            <form onSubmit={handlePassword} className="space-y-4">
              <Field label={t('profileNewPassword')}>
                <Input
                  type="password"
                  required
                  name="password"
                  autoComplete="new-password"
                />
              </Field>

              <Field label={t('profileConfirmPassword')}>
                <Input
                  type="password"
                  required
                  name="passwordConfirm"
                  autoComplete="new-password"
                />
              </Field>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={sending} className="w-full" size="lg">
                {sending ? t('saving') : t('passwordResetSetPassword')}
              </Button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <Link
            to="/login"
            className="font-medium text-teal-700 hover:underline dark:text-teal-300"
          >
            {t('backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  )
}
