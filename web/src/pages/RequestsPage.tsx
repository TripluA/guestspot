import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { pb } from '../lib/pb'
import { useSession } from '../auth'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  StatusBadge,
  cn,
} from '../components/ui'
import { fmtRange, fmtDT, localNowOffset, toPbDate, cmpSpotNumber } from '../lib/format'
import { pbErrorMessage } from '../lib/pbError'
import type { GuestRequestRecord, SpotRecord } from '../types'

const statusKey = (s: string) => 'reqStatus' + s.charAt(0).toUpperCase() + s.slice(1)

export default function RequestsPage() {
  const { t } = useTranslation()
  const { user } = useSession()

  const [tab, setTab] = useState<'board' | 'mine'>('board')
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<GuestRequestRecord[]>([])
  const [mine, setMine] = useState<GuestRequestRecord[]>([])
  const [mySpots, setMySpots] = useState<SpotRecord[]>([])

  const [showNew, setShowNew] = useState(false)
  const [offering, setOffering] = useState<GuestRequestRecord | null>(null)
  const isRefreshing = useRef(false)

  const refresh = useCallback(async () => {
    if (!user || isRefreshing.current) return
    isRefreshing.current = true
    try {
      const boardRes = await pb.collection('requests').getFullList<GuestRequestRecord>({
        sort: '-createdAt',
        expand: 'requester,spot,confirmer',
        filter: "status != 'cancelled'",
      })
      const mineRes = await pb.collection('requests').getFullList<GuestRequestRecord>({
        sort: '-createdAt',
        expand: 'requester,spot,confirmer',
        filter: `requester = "${user.id}"`,
      })
      const spotsRes = await pb.collection('spots').getFullList<SpotRecord>({
        filter: `owner = "${user.id}"`,
      })
      
      setRequests(boardRes)
      setMine(mineRes)
      setMySpots(spotsRes.sort((a, b) => cmpSpotNumber(a.number, b.number)))
    } catch (err) {
      if ((err as any)?.status !== 0) {
        throw err
      }
    } finally {
      isRefreshing.current = false
    }
  }, [user])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        await refresh()
      } finally {
        if (active) setLoading(false)
      }
    })()
    const unsub = pb
      .collection('requests')
      .subscribe('*', () => {
        void refresh()
      })
      .catch(() => () => {})
    return () => {
      active = false
      void unsub.then((fn) => fn && fn())
    }
  }, [refresh])

  const offerableFor = useCallback(
    (r: GuestRequestRecord) => {
      if (!user) return []
      return mySpots.filter((s) => {
        if (!s.enabled) return false
        const conflicted = requests.some(
          (x) =>
            x.spot === s.id &&
            x.status === 'confirmed' &&
            x.from < r.to &&
            x.to > r.from,
        )
        return !conflicted
      })
    },
    [mySpots, requests, user],
  )

  const offerable = offering ? offerableFor(offering) : []

  if (loading || !user) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('reqTitle')}</h1>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="size-4" />
          {t('reqNew')}
        </Button>
      </div>

      <div className="grid w-full max-w-xs grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        <button
          type="button"
          onClick={() => setTab('board')}
          className={cn(
            'rounded-md py-1.5 text-sm font-medium',
            tab === 'board' ? 'bg-white shadow-sm dark:bg-gray-700' : 'text-gray-500 dark:text-gray-400',
          )}
        >
          {t('reqBoard')}
        </button>
        <button
          type="button"
          onClick={() => setTab('mine')}
          className={cn(
            'rounded-md py-1.5 text-sm font-medium',
            tab === 'mine' ? 'bg-white shadow-sm dark:bg-gray-700' : 'text-gray-500 dark:text-gray-400',
          )}
        >
          {t('reqMine')}
        </button>
      </div>

      {tab === 'board' ? (
        <div className="space-y-2">
          {requests.length === 0 && <EmptyState title={t('reqEmptyBoard')} />}
          {requests.map((r) => {
            const available = offerableFor(r)
            return (
              <RequestCard
                key={r.id}
                r={r}
                t={t}
                canOffer={r.status === 'pending' && available.length > 0}
                onOffer={() => setOffering(r)}
              />
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {mine.length === 0 && <EmptyState title={t('reqEmptyMine')} />}
          {mine.map((r) => (
            <RequestCard
              key={r.id}
              r={r}
              t={t}
              mine
              onChanged={() => void refresh()}
            />
          ))}
        </div>
      )}

      <NewRequestModal open={showNew} onClose={() => setShowNew(false)} onDone={() => void refresh()} />

      <OfferModal
        request={offering}
        spots={offerable}
        onClose={() => setOffering(null)}
        onDone={() => {
          setOffering(null)
          void refresh()
        }}
      />
    </div>
  )
}

function RequestCard({
  r,
  t,
  mine = false,
  canOffer = false,
  onOffer,
  onChanged,
}: {
  r: GuestRequestRecord
  t: (k: string) => string
  mine?: boolean
  canOffer?: boolean
  onOffer?: () => void
  onChanged?: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function run(action: 'cancel' | 'complete') {
    const msg = action === 'cancel' ? t('reqCancel') : t('reqComplete')
    if (!window.confirm(`${msg}?`)) return
    setBusy(true)
    try {
      await pb.send(`/api/guestspot/requests/${r.id}/${action}`, {})
      onChanged?.()
    } catch {
      window.alert(t('reqUpdateError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={r.status} label={t(statusKey(r.status))} />
            {!mine && (
              <span className="truncate text-sm font-medium">
                {r.expand?.requester?.name ?? '—'}
              </span>
            )}
            {r.expand?.spot?.number && (
              <Badge color="teal">
                {t('reqSpot')} {r.expand.spot.number}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm font-medium">{fmtRange(r.from, r.to)}</p>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {t('reqCreated')} {fmtDT(r.createdAt)}
            {r.guests ? ` · ${r.guests} ${t('reqGuests').toLowerCase()}` : ''}
          </p>
          {r.note && <p className="mt-1 text-sm italic text-gray-500 dark:text-gray-400">“{r.note}”</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canOffer && onOffer && (
            <Button size="sm" onClick={onOffer}>
              {t('reqOffer')}
            </Button>
          )}
          {mine && (r.status === 'pending' || r.status === 'confirmed') && (
            <Button size="sm" variant="secondary" loading={busy} onClick={() => void run('cancel')}>
              {t('reqCancel')}
            </Button>
          )}
          {mine && r.status === 'confirmed' && (
            <Button size="sm" variant="secondary" loading={busy} onClick={() => void run('complete')}>
              {t('reqComplete')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

function NewRequestModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [from, setFrom] = useState(localNowOffset(1))
  const [to, setTo] = useState(localNowOffset(5))
  const [guests, setGuests] = useState('1')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    console.log('[NewRequestModal] submit clicked')
    setError('')
    if (!from || !to || to <= from) {
      setError(t('validationRequired'))
      return
    }
    setSubmitting(true)
    try {
      console.log('[NewRequestModal] creating request', { from, to, guests, note })
      await pb.collection('requests').create({
        from: toPbDate(from),
        to: toPbDate(to),
        guests: Number(guests) || undefined,
        note: note.trim() || undefined,
      })
      console.log('[NewRequestModal] request created')
      onDone()
      onClose()
    } catch (err) {
      console.error('[NewRequestModal] error', err)
      setError(pbErrorMessage(err, t) || t('error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} title={t('reqNew')} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('reqFrom')}>
            <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={t('reqTo')}>
            <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <Field label={t('reqGuests')}>
          <Select value={guests} onChange={(e) => setGuests(e.target.value)}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('reqNote')}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Car plate, arrival time…" />
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
          <Button loading={submitting} onClick={() => void submit()}>
            {t('reqSubmit')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function OfferModal({
  request,
  spots,
  onClose,
  onDone,
}: {
  request: GuestRequestRecord | null
  spots: SpotRecord[]
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [spotId, setSpotId] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setSpotId(spots.length ? spots[0].id : '')
    setError('')
  }, [request, spots])

  if (!request) return null

  async function submit() {
    if (!request || !spotId) return
    setSubmitting(true)
    setError('')
    try {
      await pb.send(`/api/guestspot/requests/${request.id}/confirm`, {
        body: { spot: spotId },
      })
      onDone()
    } catch (err) {
      setError(pbErrorMessage(err, t) || t('reqOfferError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open title={t('reqOfferTitle')} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('reqOfferHint')} — {fmtRange(request.from, request.to)}
        </p>
        {spots.length === 0 ? (
          <EmptyState title={t('reqNoOfferable')} />
        ) : (
          <Field label={t('reqSpot')}>
            <Select value={spotId} onChange={(e) => setSpotId(e.target.value)}>
              {spots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.number} — {t('building')} {s.building}
                  {s.zone ? ` (${s.zone})` : ''}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button loading={submitting} disabled={spots.length === 0} onClick={() => void submit()}>
            {t('confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
