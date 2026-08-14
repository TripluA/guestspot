import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { pb } from './lib/pb'
import type { UserRecord } from './types'

export interface Session {
  user: UserRecord | null
  isAdmin: boolean
  loading: boolean
}

const SessionContext = createContext<Session>({ user: null, isAdmin: false, loading: true })

function modelToSession(): Session {
  const model = pb.authStore.model as Record<string, unknown> | null
  const coll = model ? String(model.collectionName ?? '') : ''
  return {
    user: coll === 'users' ? (model as unknown as UserRecord) : null,
    isAdmin: coll === '_superusers',
    loading: false,
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
}
