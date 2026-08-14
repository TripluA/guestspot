import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LogOut } from 'lucide-react'
import { pb } from '../lib/pb'
import { signOut, useSession } from '../auth'
import { Button, Card, Field, Input, Select } from '../components/ui'
import { getTheme, setTheme, type Theme } from '../lib/theme'
import { setLang } from '../i18n'
import type { Language } from '../types'

const BUILDINGS = ['1', '2', '3', '4', '5', '6', '7', '8']

export default function ProfilePage() {
  const { t } = useTranslation()
  const { user } = useSession()

  const [form, setForm] = useState(() => ({
    name: user?.name ?? '',
    apartment: user?.apartment ?? '',
    phone: user?.phone ?? '',
    language: (user?.language ?? 'en') as Language,
  }))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [theme, setThemeState] = useState<Theme>(getTheme())
  const [pwSent, setPwSent] = useState(false)

  if (!user) return null
  const u = user

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      await pb.collection('users').update(u.id, {
        name: form.name.trim(),
        apartment: form.apartment.trim() || undefined,
        phone: form.phone.trim() || undefined,
        language: form.language,
      })
      setLang(form.language)
      setSaved(true)
    } catch {
      window.alert(t('error'))
    } finally {
      setSaving(false)
    }
  }

  async function resetPassword() {
    try {
      await pb.collection('users').requestPasswordReset(u.email)
      setPwSent(true)
    } catch {
      window.alert(t('error'))
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">{t('profileTitle')}</h1>

      <Card>
        <form onSubmit={(e) => void save(e)} className="space-y-4">
          <Field label={t('profileName')}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label={t('profileEmail')}>
            <Input value={user.email} disabled />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('profileBuilding')}>
              <Select
                value={user.building}
                onChange={() => undefined}
                disabled
              >
                {BUILDINGS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('profileApartment')}>
              <Input
                value={form.apartment}
                onChange={(e) => setForm({ ...form, apartment: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t('profilePhone')}>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label={t('profileLanguage')}>
            <Select
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value as Language })}
            >
              <option value="en">English</option>
              <option value="ro">Română</option>
            </Select>
          </Field>
          {saved && <p className="text-sm text-emerald-600 dark:text-emerald-400">{t('profileSaved')}</p>}
          <Button type="submit" loading={saving} className="w-full">
            {t('profileSave')}
          </Button>
        </form>
      </Card>

      <Card>
        <Field label={t('profileTheme')}>
          <Select
            value={theme}
            onChange={(e) => {
              const next = e.target.value as Theme
              setThemeState(next)
              setTheme(next)
            }}
          >
            <option value="light">{t('themeLight')}</option>
            <option value="dark">{t('themeDark')}</option>
            <option value="system">{t('themeSystem')}</option>
          </Select>
        </Field>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => void resetPassword()}>
            {t('profileChangePassword')}
          </Button>
          <Button type="button" variant="danger" className="flex-1" onClick={signOut}>
            <LogOut className="size-4" />
            {t('signOut')}
          </Button>
        </div>
        {pwSent && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{t('profilePasswordSent')}</p>}
      </Card>
    </div>
  )
}
