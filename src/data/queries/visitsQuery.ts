export type DatePreset = 'all' | 'month' | 'last30' | 'last90' | 'year' | 'custom'

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

// Shift an ISO date (YYYY-MM-DD) by a number of days, in local calendar terms.
function shiftDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

export function resolveDateRange(
  preset: DatePreset,
  customFrom: string,
  customTo: string,
  today: string,
): { from: string | null; to: string | null } {
  const [y, m] = today.split('-').map(Number)
  switch (preset) {
    case 'all':
      return { from: null, to: null }
    case 'month': {
      const lastDay = new Date(y, m, 0).getDate() // day 0 of next month = last of this month
      return { from: iso(y, m, 1), to: iso(y, m, lastDay) }
    }
    case 'year':
      return { from: iso(y, 1, 1), to: iso(y, 12, 31) }
    case 'last30':
      return { from: shiftDays(today, -29), to: today }
    case 'last90':
      return { from: shiftDays(today, -89), to: today }
    case 'custom':
      return { from: customFrom || null, to: customTo || null }
  }
}

export function orderByIds<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  return ids.map((id) => byId.get(id)).filter((x): x is T => x != null)
}

export interface StatusCounts {
  all: number
  pending: number
  attention: number
  overdue: number
  done: number
}

export function foldStatusCounts(rows: { status: string; n: number }[]): StatusCounts {
  const out: StatusCounts = { all: 0, pending: 0, attention: 0, overdue: 0, done: 0 }
  for (const r of rows) {
    if (r.status === 'pending' || r.status === 'attention' || r.status === 'overdue' || r.status === 'done') {
      out[r.status] = Number(r.n)
    }
  }
  out.all = out.pending + out.attention + out.overdue + out.done
  return out
}

export const pageCount = (total: number, pageSize: number): number =>
  Math.max(1, Math.ceil(total / pageSize))
