import { describe, it, expect } from 'vitest'
import { addDays, addMonthsClamped, nextOccurrence, dueOccurrences } from './recurrence'
import type { RecurringSchedule } from './model'

const mk = (o: Partial<RecurringSchedule> = {}): RecurringSchedule => ({
  id: 'r1',
  brandId: 'b1',
  outletId: 'o1',
  staffId: null,
  frequency: 'weekly',
  startDate: '2026-01-01',
  taskLabels: [],
  active: true,
  leadDays: 0,
  lastGenerated: null,
  ...o,
})

describe('addDays', () => {
  it('steps forward without timezone drift', () => {
    expect(addDays('2026-01-01', 7)).toBe('2026-01-08')
    expect(addDays('2026-01-28', 7)).toBe('2026-02-04') // crosses month
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01') // crosses year
  })
})

describe('addMonthsClamped', () => {
  it('keeps the same day of month when it exists', () => {
    expect(addMonthsClamped('2026-01-15', 1)).toBe('2026-02-15')
    expect(addMonthsClamped('2026-01-15', 2)).toBe('2026-03-15')
  })
  it('clamps to the last day of shorter months', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28') // 2026 not leap
    expect(addMonthsClamped('2024-01-31', 1)).toBe('2024-02-29') // 2024 leap
    expect(addMonthsClamped('2026-01-31', 3)).toBe('2026-04-30')
  })
  it('does not "remember" clamped days beyond the shorter month', () => {
    // Jan 31 → Feb 28, then Feb 28 + 1 stays 28 (independent per call).
    expect(addMonthsClamped('2026-01-31', 2)).toBe('2026-03-31')
  })
  it('crosses year boundaries', () => {
    expect(addMonthsClamped('2026-12-15', 1)).toBe('2027-01-15')
  })
})

describe('nextOccurrence', () => {
  const today = '2026-01-01'

  it('returns null for an inactive schedule', () => {
    expect(nextOccurrence(mk({ active: false }), today)).toBeNull()
  })

  it('returns the start date when never generated', () => {
    expect(nextOccurrence(mk({ startDate: '2026-03-10' }), today)).toBe('2026-03-10')
  })

  it('returns the next weekly step after lastGenerated', () => {
    expect(nextOccurrence(mk({ startDate: '2026-01-01', lastGenerated: '2026-01-08' }), today)).toBe(
      '2026-01-15',
    )
  })

  it('returns the next monthly step after lastGenerated, clamped', () => {
    const s = mk({ frequency: 'monthly', startDate: '2026-01-31', lastGenerated: '2026-01-31' })
    expect(nextOccurrence(s, today)).toBe('2026-02-28')
  })

  it('is independent of today for a generated schedule', () => {
    const s = mk({ startDate: '2026-01-01', lastGenerated: '2026-01-08' })
    expect(nextOccurrence(s, '2020-01-01')).toBe('2026-01-15')
    expect(nextOccurrence(s, '2030-01-01')).toBe('2026-01-15')
  })
})

describe('dueOccurrences', () => {
  it('returns [] for an inactive schedule', () => {
    expect(dueOccurrences(mk({ active: false }), '2026-02-01')).toEqual([])
  })

  it('returns [] when the start date is in the future', () => {
    expect(dueOccurrences(mk({ startDate: '2026-06-01' }), '2026-01-01')).toEqual([])
  })

  it('treats an occurrence falling on today as due', () => {
    expect(dueOccurrences(mk({ startDate: '2026-01-01' }), '2026-01-01')).toEqual(['2026-01-01'])
  })

  it('collects every weekly occurrence up to today, oldest first', () => {
    // start Jan 1, today Jan 22 → Jan 1, 8, 15, 22
    expect(dueOccurrences(mk({ startDate: '2026-01-01' }), '2026-01-22', 10)).toEqual([
      '2026-01-01',
      '2026-01-08',
      '2026-01-15',
      '2026-01-22',
    ])
  })

  it('excludes occurrences already generated', () => {
    expect(
      dueOccurrences(mk({ startDate: '2026-01-01', lastGenerated: '2026-01-08' }), '2026-01-22', 10),
    ).toEqual(['2026-01-15', '2026-01-22'])
  })

  it('caps to the MOST RECENT `cap`, skipping ancient occurrences', () => {
    // Many weeks due; default cap 3 keeps only the last three (up to today).
    // today Jan 29 → occurrences Jan 1,8,15,22,29 → last 3 are 15,22,29.
    expect(dueOccurrences(mk({ startDate: '2026-01-01' }), '2026-01-29')).toEqual([
      '2026-01-15',
      '2026-01-22',
      '2026-01-29',
    ])
  })

  it('handles monthly clamping across due occurrences', () => {
    // start Jan 31, today Apr 30 → Jan 31, Feb 28, Mar 31, Apr 30 (cap 10)
    expect(
      dueOccurrences(mk({ frequency: 'monthly', startDate: '2026-01-31' }), '2026-04-30', 10),
    ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })

  it('returns nothing when everything is already generated', () => {
    expect(
      dueOccurrences(mk({ startDate: '2026-01-01', lastGenerated: '2026-01-22' }), '2026-01-22', 10),
    ).toEqual([])
  })

  describe('lead time (create in advance)', () => {
    it('leadDays 3 makes an occurrence 3 days out due today', () => {
      // occurrence Jan 4, today Jan 1, horizon Jan 4 → due
      expect(dueOccurrences(mk({ startDate: '2026-01-04', leadDays: 3 }), '2026-01-01')).toEqual([
        '2026-01-04',
      ])
    })

    it('leadDays 3 does NOT make an occurrence 4 days out due', () => {
      // occurrence Jan 5, today Jan 1, horizon Jan 4 → not yet due
      expect(dueOccurrences(mk({ startDate: '2026-01-05', leadDays: 3 }), '2026-01-01')).toEqual([])
    })

    it('lead horizon crosses a month boundary', () => {
      // occurrence Feb 2, today Jan 30, leadDays 3 → horizon Feb 2 → due
      expect(dueOccurrences(mk({ startDate: '2026-02-02', leadDays: 3 }), '2026-01-30')).toEqual([
        '2026-02-02',
      ])
      // one day short: horizon Feb 1 < Feb 2 → not due
      expect(dueOccurrences(mk({ startDate: '2026-02-02', leadDays: 2 }), '2026-01-30')).toEqual([])
    })

    it('weekly leadDays 7 materializes exactly at the previous occurrence, no duplication', () => {
      // start Jan 1 weekly, today Jan 1, leadDays 7 → horizon Jan 8 → Jan 1 & Jan 8 due
      const s = mk({ startDate: '2026-01-01', leadDays: 7 })
      const first = dueOccurrences(s, '2026-01-01', 10)
      expect(first).toEqual(['2026-01-01', '2026-01-08'])
      // after generating those, last_generated advances to Jan 8; a week later the
      // horizon (Jan 15) yields only the fresh occurrence — no re-materialization.
      const s2 = mk({ startDate: '2026-01-01', leadDays: 7, lastGenerated: '2026-01-08' })
      expect(dueOccurrences(s2, '2026-01-08', 10)).toEqual(['2026-01-15'])
    })
  })
})
