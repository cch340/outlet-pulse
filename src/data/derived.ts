import type { DataSnapshot } from './queries/useData'
import type { Brand, Visit, Outlet, Staff, Task, TaskStatus } from './model'

// Production "today" comes from the real clock. The prototype fixed it at 2026-06-29.
export const today = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** A Date as a local-calendar 'YYYY-MM-DD' string (matches today()'s local-midnight basis). */
export const localDateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const fmt = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  const rest = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  return `${WEEKDAY[d.getDay()]}, ${rest}`
}

export const initials = (n: string) =>
  n
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')

export const brandById = (s: DataSnapshot, id: string): Brand => s.brands.find((b) => b.id === id)!
export const outletById = (s: DataSnapshot, id: string): Outlet => s.outlets.find((o) => o.id === id)!
export const staffById = (s: DataSnapshot, id: string): Staff => s.staff.find((x) => x.id === id)!

export type VisitBaseStatus = 'pending' | 'attention' | 'done'

export function visitBaseStatus(tasks: Task[]): VisitBaseStatus {
  if (tasks.length === 0) return 'pending'
  if (tasks.some((t) => t.status === 'pending')) return 'pending'
  if (tasks.some((t) => t.status === 'failed')) return 'attention'
  return 'done'
}

export const visitStatus = (f: Visit): VisitBaseStatus => visitBaseStatus(f.tasks)

// A visit counts as complete once its task list is fully resolved (every task
// marked success or failed) — i.e. no pending tasks remain. Both 'done' and
// 'attention' base statuses are complete; only 'pending' is not.
export const visitComplete = (f: Visit): boolean => visitStatus(f) !== 'pending'

export const isOverdue = (f: Visit) =>
  visitStatus(f) === 'pending' && new Date(f.date + 'T00:00:00') < today()

export const linked = (s: DataSnapshot, bId: string, oId: string) =>
  s.stores.some((st) => st.brandId === bId && st.outletId === oId)

export const staffCount = (s: DataSnapshot, bId: string | null, oId: string | null) =>
  s.staff.filter((x) => (!bId || x.brandId === bId) && (!oId || x.outletId === oId)).length

/** Staff posted to a store (the brand+outlet pair). */
export const staffForStore = (s: DataSnapshot, bId: string, oId: string): Staff[] =>
  s.staff.filter((x) => x.brandId === bId && x.outletId === oId)

export const tenure = (joined: string) => {
  const d = new Date(joined + 'T00:00:00')
  const t = today()
  const m = (t.getFullYear() - d.getFullYear()) * 12 + (t.getMonth() - d.getMonth())
  const y = Math.floor(m / 12)
  const mm = m % 12
  return y > 0 ? `${y}y ${mm}m` : `${mm}m`
}

export type DerivedStatus = 'done' | 'pending' | 'overdue' | 'attention'

export const STATUS_COLOR: Record<DerivedStatus, string> = {
  done: '#16a34a',
  pending: '#d97706',
  overdue: '#ea580c',
  attention: '#dc2626',
}

export const STATUS_LABEL: Record<DerivedStatus, string> = {
  done: 'Done',
  pending: 'Pending',
  overdue: 'Overdue',
  attention: 'Attention required',
}

// Per-task dot color for read-only checklist displays (mirrors the drawer's segments).
export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  pending: '#6b7280',
  failed: '#dc2626',
  success: '#16a34a',
}

export interface VisitVM {
  id: string
  brandName: string
  brandColor: string
  outletName: string
  location: string
  staffName: string
  staffInitials: string
  title: string
  sub: string
  dateLabel: string
  status: DerivedStatus
  statusLabel: string
  statusColor: string
  total: number
  successT: number
  failedT: number
  pendingT: number
  resolvedT: number
  progressPct: number
  isOverdue: boolean
}

export function visitVM(s: DataSnapshot, f: Visit): VisitVM {
  const b = brandById(s, f.brandId)
  const o = outletById(s, f.outletId)
  const st = f.staffId ? staffById(s, f.staffId) : null
  const base = visitStatus(f)
  const od = isOverdue(f)
  const status: DerivedStatus =
    base === 'done' ? 'done' : base === 'attention' ? 'attention' : od ? 'overdue' : 'pending'
  const total = f.tasks.length
  const successT = f.tasks.filter((x) => x.status === 'success').length
  const failedT = f.tasks.filter((x) => x.status === 'failed').length
  const pendingT = f.tasks.filter((x) => x.status === 'pending').length
  const resolvedT = successT + failedT
  return {
    id: f.id,
    brandName: b.name,
    brandColor: b.color,
    outletName: o.name,
    location: o.location,
    staffName: st ? st.name : 'Unassigned',
    staffInitials: st ? initials(st.name) : '–',
    title: `${b.name} · ${o.name}`,
    sub: `${st ? st.name : 'Unassigned'} · ${total} checks`,
    dateLabel: fmt(f.date),
    status,
    statusLabel: STATUS_LABEL[status],
    statusColor: STATUS_COLOR[status],
    total,
    successT,
    failedT,
    pendingT,
    resolvedT,
    progressPct: total ? Math.round((resolvedT / total) * 100) : 0,
    isOverdue: od,
  }
}
