import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { pb } from '../lib/pb'
import { Badge, Button, Card, Field, Input, Modal, Select, Spinner } from '../components/ui'
import type { SpotRecord, UserRecord } from '../types'

const BUILDINGS = ['1', '2', '3', '4', '5', '6', '7', '8']

interface SpotForm {
  id?: string
  number: string
  building: string
  zone: string
  enabled: boolean
  owner: string
  notes: string
}

const emptyForm: SpotForm = {
  number: '',
  building: '1',
  zone: '',
  enabled: true,
  owner: '',
  notes: '',
}

export default function SpotsPage() {
  const { t } = useTranslation()
  const [spots, setSpots] = useState<SpotRecord[] | null>(null)
  const [users, setUsers] = useState<UserRecord[]>([])
  const [query, setQuery] = useState('')
  const [building, setBuilding] = useState('all')
  const [editing, setEditing] = useState<SpotForm | null>(null)
  const [busyId, setBusyId] = useState('')

  const load = useMemo(
    () => async () => {
      const [spotsRes, usersRes] = await Promise.all([
        pb.collection('spots').getFullList<SpotRecord>({ sort: 'number' }),
        pb.collection('users').getFullList<UserRecord>({ filter: 'approved = true' }),
      ])
      setSpots(spotsRes)
      setUsers(usersRes)
    },
    [],
  )

  useEffect(() => {
    let active = true
    void load().then(() => {
      if (!active) return
    })
    return () => {
      active = false
    }
  }, [load])

  const filtered = useMemo(() => {
    if (!spots) return []
    const q = query.trim().toLowerCase()
    return spots.filter((s) => {
      if (building !== 'all' && s.building !== building) return false
      if (q && !s.number.toLowerCase().includes(q)) return false
      return true
    })
  }, [spots, query, building])

  async function save(form: SpotForm) {
    const data = {
      number: form.number.trim(),
      building: form.building,
      zone: form.zone.trim() || undefined,
      enabled: form.enabled,
      owner: form.owner || undefined,
      notes: form.notes.trim() || undefined,
    }
    if (form.id) {
      await pb.collection('spots').update(form.id, data)
    } else {
      await pb.collection('spots').create(data)
    }
    await load()
  }

  async function remove(spot: SpotRecord) {
    if (!window.confirm(t('adminDeleteSpotConfirm'))) return
    setBusyId(spot.id)
    try {
      await pb.collection('spots').delete(spot.id)
      await load()
    } catch {
      window.alert(t('error'))
    } finally {
      setBusyId('')
    }
  }

  if (!spots) return <Spinner />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('adminSpots')}</h1>
        <Button onClick={() => setEditing(emptyForm)}>
          <Plus className="size-4" />
          {t('adminAddSpot')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs flex-1"
          placeholder={t('adminSearchSpots')}
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
      </div>

      {filtered.length === 0 && <Card><p className="py-6 text-center text-gray-400">{t('noData')}</p></Card>}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((spot) => (
          <Card key={spot.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium">{spot.number}</p>
                <Badge color="teal">
                  {t('building')} {spot.building}
                </Badge>
                {!spot.enabled && <Badge color="red">{t('adminPending')}</Badge>}
              </div>
              <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
                {spot.owner
                  ? users.find((u) => u.id === spot.owner)?.name ?? spot.owner
                  : t('adminUnassigned')}
                {spot.zone ? ` · ${spot.zone}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setEditing({
                    id: spot.id,
                    number: spot.number,
                    building: spot.building,
                    zone: spot.zone ?? '',
                    enabled: spot.enabled,
                    owner: spot.owner ?? '',
                    notes: spot.notes ?? '',
                  })
                }
              >
                <Pencil className="size-4" />
              </Button>
              <Button size="sm" variant="ghost" loading={busyId === spot.id} onClick={() => void remove(spot)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <SpotModal
          form={editing}
          users={users}
          onClose={() => setEditing(null)}
          onSaved={async (f) => {
            await save(f)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function SpotModal({
  form,
  users,
  onClose,
  onSaved,
}: {
  form: SpotForm
  users: UserRecord[]
  onClose: () => void
  onSaved: (form: SpotForm) => Promise<void>
}) {
  const { t } = useTranslation()
  const [f, setF] = useState<SpotForm>(form)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setError('')
    if (!f.number.trim()) {
      setError(t('validationRequired'))
      return
    }
    setSaving(true)
    try {
      await onSaved(f)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title={f.id ? t('adminEditSpot') : t('adminAddSpot')} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('adminSpotNumber')}>
            <Input value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} placeholder="B1-01" />
          </Field>
          <Field label={t('building')}>
            <Select value={f.building} onChange={(e) => setF({ ...f, building: e.target.value })}>
              {BUILDINGS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={t('adminSpotZone')}>
          <Input value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })} placeholder="Stairwell A" />
        </Field>
        <Field label={t('adminSpotOwner')}>
          <Select value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}>
            <option value="">{t('adminUnassigned')}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {t('building')} {u.building}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('adminSpotEnabled')}>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={f.enabled}
              onChange={(e) => setF({ ...f, enabled: e.target.checked })}
              className="size-4 accent-teal-600"
            />
            <span className="text-sm text-gray-600 dark:text-gray-300">{t('adminSpotEnabled')}</span>
          </label>
        </Field>
        <Field label={t('reqNote')}>
          <Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button loading={saving} onClick={() => void submit()}>
            {t('adminSave')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
