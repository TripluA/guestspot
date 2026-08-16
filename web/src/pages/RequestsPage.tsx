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
import { fmtRange, fmtDT, localNowOffset, toPbDate, cmpSpotNumber, fromPbDate } from '../lib/format'
import { pbErrorMessage } from '../lib/pbError'
import { confirmDialog, useToast } from '../components/feedback'
import type { GuestRequestRecord, SpotRecord } from '../types'

const statusKey = (s: string) => 'reqStatus' + s.charAt(0).toUpperCase() + s.slice(1)
const BUILDINGS = ['1', '2', '3', '4', '5', '6', '7', '8']

export default function RequestsPage() {
  const { t } = useTranslation()
  const { user } = useSession()

  const [tab, setTab] = useState<'board' | 'mine'>('board')
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<GuestRequestRecord[]>([])
  const [mine, setMine] = useState<GuestRequestRecord[]>([])
  const [mySpots, setMySpots] = useState<SpotRecord[]>([])
  const [confirmedAll, setConfirmedAll] = useState<GuestRequestRecord[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [forMe, setForMe] = useState(false)
  const [buildingFilter, setBuildingFilter] = useState('all')

  const [showNew, setShowNew] = useState(false)
  const [offering, setOffering] = useState<GuestRequestRecord | null>(null)
  const [editing, setEditing] = useState<GuestRequestRecord | null>(null)
  const isRefreshing = useRef(false)

  const PAGE_SIZE = 10

  const refresh = useCallback(async () => {
    if (!user || isRefreshing.current) return
    isRefreshing.current = true
    try {
      const [boardRes, mineRes, spotsRes, confirmedRes] = await Promise.all([
        pb.collection('requests').getList<GuestRequestRecord>(1, PAGE_SIZE, {
          sort: '-createdAt',
          expand: 'requester,spot,confirmer',
          filter: "status = 'pending' || status = 'confirmed'",
        }),
        pb.collection('requests').getFullList<GuestRequestRecord>({
          sort: '-createdAt',
          expand: 'requester,spot,confirmer',
          filter: `requester = "${user.id}"`,
        }),
        pb.collection('spots').getFullList<SpotRecord>({
          filter: `owner = "${user.id}"`,
        }),
        pb.collection('requests').getFullList<GuestRequestRecord>({
          filter: "status = 'confirmed'",
        }),
      ])

      setRequests(boardRes.items)
      setPage(boardRes.page)
      setHasMore(boardRes.page * boardRes.perPage < boardRes.totalItems)
      setMine(mineRes)
      setMySpots(spotsRes.sort((a, b) => cmpSpotNumber(a.number, b.number)))
      setConfirmedAll(confirmedRes)
    } catch (err) {
      if ((err as any)?.status !== 0) {
        throw err
      }
    } finally {
      isRefreshing.current = false
    }
  }, [user])

  const loadMore = useCallback(async () => {
    const next = page + 1
    try {
      const res = await pb.collection('requests').getList<GuestRequestRecord>(next, PAGE_SIZE, {
        sort: '-createdAt',
        expand: 'requester,spot,confirmer',
        filter: "status = 'pending' || status = 'confirmed'",
      })
      setRequests((prev) => [...prev, ...res.items])
      setPage(res.page)
      setHasMore(res.page * res.perPage < res.totalItems)
    } catch (err) {
      if ((err as any)?.status !== 0) throw err
    }
  }, [page])

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
        const conflicted = confirmedAll.some(
          (x) =>
            x.spot === s.id &&
            x.from < r.to &&
            x.to > r.from,
        )
        return !conflicted
      })
    },
    [mySpots, confirmedAll, user],
  )

  const offerable = offering ? offerableFor(offering) : []
  const shownBoard = requests.filter((r) => {
    if (forMe && offerableFor(r).length === 0) return false
    if (buildingFilter !== 'all' && r.expand?.requester?.building !== buildingFilter) return false
    return true
  })

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={forMe}
                onChange={(e) => setForMe(e.target.checked)}
                className="size-4 accent-teal-600"
              />
              {t('reqForMe')}
            </label>
            <div className="flex items-center gap-2">
              <Select className="w-28" value={buildingFilter} onChange={(e) => setBuildingFilter(e.target.value)}>
                <option value="all">{t('reqBuildingAll')}</option>
                {BUILDINGS.map((b) => (
                  <option key={b} value={b}>
                    {t('building')} {b}
                  </option>
                ))}
              </Select>
              <span className="text-sm text-gray-400 dark:text-gray-500">
                {shownBoard.length}
                {forMe ? ` / ${requests.length}` : ''}
              </span>
            </div>
          </div>
          {shownBoard.length === 0 && <EmptyState title={forMe ? t('reqEmptyForMe') : t('reqEmptyBoard')} />}
          {shownBoard.map((r) => {
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
          {hasMore && (
            <Button variant="secondary" className="w-full" onClick={() => void loadMore()}>
              {t('reqLoadMore')}
            </Button>
          )}
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
              onEdit={() => setEditing(r)}
              onChanged={() => void refresh()}
            />
          ))}
        </div>
      )}

      <NewRequestModal open={showNew} onClose={() => setShowNew(false)} onDone={() => void refresh()} />

      <EditRequestModal
        request={editing}
        onClose={() => setEditing(null)}
        onDone={() => {
          setEditing(null)
          void refresh()
        }}
      />

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
  onEdit,
  onChanged,
}: {
  r: GuestRequestRecord
  t: (k: string) => string
  mine?: boolean
  canOffer?: boolean
  onOffer?: () => void
  onEdit?: () => void
  onChanged?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [contact, setContact] = useState<{
    host: string
    hostPhone: string
    spot: string
    building: string
  } | null>(null)
  const [contactLoading, setContactLoading] = useState(false)
  const toast = useToast()

  async function openContact() {
    setContactLoading(true)
    try {
      const res = await pb.send<{
        host: string
        hostPhone: string
        spot: string
        building: string
      }>(`/api/guestspot/requests/${r.id}/contact`, { method: 'GET' })
      setContact(res)
    } catch (err) {
      toast.error(pbErrorMessage(err, t) || t('reqContactError'))
    } finally {
      setContactLoading(false)
    }
  }

  async function run(action: 'cancel' | 'complete') {
    const msg = action === 'cancel' ? t('reqCancel') : t('reqComplete')
    const ok = await confirmDialog({
      title: msg,
      message: `${msg}?`,
      confirmLabel: msg,
      danger: action === 'cancel',
    })
    if (!ok) return
    setBusy(true)
    try {
      await pb.send(`/api/guestspot/requests/${r.id}/${action}`, { method: 'POST' })
      onChanged?.()
      toast.success(msg)
    } catch (err) {
      toast.error(pbErrorMessage(err, t) || t('reqUpdateError'))
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
          {mine && r.status === 'pending' && onEdit && (
            <Button size="sm" variant="secondary" onClick={onEdit}>
              {t('reqEdit')}
            </Button>
          )}
          {mine && r.status === 'confirmed' && (
            <Button size="sm" variant="secondary" loading={contactLoading} onClick={() => void openContact()}>
              {t('reqContactHost')}
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

      {contact && (
        <Modal open={!!contact} title={t('reqContactTitle')} onClose={() => setContact(null)}>
          <h2 className="text-lg font-semibold">{t('reqContactTitle')}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500 dark:text-gray-400">{t('reqContactHostName')}</dt>
              <dd className="font-medium">{contact.host || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500 dark:text-gray-400">{t('reqContactHostPhone')}</dt>
              <dd className="font-medium">
                {contact.hostPhone ? (
                  <a className="text-teal-700 hover:underline dark:text-teal-300" href={`tel:${contact.hostPhone}`}>
                    {contact.hostPhone}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500 dark:text-gray-400">{t('reqSpot')}</dt>
              <dd className="font-medium">
                {contact.spot} {t('building')} {contact.building}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={() => setContact(null)}>
              {t('close')}
            </Button>
          </div>
        </Modal>
      )}
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
    setError('')
    if (!from || !to || to <= from) {
      setError(t('validationRequired'))
      return
    }
    setSubmitting(true)
    try {
      await pb.collection('requests').create({
        from: toPbDate(from),
        to: toPbDate(to),
        guests: Number(guests) || undefined,
        note: note.trim() || undefined,
      })
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

function EditRequestModal({
  request,
  onClose,
  onDone,
}: {
  request: GuestRequestRecord | null
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [guests, setGuests] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!request) return
    const toInput = (v: string | null | undefined) => {
      const d = fromPbDate(v)
      if (!d) return ''
      const p = (n: number) => ('0' + n).slice(-2)
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
    }
    setFrom(toInput(request.from))
    setTo(toInput(request.to))
    setGuests(request.guests ? String(request.guests) : '')
    setNote(request.note ?? '')
    setError('')
  }, [request])

  if (!request) return null
  const req = request

  async function submit() {
    setError('')
    if (!from || !to || to <= from) {
      setError(t('validationRequired'))
      return
    }
    setSubmitting(true)
    try {
      await pb.collection('requests').update(req.id, {
        from: toPbDate(from),
        to: toPbDate(to),
        guests: Number(guests) || undefined,
        note: note.trim() || undefined,
      })
      onDone()
      onClose()
    } catch (err) {
      setError(pbErrorMessage(err, t) || t('error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open title={t('reqEdit')} onClose={onClose}>
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
            <option value="">—</option>
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
            {t('save')}
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
        method: 'POST',
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
