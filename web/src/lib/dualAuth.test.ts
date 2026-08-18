import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = new Map<string, string>()

vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k),
  clear: () => storage.clear(),
})

import { clearDualSession, getDualSession, setDualSession, type DualSession } from './dualAuth'

function sample(): DualSession {
  return {
    email: 'admin@example.com',
    user: { token: 'user-token', model: { id: 'u1', collectionName: 'users' } },
    admin: { token: 'admin-token', model: { id: 'a1', collectionName: '_superusers' } },
    active: 'user',
  }
}

describe('dualAuth', () => {
  beforeEach(() => {
    storage.clear()
  })

  it('returns null when nothing is stored', () => {
    expect(getDualSession()).toBeNull()
  })

  it('round-trips a dual session', () => {
    setDualSession(sample())
    expect(getDualSession()).toEqual(sample())
  })

  it('treats a malformed payload as absent', () => {
    storage.set('guestspot_dual_auth', '{not json')
    expect(getDualSession()).toBeNull()
    storage.set('guestspot_dual_auth', JSON.stringify({ email: 'x' }))
    expect(getDualSession()).toBeNull()
  })

  it('clears the store', () => {
    setDualSession(sample())
    clearDualSession()
    expect(getDualSession()).toBeNull()
  })
})
