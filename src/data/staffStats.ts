import type { Visit } from './model'
import { visitBaseStatus } from './derived'

/** One month bucket in the 6-month trend (oldest→newest). `done` counts visits
 *  actually carried out that month (base status not 'pending' — i.e. done +
 *  attention), matching the {@link StaffStats.completionRate} definition. */
export interface MonthlyBucket {
  ym: string // 'YYYY-MM'
  label: string // short month name, e.g. 'Jul'
  total: number
  done: number
}

export interface StaffStats {
  totalVisits: number
  doneCount: number
  attentionCount: number
  pendingCount: number
  /** Pending visits whose date is before today (string compare vs todayISO). */
  overdueCount: number
  /** (done + attention) / total — visits actually carried out. 0 when no visits. */
  completionRate: number
  /** success / (success + failed) across every task. null when no resolved tasks. */
  taskSuccessRate: number | null
  failedTaskCount: number
  /** Latest visit date (ISO string), or null when there are no visits. */
  lastVisitDate: string | null
  /** Last 6 months ending at todayISO's month, oldest→newest, zero-filled. */
  monthly: MonthlyBucket[]
}

const MONTH_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Compute per-staff performance stats from the visits ASSIGNED to that staff.
 * Callers should pass only the staff's own visits (staff_id === id); unassigned
 * visits must not be included. Note: the source query caps at 500 visits, so
 * these figures reflect at most the 500 most-recent visits for the staff.
 */
export function computeStaffStats(visits: Visit[], todayISO: string): StaffStats {
  let doneCount = 0
  let attentionCount = 0
  let pendingCount = 0
  let overdueCount = 0
  let successTasks = 0
  let failedTasks = 0
  let lastVisitDate: string | null = null

  for (const v of visits) {
    const base = visitBaseStatus(v.tasks)
    if (base === 'done') doneCount++
    else if (base === 'attention') attentionCount++
    else {
      pendingCount++
      if (v.date < todayISO) overdueCount++
    }
    for (const t of v.tasks) {
      if (t.status === 'success') successTasks++
      else if (t.status === 'failed') failedTasks++
    }
    if (lastVisitDate === null || v.date > lastVisitDate) lastVisitDate = v.date
  }

  const total = visits.length
  const carriedOut = doneCount + attentionCount
  const resolvedTasks = successTasks + failedTasks

  return {
    totalVisits: total,
    doneCount,
    attentionCount,
    pendingCount,
    overdueCount,
    completionRate: total === 0 ? 0 : carriedOut / total,
    taskSuccessRate: resolvedTasks === 0 ? null : successTasks / resolvedTasks,
    failedTaskCount: failedTasks,
    lastVisitDate,
    monthly: buildMonthly(visits, todayISO),
  }
}

/** Six month buckets ending at todayISO's month (inclusive), oldest→newest. */
function buildMonthly(visits: Visit[], todayISO: string): MonthlyBucket[] {
  const y = Number(todayISO.slice(0, 4))
  const m = Number(todayISO.slice(5, 7)) - 1 // 0-based month index

  const buckets: MonthlyBucket[] = []
  const index = new Map<string, MonthlyBucket>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - i, 1))
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const bucket: MonthlyBucket = { ym, label: MONTH_LABEL[d.getUTCMonth()], total: 0, done: 0 }
    buckets.push(bucket)
    index.set(ym, bucket)
  }

  for (const v of visits) {
    const ym = v.date.slice(0, 7)
    const bucket = index.get(ym)
    if (!bucket) continue
    bucket.total++
    if (visitBaseStatus(v.tasks) !== 'pending') bucket.done++
  }

  return buckets
}
