import type { FollowUp, HistoryEntry, Staff, Store, Task } from '../model'

export interface StaffHistoryRow {
  id: string
  staff_id: string
  brand_id: string
  outlet_id: string
  from_label: string
  to_label: string | null
  reason: string | null
  created_at: string
}

export interface StaffRow {
  id: string
  name: string
  brand_id: string
  outlet_id: string
  role: string
  joined: string
  staff_history: StaffHistoryRow[]
}

export interface TaskRow {
  id: string
  follow_up_id: string
  label: string
  done: boolean
  sort: number
}

export interface FollowUpRow {
  id: string
  date: string
  staff_id: string | null
  brand_id: string
  outlet_id: string
  status: 'done' | 'pending'
  follow_up_tasks: TaskRow[]
}

export const rowToStore = (r: { brand_id: string; outlet_id: string }): Store => ({
  brandId: r.brand_id,
  outletId: r.outlet_id,
})

const rowToHistory = (r: StaffHistoryRow): HistoryEntry => ({
  brandId: r.brand_id,
  outletId: r.outlet_id,
  from: r.from_label,
  to: r.to_label ?? undefined,
  reason: r.reason ?? undefined,
})

export const rowToStaff = (r: StaffRow): Staff => ({
  id: r.id,
  name: r.name,
  brandId: r.brand_id,
  outletId: r.outlet_id,
  role: r.role,
  joined: r.joined,
  history: [...r.staff_history]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(rowToHistory),
})

const rowToTask = (r: TaskRow): Task => ({ id: r.id, label: r.label, done: r.done })

export const rowToFollowUp = (r: FollowUpRow): FollowUp => ({
  id: r.id,
  date: r.date,
  staffId: r.staff_id,
  brandId: r.brand_id,
  outletId: r.outlet_id,
  status: r.status,
  tasks: [...r.follow_up_tasks].sort((a, b) => a.sort - b.sort).map(rowToTask),
})
