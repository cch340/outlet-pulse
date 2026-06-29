import type { DataSnapshot } from './queries/useData'
import type { Brand, Visit, Outlet, Staff } from './model'

// Production "today" comes from the real clock. The prototype fixed it at 2026-06-29.
export const today = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

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

export const isOverdue = (f: Visit) => f.status === 'pending' && new Date(f.date + 'T00:00:00') < today()

export const linked = (s: DataSnapshot, bId: string, oId: string) =>
  s.stores.some((st) => st.brandId === bId && st.outletId === oId)

export const staffCount = (s: DataSnapshot, bId: string | null, oId: string | null) =>
  s.staff.filter((x) => (!bId || x.brandId === bId) && (!oId || x.outletId === oId)).length

export const tenure = (joined: string) => {
  const d = new Date(joined + 'T00:00:00')
  const t = today()
  const m = (t.getFullYear() - d.getFullYear()) * 12 + (t.getMonth() - d.getMonth())
  const y = Math.floor(m / 12)
  const mm = m % 12
  return y > 0 ? `${y}y ${mm}m` : `${mm}m`
}

export type DerivedStatus = 'done' | 'pending' | 'overdue'

export const STATUS_COLOR: Record<DerivedStatus, string> = {
  done: '#16a34a',
  pending: '#d97706',
  overdue: '#dc2626',
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
  doneT: number
  progressPct: number
  isOverdue: boolean
}

export function visitVM(s: DataSnapshot, f: Visit): VisitVM {
  const b = brandById(s, f.brandId)
  const o = outletById(s, f.outletId)
  const st = f.staffId ? staffById(s, f.staffId) : null
  const od = isOverdue(f)
  const status: DerivedStatus = f.status === 'done' ? 'done' : od ? 'overdue' : 'pending'
  const total = f.tasks.length
  const doneT = f.tasks.filter((x) => x.done).length
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
    statusLabel: status.charAt(0).toUpperCase() + status.slice(1),
    statusColor: STATUS_COLOR[status],
    total,
    doneT,
    progressPct: total ? Math.round((doneT / total) * 100) : 0,
    isOverdue: od,
  }
}
