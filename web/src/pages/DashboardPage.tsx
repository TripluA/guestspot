import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarPlus, Car, CalendarClock, ChevronRight } from 'lucide-react'
import { pb } from '../lib/pb'
import { useSession } from '../auth'
import { Badge, Card, EmptyState, Spinner, StatusBadge } from '../components/ui'
import { fmtRange, fmtDT, isPast } from '../lib/format'
import type { GuestRequestRecord, SpotRecord } from '../types'

export default function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useSession()

  const [loading, setLoading] = useState(true)
  const [mySpots, setMySpots] = useState<SpotRecord[]>([])
  const [myRequests, setMyRequests] = useState<GuestRequestRecord[]>([])
  const [board, setBoard] = useState<GuestRequestRecord[]>([])
  const [boardTotal, setBoardTotal] = useState(0)
  const isRefreshing = useRef(false)

  useEffect(() => {
    if (!user) return
    let active = true

    const load = async () => {
      if (isRefreshing.current) return
      isRefreshing.current = true
      try {
        const [spots, requests, boardRes] = await Promise.all([
          pb.collection('spots').getFullList<SpotRecord>({
            filter: `owner = "${user.id}"`,
          }),
          pb.collection('requests').getFullList<GuestRequestRecord>({
            sort: '-createdAt',
            expand: 'requester,spot,confirmer',
            filter: `requester = "${user.id}"`,
          }),
          pb.collection('requests').getList<GuestRequestRecord>(1, 4, {
            sort: '-createdAt',
            expand: 'requester,spot,confirmer',
            filter: "status = 'pending' || status = 'confirmed'",
          }),
        ])
        if (!active) return
        setMySpots(spots)
        setMyRequests(requests)
        setBoard(boardRes.items)
        setBoardTotal(boardRes.totalItems)
      } finally {
        isRefreshing.current = false
      }
    }

    void load().finally(() => {
      if (active) setLoading(false)
    })

    const unsubs = ['requests', 'availability', 'spots'].map((coll) =>
      pb.collection(coll).subscribe('*', () => void load()).catch(() => () => {}),
    )

    return () => {
      active = false
      void Promise.all(unsubs).then((fns) => fns.forEach((fn) => fn && fn()))
    }
  }, [user])

  if (loading || !user) return <Spinner />

  const activeRequests = myRequests.filter(
    (r) => (r.status === 'pending' || r.status === 'confirmed') && !isPast(r.to),
  )
  const pastRequests = myRequests
    .filter((r) => !activeRequests.includes(r))
    .slice(0, 3)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {t('dashGreeting')}, {user.name} 👋
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('building')} {user.building}
          {user.apartment ? ` · ${user.apartment}` : ''}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/app/spots" className="block">
          <Card className="flex items-center justify-between hover:border-teal-500">
            <div>
              <p className="text-3xl font-bold text-teal-700 dark:text-teal-300">{mySpots.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashMySpots')}</p>
            </div>
            <Car className="size-8 text-teal-600/60 dark:text-teal-400/60" />
          </Card>
        </Link>
        <Link to="/app/requests" className="block">
          <Card className="flex items-center justify-between hover:border-teal-500">
            <div>
              <p className="text-3xl font-bold text-teal-700 dark:text-teal-300">
                {activeRequests.length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashMyRequests')}</p>
            </div>
            <CalendarClock className="size-8 text-teal-600/60 dark:text-teal-400/60" />
          </Card>
        </Link>
        <Link to="/app/requests" className="block">
          <Card className="flex items-center justify-between hover:border-teal-500">
            <div>
              <p className="text-3xl font-bold text-teal-700 dark:text-teal-300">{boardTotal}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashOpenRequests')}</p>
            </div>
            <ChevronRight className="size-8 text-teal-600/60 dark:text-teal-400/60" />
          </Card>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/app/requests">
          <Card className="flex items-center gap-3 border-teal-600/30 bg-teal-50/50 hover:border-teal-600 dark:bg-teal-950/30">
            <span className="flex size-10 items-center justify-center rounded-xl bg-teal-600 text-white">
              <CalendarPlus className="size-5" />
            </span>
            <span className="font-medium">{t('dashNewRequest')}</span>
          </Card>
        </Link>
        <Link to="/app/spots">
          <Card className="flex items-center gap-3 border-teal-600/30 bg-teal-50/50 hover:border-teal-600 dark:bg-teal-950/30">
            <span className="flex size-10 items-center justify-center rounded-xl bg-teal-600 text-white">
              <CalendarClock className="size-5" />
            </span>
            <span className="font-medium">{t('dashSetAvailability')}</span>
          </Card>
        </Link>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('dashRecent')}
        </h2>
        <div className="space-y-2">
          {board.length === 0 && <EmptyState title={t('reqEmptyBoard')} />}
          {board.map((r) => (
            <Card key={r.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  <span className="truncate text-sm font-medium">
                    {r.expand?.requester?.name ?? '—'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {fmtRange(r.from, r.to)}
                </p>
              </div>
              <Badge color="teal">{r.expand?.spot?.number ?? t('reqStatusPending')}</Badge>
            </Card>
          ))}
        </div>
      </div>

      {pastRequests.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('dashPast')}
          </h2>
          <div className="space-y-2">
            {pastRequests.map((r) => (
              <Card key={r.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.status} />
                    <span className="truncate text-sm font-medium">
                      {r.expand?.spot?.number ?? fmtDT(r.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {fmtRange(r.from, r.to)}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
