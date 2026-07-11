import type { Frequency, RecurringSchedule } from './model'

export type { Frequency, RecurringSchedule }

// ===== Pure date arithmetic (UTC-safe, no timezone drift) =====
// ISO 'YYYY-MM-DD' strings compare correctly with plain string ordering, so we
// keep everything as ISO strings and only touch Date via Date.UTC (DST-free).

function parseISO(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number)
  return [y, m, d]
}

function fmtParts(y: number, m1: number, d: number): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${y}-${p(m1)}-${p(d)}`
}

/** Days in a 1-based month. */
function daysInMonth(y: number, m1: number): number {
  return new Date(Date.UTC(y, m1, 0)).getUTCDate()
}

/** Add whole days to an ISO date, returning a new ISO date. */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = parseISO(iso)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return fmtParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

/** Add whole months to an ISO date, clamping the day to the target month's last
 *  day (e.g. Jan 31 + 1 month → Feb 28/29). */
export function addMonthsClamped(iso: string, n: number): string {
  const [y, m, d] = parseISO(iso)
  const total = m - 1 + n // 0-based month index across years
  const ny = y + Math.floor(total / 12)
  const nm0 = ((total % 12) + 12) % 12 // 0-based month, normalized
  const day = Math.min(d, daysInMonth(ny, nm0 + 1))
  return fmtParts(ny, nm0 + 1, day)
}

/** The i-th occurrence (0-based) of a schedule, measured from its start date. */
function occurrence(startDate: string, frequency: Frequency, i: number): string {
  return frequency === 'weekly' ? addDays(startDate, 7 * i) : addMonthsClamped(startDate, i)
}

// Safety bound on the occurrence walk so a corrupt schedule can never loop
// forever. Far larger than any realistic weekly cadence would reach.
const MAX_STEPS = 100000

/**
 * The next occurrence date strictly after `lastGenerated`, or the start date
 * (inclusive) if nothing has been generated yet. Returns null for an inactive
 * schedule. `todayISO` is accepted for API symmetry with `dueOccurrences`; the
 * next scheduled date does not depend on today.
 */
export function nextOccurrence(s: RecurringSchedule, _todayISO: string): string | null {
  if (!s.active) return null
  for (let i = 0; i < MAX_STEPS; i++) {
    const d = occurrence(s.startDate, s.frequency, i)
    if (s.lastGenerated == null) return d // startDate is the first occurrence
    if (d > s.lastGenerated) return d
  }
  return null
}

/**
 * Every occurrence that is due and not yet generated (strictly after
 * `lastGenerated`, or from the start date inclusive), oldest first. Returns []
 * for an inactive schedule or an horizon that lands before the start date.
 *
 * An occurrence is due once it falls on or before the horizon `todayISO +
 * leadDays` — i.e. its visit is materialized up to `leadDays` ahead of the
 * occurrence date so staff get advance notice. The visit's date still lands on
 * the occurrence itself (see the generator).
 *
 * Capped at `cap`: if the user was away long enough that MORE than `cap`
 * occurrences came due, only the MOST RECENT `cap` are returned — ancient
 * occurrences are skipped so generation never floods the visit list.
 */
export function dueOccurrences(s: RecurringSchedule, todayISO: string, cap = 3): string[] {
  if (!s.active) return []
  const horizon = addDays(todayISO, s.leadDays)
  const out: string[] = []
  for (let i = 0; i < MAX_STEPS; i++) {
    const d = occurrence(s.startDate, s.frequency, i)
    if (d > horizon) break // beyond the lead horizon: nothing more is due yet
    if (s.lastGenerated != null && d <= s.lastGenerated) continue // already generated
    out.push(d)
    if (out.length > cap) out.shift() // keep only the most recent `cap`
  }
  return out
}
