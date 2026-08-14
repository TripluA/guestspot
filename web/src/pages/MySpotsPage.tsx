import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarPlus, Plus } from 'lucide-react'
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
  Spinner,
} from '../components/ui'
import { fmtRange, isPast, localNowOffset, toPbDate, cmpSpotNumber } from '../lib/format'
import type { AvailabilityRecord, SpotRecord } from '../types'

export default function MySpotsPage() {
  const { t } = useTranslation()
  const { user } = useSession()

  const [loading, setLoading] = useState(true)
  const [spots, setSpots] = useState<SpotRecord[]>([])
  const [availability, setAvailability] = useState<AvailabilityRecord[]>([])
  const [addingFor, setAddingFor] = useState<SpotRecord | null>(null)

  const refresh = useCallback(async () => {
    if (!user) return
    const [spotsRes, availRes] = await Promise.all([
      pb.collection('spots').getFullList<SpotRecord>({
        filter: `owner = "${user.id}"`,
      }),
      pb.collection('availability').getFullList<AvailabilityRecord>({
        sort: 'from',
        expand: 'spot',
        filter: `owner = "${user.id}"`,
      }),
    ])
    setSpots(spotsRes.sort((a, b) => cmpSpotNumber(a.number, b.number)))
    setAvailability(availRes)
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
    return () => {
      active = false
    }
  }, [refresh])

  if (loading || !user) return <Spinner />

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('spotsTitle')}</h1>

      {spots.length === 0 && <EmptyState title={t('spotsNoSpots')} />}

      {spots.map((spot) => {
        const entries = availability.filter((a) => a.spot === spot.id)
        const upcoming = entries.filter((a) => a.status === 'available' && !isPast(a.to))
        const past = entries.filter((a) => isPast(a.to) || a.status === 'cancelled')
        return (
          <Card key={spot.id}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">{spot.number}</h3>
                  <Badge color="teal">
                    {t('building')} {spot.building}
                  </Badge>
                  {spot.zone && <Badge>{spot.zone}</Badge>}
                </div>
                {spot.notes && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{spot.notes}</p>
                )}
              </div>
              <Button size="sm" onClick={() => setAddingFor(spot)}>
                <Plus className="size-4" />
                {t('spotsSetAvailability')}
              </Button>
            </div>

            <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
              <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t('spotsAvailability')}
              </p>
              {upcoming.length === 0 && past.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500">{t('spotsNoAvailability')}</p>
              )}
              <div className="space-y-2">
                {upcoming.map((a) => (
                  <AvailabilityRow key={a.id} a={a} t={t} onChanged={() => void refresh()} />
                ))}
                {past.slice(0, 3).map((a) => (
                  <AvailabilityRow key={a.id} a={a} t={t} onChanged={() => void refresh()} />
                ))}
              </div>
            </div>
          </Card>
        )
      })}

      <AddAvailabilityModal
        spot={addingFor}
        onClose={() => setAddingFor(null)}
        onDone={() => void refresh()}
      />
    </div>
  )
}

function AvailabilityRow({
  a,
  t,
  onChanged,
}: {
  a: AvailabilityRecord
  t: (k: string) => string
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const cancelled = a.status === 'cancelled'
  const past = isPast(a.to)

  async function cancel() {
    if (!window.confirm(t('spotsAvailabilityCancelConfirm'))) return
    setBusy(true)
    try {
      await pb.collection('availability').update(a.id, { status: 'cancelled' })
      onChanged()
    } catch {
      window.alert(t('error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
      <div>
        <p className="text-sm font-medium">{fmtRange(a.from, a.to)}</p>
        {a.reason && <p className="text-xs text-gray-500 dark:text-gray-400">{a.reason}</p>}
      </div>
      <div className="flex items-center gap-2">
        {cancelled ? (
          <Badge color="red">{t('spotsStatusCancelled')}</Badge>
        ) : (
          <Badge color="green">{t('spotsStatusAvailable')}</Badge>
        )}
        {!cancelled && !past && (
          <Button size="sm" variant="secondary" loading={busy} onClick={() => void cancel()}>
            {t('spotsCancelAvailability')}
          </Button>
        )}
      </div>
    </div>
  )
}

function AddAvailabilityModal({
  spot,
  onClose,
  onDone,
}: {
  spot: SpotRecord | null
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [from, setFrom] = useState(localNowOffset(1))
  const [to, setTo] = useState(localNowOffset(24 * 3))
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setFrom(localNowOffset(1))
    setTo(localNowOffset(24 * 3))
    setReason('')
    setError('')
  }, [spot])

  if (!spot) return null

  async function submit() {
    if (!spot) return
    setError('')
    if (!from || !to || to <= from) {
      setError(t('validationRequired'))
      return
    }
    setSubmitting(true)
    try {
      await pb.collection('availability').create({
        spot: spot.id,
        from: toPbDate(from),
        to: toPbDate(to),
        reason: reason.trim() || undefined,
      })
      onDone()
      onClose()
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open title={`${t('spotsSetAvailability')} — ${spot.number}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('spotsAvailability')}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('reqFrom')}>
            <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={t('reqTo')}>
            <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <Field label={t('spotsReason')}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Holiday…" />
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
            <CalendarPlus className="size-4" />
            {t('save')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
