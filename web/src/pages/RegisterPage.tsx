import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Car, CheckCircle2 } from 'lucide-react'
import { pb } from '../lib/pb'
import { pbErrorMessage } from '../lib/pbError'
import { useSession } from '../auth'
import { Button, Field, Input, Select, Spinner } from '../components/ui'
import { setLang } from '../i18n'

const BUILDINGS = ['1', '2', '3', '4', '5', '6', '7', '8']

export default function RegisterPage() {
  const { t, i18n } = useTranslation()
  const { user, isAdmin, loading } = useSession()

  const [requireVerification, setRequireVerification] = useState<boolean | null>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
    building: BUILDINGS[0],
    apartment: '',
    phone: '',
    spotNumber: '',
    spotZone: '',
    language: i18n.language === 'ro' ? ('ro' as const) : ('en' as const),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState('')
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}api/guestspot/settings`)
        if (!active || !res.ok) return
        const data = await res.json()
        if (active) setRequireVerification(!!data.requireEmailVerification)
      } catch {
        // default to false on fetch error
        if (active) setRequireVerification(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  if (!loading && (user || isAdmin)) {
    return <Navigate to={isAdmin ? '/admin' : '/app'} replace />
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = t('validationRequired')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) e.email = t('validationEmail')
    if (form.password.length < 6) e.password = t('validationPasswordLength')
    if (form.password !== form.confirm) e.confirm = t('validationPasswordMismatch')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    setApiError('')
    if (!validate()) return
    setSubmitting(true)
    try {
      await pb.collection('users').create({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        passwordConfirm: form.confirm,
        building: form.building,
        apartment: form.apartment.trim() || undefined,
        phone: form.phone.trim() || undefined,
        spotNumber: form.spotNumber.trim() || undefined,
        spotZone: form.spotZone.trim() || undefined,
        language: form.language,
      })
      setLang(form.language)
      setDone(true)
    } catch (err) {
      setApiError(pbErrorMessage(err, t) || t('error'))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CheckCircle2 className="mx-auto mb-3 size-12 text-emerald-500" />
          <h1 className="text-xl font-bold">{t('registerSuccess')}</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {requireVerification ? t('registerVerifyEmail') : t('registerApprovalNote')}
          </p>
          <Link
            to="/login"
            className="mt-4 inline-block font-medium text-teal-700 hover:underline dark:text-teal-300"
          >
            {t('registerLogin')}
          </Link>
        </div>
      </div>
    )
  }

  if (requireVerification === null) {
    return (
      <div className="flex min-h-full items-center justify-center p-4">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-teal-600 text-white">
            <Car className="size-8" />
          </div>
          <h1 className="text-2xl font-bold">{t('registerTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('registerSubtitle')}</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <Field label={t('registerName')} error={errors.name}>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>

          <Field label={t('registerEmail')} error={errors.email}>
            <Input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
            />
          </Field>

          <Field label={t('registerPassword')} error={errors.password}>
            <Input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={6}
              autoComplete="new-password"
            />
          </Field>

          <Field label={t('registerConfirm')} error={errors.confirm}>
            <Input
              type="password"
              required
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              autoComplete="new-password"
            />
          </Field>

          <Field label={t('registerBuilding')}>
            <Select
              value={form.building}
              onChange={(e) => setForm({ ...form, building: e.target.value })}
            >
              {BUILDINGS.map((b) => (
                <option key={b} value={b}>
                  {t('building')} {b}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('registerApartment')}>
            <Input
              value={form.apartment}
              onChange={(e) => setForm({ ...form, apartment: e.target.value })}
            />
          </Field>

          <Field label={t('registerPhone')}>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              autoComplete="tel"
            />
          </Field>

          <Field label={t('registerSpotNumber')}>
            <Input
              value={form.spotNumber}
              onChange={(e) => setForm({ ...form, spotNumber: e.target.value })}
              placeholder={t('registerSpotOptional')}
            />
          </Field>

          {form.spotNumber && (
            <Field label={t('registerSpotZone')}>
              <Input
                value={form.spotZone}
                onChange={(e) => setForm({ ...form, spotZone: e.target.value })}
              />
            </Field>
          )}

          <Field label={t('registerLanguage')}>
            <Select
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value as 'en' | 'ro' })}
            >
              <option value="en">English</option>
              <option value="ro">Română</option>
            </Select>
          </Field>

          {apiError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {apiError}
            </p>
          )}

          <Button type="submit" className="w-full" size="lg" loading={submitting}>
            {t('registerButton')}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          {t('registerLogin')}{' '}
          <Link
            to="/login"
            className="font-medium text-teal-700 hover:underline dark:text-teal-300"
          >
            {t('loginButton')}
          </Link>
        </p>
      </div>
    </div>
  )
}
