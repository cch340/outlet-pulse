export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

/** Lowest selectable year — the app launched in 2026. */
const START_YEAR = 2026

export interface PeriodParams {
  /** 'YYYY-MM' for the dashboard_summary p_month / latest_failed_tasks p_month args. */
  month: string
  /** 'YYYY' for the dashboard_summary p_year arg. */
  year: string
  /** Display label, e.g. 'March 2026'. */
  label: string
}

/** Build the RPC params + display label for a 1-based month within a year. */
export function periodParams(year: number, month: number): PeriodParams {
  const mm = String(month).padStart(2, '0')
  return {
    month: `${year}-${mm}`,
    year: String(year),
    label: `${MONTH_NAMES[month - 1]} ${year}`,
  }
}

/** Selectable years, newest first, from currentYear down to START_YEAR. */
export function yearOptions(currentYear: number): number[] {
  const out: number[] = []
  for (let y = currentYear; y >= START_YEAR; y--) out.push(y)
  return out
}
