import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { pb } from '../lib/pb'
import { pbErrorMessage } from '../lib/pbError'
import { downloadCSV } from '../lib/csv'
import { confirmDialog, useToast } from '../components/feedback'
import { Badge, Button, Card, Input, Select, Spinner, StatusBadge } from '../components/ui'
import { fmtDT, fmtRange } from '../lib/format'
import type { Building, GuestRequestRecord } from '../types'

const BUILDINGS: Building[] = ['1', '2', '3', '4', '5', '6', '7', '8']
const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'expired'] as const

const statusKey = (s: string) => 'reqStatus' + s.charAt(0).toUpperCase() + s.slice(1)

export default function RequestsPage() {
  const { t } = useTranslation()
  const [requests, setRequests] = useState<GuestRequestRecord[] | null>(null)
  const [query, setQuery] = useState('')
  const [building, setBuilding] = useState('all')
  const [status, setStatus] = useState('all')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState('')
  const toast = useToast()

  const reload = async () => {
    try {
      const res = await pb.collection('requests').getFullList<GuestRequestRecord>({
        sort: '-createdAt',
        expand: 'requester,spot,confirmer',
      })
      setRequests(res)
      setError(null)
    } catch (err) {
      setError(pbErrorMessage(err, t) || t('error'))
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const filtered = useMemo(() => {
    if (!requests) return []
    const q = query.trim().toLowerCase()
    return requests.filter((r) => {
      if (status !== 'all' && r.status !== status) return false
      if (building !== 'all' && r.expand?.requester?.building !== building) return false
      if (q) {
        const requester = r.expand?.requester
        const hay = [
          requester?.name ?? '',
          requester?.email ?? '',
          r.expand?.spot?.number ?? '',
          r.note ?? '',
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [requests, query, building, status])

  if (error) return <p className="text-red-500">{error}</p>
  if (!requests) return <Spinner />
  const allRequests = requests

  function exportCSV() {
    downloadCSV(`guestspot-requests-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Requester', 'Email', 'Building', 'From', 'To', 'Guests', 'Note', 'Status', 'Spot', 'Confirmer', 'Created'],
      ...allRequests.map((r) => [
        r.expand?.requester?.name ?? r.requester,
        r.expand?.requester?.email ?? '',
        r.expand?.requester?.building ?? '',
        r.from,
        r.to,
        r.guests ?? '',
        r.note ?? '',
        r.status,
        r.expand?.spot?.number ?? '',
        r.expand?.confirmer?.name ?? '',
        r.createdAt,
      ]),
    ])
  }

  async function cancelReq(r: GuestRequestRecord) {
    const ok = await confirmDialog({
      title: t('reqCancel'),
      message: `${t('reqCancel')}?`,
      confirmLabel: t('reqCancel'),
      danger: true,
    })
    if (!ok) return
    setBusyId(r.id)
    try {
      await pb.collection('requests').update(r.id, { status: 'cancelled', spot: '', confirmer: '' })
      toast.success(t('reqCancel'))
      await reload()
    } catch (err) {
      toast.error(pbErrorMessage(err, t) || t('error'))
    } finally {
      setBusyId('')
    }
  }

  async function completeReq(r: GuestRequestRecord) {
    const ok = await confirmDialog({
      title: t('reqComplete'),
      message: `${t('reqComplete')}?`,
      confirmLabel: t('reqComplete'),
    })
    if (!ok) return
    setBusyId(r.id)
    try {
      await pb.collection('requests').update(r.id, { status: 'completed' })
      toast.success(t('reqComplete'))
      await reload()
    } catch (err) {
      toast.error(pbErrorMessage(err, t) || t('error'))
    } finally {
      setBusyId('')
    }
  }

  async function deleteReq(r: GuestRequestRecord) {
    const ok = await confirmDialog({
      title: t('adminDelete'),
      message: t('adminDeleteRequestConfirm'),
      confirmLabel: t('adminDelete'),
      danger: true,
    })
    if (!ok) return
    setBusyId(r.id)
    try {
      await pb.collection('requests').delete(r.id)
      toast.success(t('adminDelete'))
      await reload()
    } catch (err) {
      toast.error(pbErrorMessage(err, t) || t('error'))
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('adminRequests')}</h1>
        <Button size="sm" variant="secondary" onClick={exportCSV}>
          <Download className="size-4" />
          {t('adminExport')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs flex-1"
          placeholder={t('adminSearchRequests')}
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
        <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">{t('adminUsersAll')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(statusKey(s))}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 && <Card><p className="py-6 text-center text-gray-400">{t('noData')}</p></Card>}

      <div className="space-y-2">
        {filtered.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={r.status} label={t(statusKey(r.status))} />
                  <span className="truncate text-sm font-medium">
                    {r.expand?.requester?.name ?? r.requester}
                  </span>
                  {r.expand?.requester?.building && (
                    <Badge color="teal">
                      {t('building')} {r.expand.requester.building}
                    </Badge>
                  )}
                  {r.expand?.spot?.number && <Badge>{r.expand.spot.number}</Badge>}
                </div>
                <p className="mt-1 text-sm font-medium">{fmtRange(r.from, r.to)}</p>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  {r.expand?.requester?.email && `${r.expand.requester.email} · `}
                  {r.guests ? `${r.guests} ${t('reqGuests').toLowerCase()} · ` : ''}
                  {t('reqCreated')} {fmtDT(r.createdAt)}
                  {r.expand?.confirmer?.name ? ` · ${t('owner')} ${r.expand.confirmer.name}` : ''}
                </p>
                {r.note && <p className="mt-1 text-sm italic text-gray-500 dark:text-gray-400">“{r.note}”</p>}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {r.status === 'pending' && (
                  <Button size="sm" variant="secondary" loading={busyId === r.id} onClick={() => void cancelReq(r)}>
                    {t('reqCancel')}
                  </Button>
                )}
                {r.status === 'confirmed' && (
                  <>
                    <Button size="sm" variant="secondary" loading={busyId === r.id} onClick={() => void completeReq(r)}>
                      {t('reqComplete')}
                    </Button>
                    <Button size="sm" variant="secondary" loading={busyId === r.id} onClick={() => void cancelReq(r)}>
                      {t('reqCancel')}
                    </Button>
                  </>
                )}
                <Button size="sm" variant="danger" loading={busyId === r.id} onClick={() => void deleteReq(r)}>
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
