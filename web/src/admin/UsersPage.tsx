import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { pb } from '../lib/pb'
import { Badge, Button, Card, Input, Select, Spinner } from '../components/ui'
import { fmtDT } from '../lib/format'
import type { UserRecord } from '../types'

const BUILDINGS = ['1', '2', '3', '4', '5', '6', '7', '8']

export default function UsersPage() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<UserRecord[] | null>(null)
  const [query, setQuery] = useState('')
  const [building, setBuilding] = useState('all')
  const [status, setStatus] = useState('all')
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      const res = await pb.collection('users').getFullList<UserRecord>({ sort: 'created' })
      if (active) setUsers(res)
    })()
    return () => {
      active = false
    }
  }, [])

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

  async function toggleApproved(u: UserRecord) {
    setBusyId(u.id)
    try {
      await pb.collection('users').update(u.id, { approved: !u.approved })
      setUsers((prev) => prev && prev.map((x) => (x.id === u.id ? { ...x, approved: !u.approved } : x)))
    } catch {
      window.alert(t('error'))
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
      window.alert(t('error'))
    } finally {
      setBusyId('')
    }
  }

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
                <Button
                  size="sm"
                  variant={u.approved ? 'secondary' : 'primary'}
                  loading={busyId === u.id}
                  onClick={() => void toggleApproved(u)}
                >
                  {u.approved ? t('adminPending') : t('adminApprove')}
                </Button>
                <Button size="sm" variant="danger" loading={busyId === u.id} onClick={() => void remove(u)}>
                  {t('adminDelete')}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
