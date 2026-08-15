import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { pb } from '../lib/pb'
import { pbErrorMessage } from '../lib/pbError'
import { useSession } from '../auth'
import { Button, Card, Field, Input } from '../components/ui'

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

    const data: Record<string, any> = {
      name: form.name.trim(),
    }

    if (form.email.trim() !== model?.email) {
      data.email = form.email.trim()
    }

    if (form.password) {
      data.password = form.password
      data.passwordConfirm = form.passwordConfirm
    }

    // Email and password changes on auth collections require oldPassword
    if (data.email || data.password) {
      if (!form.oldPassword) {
        setError(t('validationRequired') + ' (' + t('profileOldPassword') + ')')
        setSaving(false)
        return
      }
      data.oldPassword = form.oldPassword
    }

    try {
      await pb.collection('_superusers').update(model.id, data)
      setSaved(true)
      setForm((prev) => ({
        ...prev,
        oldPassword: '',
        password: '',
        passwordConfirm: '',
      }))
    } catch (err) {
      setError(pbErrorMessage(err, t) || t('error'))
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
