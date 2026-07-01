import { describe, it, expect } from 'vitest'
import { periodParams, yearOptions, MONTH_NAMES } from './dashboardPeriod'

describe('periodParams', () => {
  it('zero-pads the month and builds the label', () => {
    expect(periodParams(2026, 3)).toEqual({ month: '2026-03', year: '2026', label: 'March 2026' })
  })
  it('handles a two-digit month', () => {
    expect(periodParams(2026, 11)).toEqual({ month: '2026-11', year: '2026', label: 'November 2026' })
  })
  it('handles December (index boundary)', () => {
    expect(periodParams(2027, 12)).toEqual({ month: '2027-12', year: '2027', label: 'December 2027' })
  })
})

describe('yearOptions', () => {
  it('returns just 2026 in the launch year', () => {
    expect(yearOptions(2026)).toEqual([2026])
  })
  it('returns newest-first down to 2026', () => {
    expect(yearOptions(2028)).toEqual([2028, 2027, 2026])
  })
})

describe('MONTH_NAMES', () => {
  it('has 12 names starting at January', () => {
    expect(MONTH_NAMES).toHaveLength(12)
    expect(MONTH_NAMES[0]).toBe('January')
    expect(MONTH_NAMES[11]).toBe('December')
  })
})
