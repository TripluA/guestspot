// Dual-role sessions: the same email can exist in both the `users` and
// `_superusers` collections, letting one identity use the site as a resident
// AND administer it. The PocketBase SDK only keeps a single auth store, so we
// cache both tokens here and swap the active one into `pb.authStore` when the
// user switches between the resident area and the admin panel.

export type Role = 'user' | 'admin'

export interface RoleSession {
  token: string
  model: Record<string, unknown> | null
}

export interface DualSession {
  email: string
  user: RoleSession
  admin: RoleSession
  active: Role
}

const KEY = 'guestspot_dual_auth'

export function getDualSession(): DualSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as DualSession
    if (!d || !d.email || !d.user?.token || !d.admin?.token) return null
    return d
  } catch {
    return null
  }
}

export function setDualSession(d: DualSession | null) {
  if (d) localStorage.setItem(KEY, JSON.stringify(d))
  else localStorage.removeItem(KEY)
}

export function clearDualSession() {
  localStorage.removeItem(KEY)
}
