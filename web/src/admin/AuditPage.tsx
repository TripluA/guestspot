import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { pb } from '../lib/pb'
import { pbErrorMessage } from '../lib/pbError'
import { downloadCSV } from '../lib/csv'
import { Button, Card, Input, Select, Spinner } from '../components/ui'
import { fmtDT } from '../lib/format'

interface AuditLogRecord {
  id: string
  actor?: string
  action: string
  targetType?: string
  targetId?: string
  details?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

const ACTIONS = [
  'all',
  'user.approve',
  'user.update',
  'user.delete',
  'spot.create',
  'spot.update',
  'spot.delete',
  'request.update',
  'request.delete',
]

export default function AuditPage() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<AuditLogRecord[] | null>(null)
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await pb.collection('audit_logs').getFullList<AuditLogRecord>({
          sort: '-createdAt',
        })
        if (active) setLogs(res)
      } catch (err) {
        if (active) setError(pbErrorMessage(err, t) || t('error'))
      }
    })()
    return () => {
      active = false
    }
  }, [t])

  const filtered = useMemo(() => {
    if (!logs) return []
    const q = query.trim().toLowerCase()
    return logs.filter((l) => {
      if (action !== 'all' && l.action !== action) return false
      if (q) {
        const hay = [
          String(l.details?.actorEmail ?? ''),
          l.action,
          l.targetType ?? '',
          l.targetId ?? '',
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [logs, query, action])

  if (error) return <p className="text-red-500">{error}</p>
  if (!logs) return <Spinner />

  function exportCSV() {
    downloadCSV(`guestspot-audit-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['When', 'Actor', 'Action', 'Target', 'Target ID', 'Details'],
      ...filtered.map((l) => [
        l.createdAt,
        String(l.details?.actorEmail ?? ''),
        l.action,
        l.targetType ?? '',
        l.targetId ?? '',
        JSON.stringify(l.details ?? {}),
      ]),
    ])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('adminAudit')}</h1>
        <Button size="sm" variant="secondary" onClick={exportCSV}>
          <Download className="size-4" />
          {t('adminExport')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs flex-1"
          placeholder={t('adminSearchAudit')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select className="w-48" value={action} onChange={(e) => setAction(e.target.value)}>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a === 'all' ? t('adminUsersAll') : a}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 && (
        <Card>
          <p className="py-6 text-center text-gray-400">{t('noData')}</p>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((l) => (
          <Card key={l.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <span className="font-mono text-xs text-teal-700 dark:text-teal-300">
                    {l.action}
                  </span>
                  {l.targetType && (
                    <span className="ml-2 text-gray-500 dark:text-gray-400">
                      {l.targetType}
                      {l.targetId ? ` · ${l.targetId}` : ''}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  {l.details?.actorEmail ? `${String(l.details.actorEmail)} · ` : ''}
                  {fmtDT(l.createdAt)}
                </p>
                {l.details && Object.keys(l.details).length > 0 && (
                  <pre className="mt-1 overflow-x-auto text-xs text-gray-400 dark:text-gray-500">
                    {JSON.stringify(l.details)}
                  </pre>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
