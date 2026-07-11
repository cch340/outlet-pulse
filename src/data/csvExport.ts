import type { Visit } from './model'
import type { LatestFailedVisit } from './queries/dashboardSummary'

// UTF-8 BOM. Prepending this makes Excel open the file as UTF-8 rather than
// guessing a legacy codepage (which mangles accented / unicode text). Exported
// separately so `toCsv` stays a pure RFC-4180 serializer.
export const CSV_BOM = '﻿'

/**
 * Escape a single CSV field per RFC-4180: if the value contains a comma,
 * double-quote, CR or LF, wrap it in double-quotes and double any embedded
 * quotes. Otherwise return it unchanged.
 */
export function csvEscape(field: string): string {
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

/** Serialize a matrix of cells to CSV text (CRLF line endings, every cell escaped). No BOM. */
export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')
}

export interface VisitResolver {
  brandName(id: string): string
  outletName(id: string): string
  staffName(id: string | null): string
  /** Human-readable derived status (pending / attention / overdue / done). */
  status(visit: Visit): string
}

const VISIT_HEADER = [
  'Date',
  'Brand',
  'Outlet',
  'Staff',
  'Status',
  'Tasks total',
  'Success',
  'Failed',
  'Pending',
  'Failed tasks',
  'Remarks',
]

/** Build the CSV matrix (header + one row per visit) for a set of domain visits. */
export function visitRows(visits: Visit[], resolve: VisitResolver): string[][] {
  const rows: string[][] = [VISIT_HEADER]
  for (const v of visits) {
    const total = v.tasks.length
    const success = v.tasks.filter((t) => t.status === 'success').length
    const failed = v.tasks.filter((t) => t.status === 'failed').length
    const pending = v.tasks.filter((t) => t.status === 'pending').length
    const failedLabels = v.tasks
      .filter((t) => t.status === 'failed')
      .map((t) => t.label)
      .join('; ')
    const remarks = v.tasks
      .filter((t) => t.remark.trim() !== '')
      .map((t) => `${t.label}: ${t.remark}`)
      .join('; ')
    rows.push([
      v.date,
      resolve.brandName(v.brandId),
      resolve.outletName(v.outletId),
      resolve.staffName(v.staffId),
      resolve.status(v),
      String(total),
      String(success),
      String(failed),
      String(pending),
      failedLabels,
      remarks,
    ])
  }
  return rows
}

const FAILED_TASK_HEADER = ['Date', 'Brand', 'Outlet', 'Staff', 'Task', 'Remark']

/**
 * Build the CSV matrix for the "latest failed tasks by month" data: one row per
 * failed task (a visit with N failed tasks produces N rows). Visits with no
 * failed tasks contribute nothing.
 */
export function failedTaskRows(visits: LatestFailedVisit[]): string[][] {
  const rows: string[][] = [FAILED_TASK_HEADER]
  for (const v of visits) {
    for (const t of v.failed) {
      rows.push([v.date, v.brandName, v.outletName, v.staffName ?? '', t.label, t.remark])
    }
  }
  return rows
}

/** e.g. exportFilename('visits', '2026-07-11') → 'visits-2026-07-11.csv'. */
export function exportFilename(prefix: string, todayISO: string): string {
  return `${prefix}-${todayISO}.csv`
}
