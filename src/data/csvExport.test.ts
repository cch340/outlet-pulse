import { describe, it, expect } from 'vitest'
import {
  CSV_BOM,
  csvEscape,
  toCsv,
  visitRows,
  failedTaskRows,
  exportFilename,
  type VisitResolver,
} from './csvExport'
import type { Visit, Task } from './model'
import type { LatestFailedVisit } from './queries/dashboardSummary'

describe('csvEscape', () => {
  it('leaves plain values unquoted', () => {
    expect(csvEscape('hello')).toBe('hello')
    expect(csvEscape('')).toBe('')
  })

  it('quotes values containing a comma', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
  })

  it('quotes and doubles embedded quotes', () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
  })

  it('quotes values with newlines (LF and CR)', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
    expect(csvEscape('a\r\nb')).toBe('"a\r\nb"')
  })

  it('leaves unicode untouched when no special chars', () => {
    expect(csvEscape('café ☕ 日本語')).toBe('café ☕ 日本語')
  })
})

describe('toCsv', () => {
  it('joins rows with CRLF and cells with commas', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d')
  })

  it('escapes every cell', () => {
    expect(toCsv([['x,y', 'z']])).toBe('"x,y",z')
  })

  it('does not include the BOM', () => {
    expect(toCsv([['a']]).startsWith(CSV_BOM)).toBe(false)
    expect(CSV_BOM).toBe('﻿')
  })
})

const task = (label: string, status: Task['status'], remark = ''): Task => ({ label, status, remark })

const resolver: VisitResolver = {
  brandName: (id) => ({ b1: 'Acme', b2: 'Globex' })[id] ?? id,
  outletName: (id) => ({ o1: 'Downtown' })[id] ?? id,
  staffName: (id) => (id ? ({ s1: 'Alice' })[id] ?? id : ''),
  status: () => 'Attention required',
  photoCount: (id) => ({ v1: 3 })[id] ?? 0,
}

describe('visitRows', () => {
  const visit: Visit = {
    id: 'v1',
    date: '2026-07-11',
    staffId: 's1',
    brandId: 'b1',
    outletId: 'o1',
    tasks: [
      task('Cleanliness', 'success'),
      task('Stock', 'failed', 'Empty shelf'),
      task('Signage', 'failed', 'Torn poster'),
      task('Greeting', 'pending'),
    ],
  }

  it('emits a header row', () => {
    const rows = visitRows([], resolver)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual([
      'Date', 'Brand', 'Outlet', 'Staff', 'Status',
      'Tasks total', 'Success', 'Failed', 'Pending', 'Photos', 'Failed tasks', 'Remarks',
    ])
  })

  it('resolves names, counts, photo count, failed labels and remarks', () => {
    const [, row] = visitRows([visit], resolver)
    expect(row).toEqual([
      '2026-07-11',
      'Acme',
      'Downtown',
      'Alice',
      'Attention required',
      '4', // total
      '1', // success
      '2', // failed
      '1', // pending
      '3', // photos
      'Stock; Signage', // failed task labels joined
      'Stock: Empty shelf; Signage: Torn poster', // non-empty remarks as "label: remark"
    ])
  })

  it('renders empty staff for a null staffId', () => {
    const unassigned: Visit = { ...visit, staffId: null, tasks: [task('X', 'success')] }
    const [, row] = visitRows([unassigned], resolver)
    expect(row[3]).toBe('')
  })

  it('handles a visit with no tasks (all counts zero, empty aggregates)', () => {
    const empty: Visit = { ...visit, id: 'v0', tasks: [] }
    const [, row] = visitRows([empty], resolver)
    // total, success, failed, pending, photos, failedLabels, remarks
    expect(row.slice(5)).toEqual(['0', '0', '0', '0', '0', '', ''])
  })

  it('emits the resolved photo count in the Photos column', () => {
    const [, row] = visitRows([visit], resolver)
    expect(row[9]).toBe('3')
  })
})

describe('failedTaskRows', () => {
  const visits: LatestFailedVisit[] = [
    {
      brandId: 'b1', outletId: 'o1', visitId: 'v1', date: '2026-07-01',
      brandName: 'Acme', outletName: 'Downtown', staffName: 'Alice', status: 'attention',
      failed: [
        { label: 'Stock', remark: 'Empty' },
        { label: 'Signage', remark: '' },
      ],
    },
    {
      brandId: 'b2', outletId: 'o1', visitId: 'v2', date: '2026-07-02',
      brandName: 'Globex', outletName: 'Downtown', staffName: null, status: 'attention',
      failed: [{ label: 'Cleanliness', remark: 'Dusty' }],
    },
  ]

  it('emits one row per failed task with a header', () => {
    const rows = failedTaskRows(visits)
    expect(rows[0]).toEqual(['Date', 'Brand', 'Outlet', 'Staff', 'Task', 'Remark'])
    expect(rows).toHaveLength(4) // header + 2 + 1
    expect(rows[1]).toEqual(['2026-07-01', 'Acme', 'Downtown', 'Alice', 'Stock', 'Empty'])
    expect(rows[3]).toEqual(['2026-07-02', 'Globex', 'Downtown', '', 'Cleanliness', 'Dusty'])
  })

  it('renders empty staff for null staffName', () => {
    const [, , , row] = failedTaskRows(visits)
    expect(row[3]).toBe('')
  })

  it('produces just the header when there are no visits', () => {
    expect(failedTaskRows([])).toHaveLength(1)
  })
})

describe('exportFilename', () => {
  it('joins prefix and date with a .csv extension', () => {
    expect(exportFilename('visits', '2026-07-11')).toBe('visits-2026-07-11.csv')
    expect(exportFilename('failed-tasks', '2026-01-05')).toBe('failed-tasks-2026-01-05.csv')
  })
})
