import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { pb } from '../lib/pb'
import { pbErrorMessage } from '../lib/pbError'
import { clearDualSession } from '../lib/dualAuth'
import { useSession } from '../auth'
import { Button, Card, Field, Input } from '../components/ui'

// Machine-readable error codes returned by POST /api/guestspot/admin/settings
const SETTINGS_ERROR_KEYS: Record<string, string> = {
  current_password_required: 'settingsCurrentPasswordRequired',
  current_password_invalid: 'settingsWrongCurrentPassword',
  password_mismatch: 'settingsPasswordMismatch',
  password_short: 'settingsPasswordShort',
  email_in_use: 'settingsEmailInUse',
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const { isAdmin } = useSession()

  // Grab active superuser record if authenticated as admin
  const model = pb.authStore.model as any
  const [form, setForm] = useState(() => ({
    name: model?.name ?? '',
    email: model?.email ?? '',
    oldPassword: '',
    password: '',
    passwordConfirm: '',
  }))

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isAdmin) return null

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)

    const name = form.name.trim()
    const email = form.email.trim()
    const emailChanged = email !== model?.email
    const passwordChanged = Boolean(form.password)

    // Email and password changes require the current password (verified server-side)
    if ((emailChanged || passwordChanged) && !form.oldPassword) {
      setError(t('validationRequired') + ' (' + t('profileOldPassword') + ')')
      setSaving(false)
      return
    }

    try {
      await pb.send('/api/guestspot/admin/settings', {
        method: 'POST',
        body: {
          name,
          email,
          oldPassword: form.oldPassword || undefined,
          password: form.password || undefined,
          passwordConfirm: form.passwordConfirm || undefined,
        },
      })

      // An admin email change invalidates a cached dual (resident+admin) pairing
      if (emailChanged) clearDualSession()

      // Refresh the session so the new name/email render immediately
      try {
        await pb.collection('_superusers').authRefresh()
      } catch {
        // best effort — model stays stale until the next login
      }

      setSaved(true)
      setForm({ name, email, oldPassword: '', password: '', passwordConfirm: '' })
    } catch (err) {
      const code = (err as { data?: { data?: { code?: string } } })?.data?.data?.code
      const key = code ? SETTINGS_ERROR_KEYS[code] : undefined
      setError(key ? t(key) : pbErrorMessage(err, t) || t('error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">{t('adminSettings')}</h1>

      <Card>
        <form onSubmit={(e) => void save(e)} className="space-y-4">
          <Field label={t('registerName')}>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>

          <Field label={t('registerEmail')}>
            <Input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>

          <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
            <h2 className="mb-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
              {t('profileChangePassword')}
            </h2>
            <div className="space-y-4">
              <Field label={t('profileNewPassword')}>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </Field>
              <Field label={t('registerConfirm')}>
                <Input
                  type="password"
                  value={form.passwordConfirm}
                  onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })}
                />
              </Field>
            </div>
          </div>

          {(form.email.trim() !== model?.email || form.password) && (
            <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
              <Field label={t('profileOldPassword')}>
                <Input
                  type="password"
                  required
                  value={form.oldPassword}
                  onChange={(e) => setForm({ ...form, oldPassword: e.target.value })}
                />
              </Field>
            </div>
          )}

          {saved && <p className="text-sm text-emerald-600 dark:text-emerald-400">{t('profileSaved')}</p>}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <Button type="submit" loading={saving} className="w-full">
            {t('profileSave')}
          </Button>
        </form>
      </Card>
    </div>
  )
}
