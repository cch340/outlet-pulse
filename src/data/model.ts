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

export type TaskStatus = 'pending' | 'failed' | 'success'

export interface Task {
  id?: string // present once persisted; absent for default checklist templates
  label: string
  status: TaskStatus
  remark: string // '' when empty
}

export interface Visit {
  id: string
  date: string // ISO date
  staffId: string | null
  brandId: string
  outletId: string
  tasks: Task[]
}

export interface TaskTemplate {
  id: string
  label: string
  sort: number
}
