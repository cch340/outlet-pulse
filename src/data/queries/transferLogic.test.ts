import { describe, it, expect } from 'vitest'
import { monthYear, planTransfer } from './transferLogic'

describe('monthYear', () => {
  it('formats ISO date as "Mon YYYY"', () => {
    expect(monthYear('2026-07-01')).toBe('Jul 2026')
  })
})

describe('planTransfer', () => {
  it('returns ids to close and the stamp label', () => {
    const out = planTransfer({ historyIdsToClose: [{ id: 'h1' }, { id: 'h2' }], toLabel: 'Jul 2026' })
    expect(out.closeIds).toEqual(['h1', 'h2'])
    expect(out.toLabel).toBe('Jul 2026')
  })

  it('handles no open rows', () => {
    expect(planTransfer({ historyIdsToClose: [], toLabel: 'Jul 2026' }).closeIds).toEqual([])
  })
})
