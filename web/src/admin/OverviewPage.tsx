import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { pb } from '../lib/pb'
import { Card, Spinner } from '../components/ui'
import type { GuestRequestRecord, SpotRecord, UserRecord } from '../types'

interface Counts {
  users: number
  approved: number
  pending: number
  spots: number
  assigned: number
  requests: number
  pendingRequests: number
  confirmedRequests: number
}

export default function OverviewPage() {
  const { t } = useTranslation()
  const [counts, setCounts] = useState<Counts | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const [users, spots, requests] = await Promise.all([
        pb.collection('users').getFullList<UserRecord>(),
        pb.collection('spots').getFullList<SpotRecord>(),
        pb.collection('requests').getFullList<GuestRequestRecord>(),
      ])
      if (!active) return
      setCounts({
        users: users.length,
        approved: users.filter((u) => u.approved).length,
        pending: users.filter((u) => !u.approved).length,
        spots: spots.length,
        assigned: spots.filter((s) => s.owner).length,
        requests: requests.length,
        pendingRequests: requests.filter((r) => r.status === 'pending').length,
        confirmedRequests: requests.filter((r) => r.status === 'confirmed').length,
      })
    })()
    return () => {
      active = false
    }
  }, [])

  if (!counts) return <Spinner />

  const stats: { label: string; value: number }[] = [
    { label: t('adminTotalUsers'), value: counts.users },
    { label: t('adminApprovedUsers'), value: counts.approved },
    { label: t('adminPendingUsers'), value: counts.pending },
    { label: t('adminTotalSpots'), value: counts.spots },
    { label: t('adminAssignedSpots'), value: counts.assigned },
    { label: t('adminTotalRequests'), value: counts.requests },
    { label: t('adminPendingRequests'), value: counts.pendingRequests },
    { label: t('adminConfirmedRequests'), value: counts.confirmedRequests },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <p className="text-3xl font-bold text-teal-700 dark:text-teal-300">{s.value}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
        </Card>
      ))}
    </div>
  )
}
