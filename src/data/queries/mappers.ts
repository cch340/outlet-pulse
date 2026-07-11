import type {
  Visit,
  HistoryEntry,
  Staff,
  Store,
  Task,
  TaskTemplate,
  TaskStatus,
  RecurringSchedule,
  Frequency,
} from '../model'

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
  phone: string | null
  joined: string
  staff_history: StaffHistoryRow[]
}

export interface TaskRow {
  id: string
  visit_id: string
  label: string
  status: TaskStatus
  remark: string
  sort: number
}

export interface VisitRow {
  id: string
  date: string
  staff_id: string | null
  brand_id: string
  outlet_id: string
  visit_tasks: TaskRow[]
}

export interface TaskTemplateRow {
  id: string
  label: string
  sort: number
}

export const rowToTaskTemplate = (r: TaskTemplateRow): TaskTemplate => ({
  id: r.id,
  label: r.label,
  sort: r.sort,
})

export interface RecurringScheduleRow {
  id: string
  brand_id: string
  outlet_id: string
  staff_id: string | null
  frequency: Frequency
  start_date: string
  task_labels: string[]
  active: boolean
  lead_days: number
  last_generated: string | null
}

export const rowToRecurringSchedule = (r: RecurringScheduleRow): RecurringSchedule => ({
  id: r.id,
  brandId: r.brand_id,
  outletId: r.outlet_id,
  staffId: r.staff_id,
  frequency: r.frequency,
  startDate: r.start_date,
  taskLabels: r.task_labels ?? [],
  active: r.active,
  leadDays: r.lead_days ?? 0,
  lastGenerated: r.last_generated,
})

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
  phone: r.phone ?? undefined,
  joined: r.joined,
  history: [...r.staff_history]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(rowToHistory),
})

const rowToTask = (r: TaskRow): Task => ({ id: r.id, label: r.label, status: r.status, remark: r.remark })

export const rowToVisit = (r: VisitRow): Visit => ({
  id: r.id,
  date: r.date,
  staffId: r.staff_id,
  brandId: r.brand_id,
  outletId: r.outlet_id,
  tasks: [...r.visit_tasks].sort((a, b) => a.sort - b.sort).map(rowToTask),
})
