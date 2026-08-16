import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createRoot } from 'react-dom/client'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { Button, cn } from './ui'

// --- Toasts ---

type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  show: (message: string, kind?: ToastKind) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

let nextId = 1

const toastIcons: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />,
  error: <AlertTriangle className="size-4 shrink-0 text-red-500" />,
  info: <Info className="size-4 shrink-0 text-teal-500" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId++
      setToasts((prev) => [...prev, { id, kind, message }])
      window.setTimeout(() => dismiss(id), 4000)
    },
    [dismiss],
  )

  const api: ToastApi = useMemo(
    () => ({
      show: (message, kind = 'info') => push(message, kind),
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error'),
      info: (message) => push(message, 'info'),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            {toastIcons[t.kind]}
            <p className="min-w-0 flex-1 text-sm text-gray-800 dark:text-gray-100">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}

// --- Promise-based confirm dialog ---

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const done = (val: boolean) => {
      root.unmount()
      host.remove()
      resolve(val)
    }
    root.render(
      <ConfirmDialog
        {...options}
        onClose={done}
      />,
    )
  })
}

function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onClose,
}: ConfirmOptions & { onClose: (val: boolean) => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(false)
      }}
    >
      <div className="w-full rounded-t-2xl bg-white p-5 shadow-xl dark:bg-gray-900 sm:max-w-md sm:rounded-2xl">
        <h2 className="text-lg font-semibold">{title}</h2>
        {message && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{message}</p>
        )}
        <div className={cn('mt-4 flex justify-end gap-2')}>
          <Button variant="secondary" onClick={() => onClose(false)}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={() => onClose(true)}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
