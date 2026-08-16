import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { pb } from './lib/pb'
import { clearDualSession, getDualSession, setDualSession, type Role } from './lib/dualAuth'
import type { UserRecord } from './types'

export interface Session {
  user: UserRecord | null
  isAdmin: boolean
  /** Same email is authenticated as both a resident and an admin. */
  dual: boolean
  loading: boolean
}

const SessionContext = createContext<Session>({ user: null, isAdmin: false, dual: false, loading: true })

function modelToSession(): Session {
  const model = pb.authStore.model as Record<string, unknown> | null
  const coll = model ? String(model.collectionName ?? '') : ''
  return {
    user: coll === 'users' ? (model as unknown as UserRecord) : null,
    isAdmin: coll === '_superusers',
    dual: !!getDualSession(),
    loading: false,
  }
}

// Switch the active session to the given role using the cached dual tokens.
// Best-effort authRefresh re-validates/rotates the token; if it fails the old
// token stays (the next API call will surface a 401 to the caller).
export async function switchRole(role: Role): Promise<boolean> {
  const dual = getDualSession()
  const target = dual && dual[role]
  if (!dual || !target || !target.token) return false

  // Close the realtime SSE stream before swapping the token: it was opened
  // with the previous role's auth, and PB rejects it once authorization
  // changes ("current and previous request authorization don't match").
  // `disconnect` is typed private but is the only way to force-close the
  // EventSource; `connect()` re-establishes it on the next subscribe.
  ;(pb.realtime as unknown as { disconnect: (resubscribe?: boolean) => void }).disconnect()
  pb.authStore.save(target.token, (target.model as never) ?? null)
  setDualSession({ ...dual, active: role })

  try {
    const coll = role === 'user' ? 'users' : '_superusers'
    await pb.collection(coll).authRefresh()
    const updated = getDualSession()
    if (updated) {
      updated[role] = { token: pb.authStore.token, model: pb.authStore.model as never }
      setDualSession(updated)
    }
    return true
  } catch {
    return false
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(() => modelToSession())

  useEffect(() => {
    let active = true
    const unbind = pb.authStore.onChange(() => {
      if (active) setSession(modelToSession())
    })
    return () => {
      active = false
      unbind()
    }
  }, [])

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export function useSession() {
  return useContext(SessionContext)
}

export function signOut() {
  pb.authStore.clear()
  clearDualSession()
}
