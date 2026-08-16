export type Building = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'
export type Language = 'en' | 'ro'
export type RequestStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'expired'
export type AvailabilityStatus = 'available' | 'cancelled' | 'expired'

export interface UserRecord {
  id: string
  collectionId: string
  collectionName: string
  email: string
  name: string
  building: Building
  apartment?: string
  phone?: string
  approved: boolean
  language: Language
  created: string
  updated: string
}

export interface SpotRecord {
  id: string
  number: string
  building: Building
  zone?: string
  owner?: string
  enabled: boolean
  notes?: string
  createdAt: string
  updatedAt: string
  expand?: { owner?: UserRecord }
}

export interface AvailabilityRecord {
  id: string
  spot: string
  owner: string
  from: string
  to: string
  reason?: string
  status: AvailabilityStatus
  createdAt: string
  updatedAt: string
  expand?: { spot?: SpotRecord; owner?: UserRecord }
}

export interface GuestRequestRecord {
  id: string
  requester: string
  from: string
  to: string
  guests?: number
  note?: string
  status: RequestStatus
  spot?: string
  confirmer?: string
  reminded?: boolean
  createdAt: string
  updatedAt: string
  expand?: {
    requester?: UserRecord
    spot?: SpotRecord
    confirmer?: UserRecord
  }
}

export type NotificationType =
  | 'submitted'
  | 'new_request'
  | 'confirmed'
  | 'cancelled'
  | 'expired'
  | 'host_removed'
  | 'completed'
  | 'reminder'

export interface NotificationPayload {
  request?: string
  spot?: string
  from?: string
  to?: string
}

export interface NotificationRecord {
  id: string
  recipient: string
  type: NotificationType
  payload?: NotificationPayload | null
  read: boolean
  createdAt: string
  updatedAt: string
}
