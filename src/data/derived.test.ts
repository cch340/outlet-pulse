import { describe, it, expect } from 'vitest'
import { fmt, staffForStore } from './derived'
import type { DataSnapshot } from './queries/useData'

describe('fmt', () => {
  it('prefixes the short weekday to the date', () => {
    // 2026-06-29 is a Monday.
    expect(fmt('2026-06-29')).toBe('Mon, 29 Jun 2026')
  })
})

describe('staffForStore', () => {
  const snap = {
    staff: [
      { id: 's1', brandId: 'b1', outletId: 'o1' },
      { id: 's2', brandId: 'b1', outletId: 'o2' },
      { id: 's3', brandId: 'b2', outletId: 'o1' },
    ],
  } as unknown as DataSnapshot

  it('returns only staff posted to the given brand AND outlet', () => {
    expect(staffForStore(snap, 'b1', 'o1').map((s) => s.id)).toEqual(['s1'])
  })

  it('returns an empty list when no staff match the store', () => {
    expect(staffForStore(snap, 'b9', 'o9')).toEqual([])
  })
})
