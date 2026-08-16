import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell } from 'lucide-react'
import { pb } from '../lib/pb'
import { useSession } from '../auth'
import { fmtDT, fmtRange } from '../lib/format'
import { cn } from './ui'
import type { NotificationRecord } from '../types'

function messageFor(n: NotificationRecord, t: (k: string) => string): string {
  const p = (n.payload ?? {}) as { from?: string; to?: string }
  const range = p.from && p.to ? fmtRange(p.from, p.to) : null
  const base =
    n.type === 'new_request'
      ? t('notificationNewRequest')
      : n.type === 'confirmed'
        ? t('notificationConfirmed')
        : n.type === 'cancelled'
          ? t('notificationCancelled')
          : n.type === 'expired'
            ? t('notificationExpired')
            : n.type === 'host_removed'
              ? t('notificationHostRemoved')
              : n.type
  return range ? `${base} — ${range}` : base
}

export default function NotificationBell() {
  const { t } = useTranslation()
  const { user } = useSession()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationRecord[]>([])
  const isRefreshing = useRef(false)

  const unread = items.filter((n) => !n.read).length

  useEffect(() => {
    if (!user) return
    let active = true

    const load = async () => {
      if (isRefreshing.current) return
      isRefreshing.current = true
      try {
        const res = await pb.collection('notifications').getList<NotificationRecord>(1, 20, {
          sort: '-createdAt',
          filter: `recipient = "${user.id}"`,
        })
        if (!active) return
        setItems(res.items)
      } finally {
        isRefreshing.current = false
      }
    }
    void load()

    const unsub = pb
      .collection('notifications')
      .subscribe('*', (e) => {
        const n = e.record as unknown as NotificationRecord
        if (!n || n.recipient !== user.id) return
        if (e.action === 'create') {
          setItems((prev) => [n, ...prev].slice(0, 20))
        } else if (e.action === 'update' || e.action === 'delete') {
          setItems((prev) => prev.filter((x) => x.id !== n.id))
        }
      })
      .catch(() => () => {})

    return () => {
      active = false
      void unsub.then((fn) => fn && fn())
    }
  }, [user])

  async function markAllRead() {
    const ids = items.filter((n) => !n.read).map((n) => n.id)
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    await Promise.allSettled(
      ids.map((id) => pb.collection('notifications').update(id, { read: true })),
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        title={t('notificationsTitle')}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
              <h2 className="text-sm font-semibold">{t('notificationsTitle')}</h2>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-300"
                >
                  {t('notificationsMarkAllRead')}
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-gray-400">{t('notificationsEmpty')}</p>
              )}
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (!n.read) {
                      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
                      void pb.collection('notifications').update(n.id, { read: true }).catch(() => {})
                    }
                  }}
                  className={cn(
                    'block w-full border-b border-gray-50 px-4 py-2.5 text-left last:border-0 dark:border-gray-800',
                    n.read ? 'opacity-70' : 'bg-teal-50/50 dark:bg-teal-950/30',
                  )}
                >
                  <p className="text-sm text-gray-800 dark:text-gray-100">{messageFor(n, t)}</p>
                  <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{fmtDT(n.createdAt)}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
