import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil } from 'lucide-react'
import { pb } from '../lib/pb'
import { pbErrorMessage } from '../lib/pbError'
import { Badge, Button, Card, Field, Input, Modal, Select, Spinner } from '../components/ui'
import { fmtDT } from '../lib/format'
import type { Building, Language, UserRecord } from '../types'

const BUILDINGS: Building[] = ['1', '2', '3', '4', '5', '6', '7', '8']

export default function UsersPage() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<UserRecord[] | null>(null)
  const [query, setQuery] = useState('')
  const [building, setBuilding] = useState('all')
  const [status, setStatus] = useState('all')
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<UserRecord | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await pb.collection('users').getFullList<UserRecord>({ sort: 'created' })
        if (active) setUsers(res)
      } catch (err) {
        if (active) setError(pbErrorMessage(err, t) || t('error'))
      }
    })()
    return () => {
      active = false
    }
  }, [t])

  const filtered = useMemo(() => {
    if (!users) return []
    const q = query.trim().toLowerCase()
    return users.filter((u) => {
      if (building !== 'all' && u.building !== building) return false
      if (status === 'approved' && !u.approved) return false
      if (status === 'pending' && u.approved) return false
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false
      return true
    })
  }, [users, query, building, status])

  async function approve(u: UserRecord) {
    setBusyId(u.id)
    try {
      await pb.collection('users').update(u.id, { approved: true })
      setUsers((prev) => prev && prev.map((x) => (x.id === u.id ? { ...x, approved: true } : x)))
    } catch (err) {
      setError(pbErrorMessage(err, t) || t('error'))
    } finally {
      setBusyId('')
    }
  }

  async function remove(u: UserRecord) {
    if (!window.confirm(t('adminRejectUserConfirm'))) return
    setBusyId(u.id)
    try {
      await pb.collection('users').delete(u.id)
      setUsers((prev) => prev && prev.filter((x) => x.id !== u.id))
    } catch {
      setError(t('error'))
    } finally {
      setBusyId('')
    }
  }

  if (error) return <p className="text-red-500">{error}</p>
  if (!users) return <Spinner />

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">{t('adminUsers')}</h1>

      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs flex-1"
          placeholder={t('adminUsersSearch')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select className="w-28" value={building} onChange={(e) => setBuilding(e.target.value)}>
          <option value="all">{t('adminUsersAll')}</option>
          {BUILDINGS.map((b) => (
            <option key={b} value={b}>
              {t('building')} {b}
            </option>
          ))}
        </Select>
        <Select className="w-32" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">{t('adminUsersAll')}</option>
          <option value="approved">{t('adminUsersApproved')}</option>
          <option value="pending">{t('adminPending')}</option>
        </Select>
      </div>

      {filtered.length === 0 && <Card><p className="py-6 text-center text-gray-400">{t('noData')}</p></Card>}

      <div className="space-y-2">
        {filtered.map((u) => (
          <Card key={u.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{u.name}</p>
                  {u.approved ? (
                    <Badge color="green">{t('adminUsersApproved')}</Badge>
                  ) : (
                    <Badge color="amber">{t('adminPending')}</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{u.email}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('building')} {u.building}
                  {u.apartment ? ` · ${u.apartment}` : ''}
                  {u.phone ? ` · ${u.phone}` : ''}
                  {' · '}
                  {fmtDT(u.created)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {u.approved ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(u)}
                    title={t('adminEdit')}
                  >
                    <Pencil className="size-4" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    loading={busyId === u.id}
                    onClick={() => void approve(u)}
                  >
                    {t('adminApprove')}
                  </Button>
                )}
                <Button size="sm" variant="danger" loading={busyId === u.id} onClick={() => void remove(u)}>
                  {t('adminDelete')}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <UserEditModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

const LANGUAGES: Language[] = ['en', 'ro']

interface EditForm {
  id: string
  name: string
  email: string
  building: string
  apartment: string
  phone: string
  language: Language
  password: string
  passwordConfirm: string
  approved: boolean
}

function UserEditModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserRecord
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<EditForm>({
    id: user.id,
    name: user.name,
    email: user.email,
    building: user.building,
    apartment: user.apartment ?? '',
    phone: user.phone ?? '',
    language: (user.language ?? 'en') as Language,
    password: '',
    passwordConfirm: '',
    approved: user.approved,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const data: Record<string, any> = {
      name: form.name.trim(),
      email: form.email.trim(),
      building: form.building,
      apartment: form.apartment.trim() || undefined,
      phone: form.phone.trim() || undefined,
      language: form.language,
      approved: form.approved,
    }
    if (form.password) {
      if (form.password.length < 6) {
        setError(t('profilePasswordTooShort'))
        setSaving(false)
        return
      }
      if (form.password !== form.passwordConfirm) {
        setError(t('profilePasswordMismatch'))
        setSaving(false)
        return
      }
      data.password = form.password
      data.passwordConfirm = form.passwordConfirm
    }
    try {
      await pb.collection('users').update(form.id, data)
      onSaved()
    } catch (err) {
      setError(pbErrorMessage(err, t) || t('error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title={t('editUserTitle')} onClose={onClose} wide>
      <form onSubmit={(e) => void save(e)} className="space-y-4">
        <Field label={t('registerName')} error={error}>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label={t('registerEmail')}>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('registerBuilding')}>
            <Select value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })}>
              {BUILDINGS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('registerApartment')}>
            <Input value={form.apartment} onChange={(e) => setForm({ ...form, apartment: e.target.value })} />
          </Field>
        </div>
        <Field label={t('registerPhone')}>
          <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label={t('editUserLanguage')}>
          <Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as Language })}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>{l === 'ro' ? 'Română' : 'English'}</option>
            ))}
          </Select>
        </Field>
        <Field label={t('editUserResetPassword')}>
          <Input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={t('editUserPassword')}
          />
        </Field>
        {form.password && (
          <Field label={t('registerConfirm')}>
            <Input
              type="password"
              value={form.passwordConfirm}
              onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })}
              required
            />
          </Field>
        )}
        <Field label={t('editUserApproved')}>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.approved}
              onChange={(e) => setForm({ ...form, approved: e.target.checked })}
              className="size-4 accent-teal-600"
              disabled={user.approved}
            />
            <span className="text-sm text-gray-600 dark:text-gray-300">{form.approved ? t('adminUsersApproved') : t('adminPending')}</span>
          </label>
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" loading={saving}>
            {t('save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
