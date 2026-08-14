import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { pb } from '../lib/pb'
import { Badge, Button, Card, EmptyState, Spinner } from '../components/ui'
import { fmtDT } from '../lib/format'
import type { UserRecord } from '../types'

export default function ApprovalsPage() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<UserRecord[] | null>(null)
  const [busyId, setBusyId] = useState('')

  const refresh = useCallback(async () => {
    const res = await pb.collection('users').getFullList<UserRecord>({
      sort: 'created',
      filter: 'approved = false',
    })
    setUsers(res)
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      const res = await pb.collection('users').getFullList<UserRecord>({
        sort: 'created',
        filter: 'approved = false',
      })
      if (active) setUsers(res)
    })()
    return () => {
      active = false
    }
  }, [refresh])

  async function approve(u: UserRecord) {
    setBusyId(u.id)
    try {
      await pb.collection('users').update(u.id, { approved: true })
      await refresh()
    } catch {
      window.alert(t('error'))
    } finally {
      setBusyId('')
    }
  }

  async function reject(u: UserRecord) {
    if (!window.confirm(t('adminRejectUserConfirm'))) return
    setBusyId(u.id)
    try {
      await pb.collection('users').delete(u.id)
      await refresh()
    } catch {
      window.alert(t('error'))
    } finally {
      setBusyId('')
    }
  }

  if (!users) return <Spinner />

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">{t('adminApprovals')}</h1>
      {users.length === 0 && <EmptyState title={t('adminNoPending')} />}
      {users.map((u) => (
        <Card key={u.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium">{u.name}</p>
                <Badge color="amber">{t('adminPending')}</Badge>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{u.email}</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t('building')} {u.building}
                {u.apartment ? ` · ${u.apartment}` : ''}
                {u.phone ? ` · ${u.phone}` : ''}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{fmtDT(u.created)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" loading={busyId === u.id} onClick={() => void approve(u)}>
                {t('adminApprove')}
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={busyId === u.id}
                onClick={() => void reject(u)}
              >
                {t('adminReject')}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
