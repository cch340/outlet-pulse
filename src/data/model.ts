// ===== Domain model =====
// Brand ↔ Outlet is many-to-many, modelled by the Store join row.

export interface Brand {
  id: string
  name: string
  color: string // hex chip
  category: string
}

export interface Outlet {
  id: string
  name: string
  location: string
}

/** JOIN row: a brand operating in an outlet. */
export interface Store {
  brandId: string
  outletId: string
}

export interface HistoryEntry {
  brandId: string
  outletId: string
  from: string
  to?: string
  reason?: string
}

export interface Staff {
  id: string
  name: string
  brandId: string
  outletId: string
  role: string
  joined: string // ISO date
  history: HistoryEntry[]
}

export interface Task {
  label: string
  done: boolean
}

export type FollowUpStatus = 'done' | 'pending'

export interface FollowUp {
  id: string
  date: string // ISO date
  staffId: string | null
  brandId: string
  outletId: string
  status: FollowUpStatus
  tasks: Task[]
}

/** Default checklist seeded when scheduling a follow-up. */
export const DEFAULT_TASKS = [
  'Stock & display',
  'Grooming & attendance',
  'Sales target review',
  'Store cleanliness',
  'Promo / POSM setup',
]
