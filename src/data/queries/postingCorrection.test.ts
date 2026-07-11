import { describe, it, expect } from 'vitest'
import { planPostingCorrection } from './postingCorrection'
import type { HistoryEntry } from '../model'

const entry = (over: Partial<HistoryEntry>): HistoryEntry => ({
  id: 'h',
  brandId: 'b1',
  outletId: 'o1',
  from: 'Mar 2023',
  ...over,
})

describe('planPostingCorrection', () => {
  it('returns the new brand/outlet on the staff row', () => {
    const plan = planPostingCorrection({ history: [] }, 'b2', 'o2')
    expect(plan.brandId).toBe('b2')
    expect(plan.outletId).toBe('o2')
  })

  it('gives no history update when the staff has no history', () => {
    const plan = planPostingCorrection({ history: [] }, 'b2', 'o2')
    expect(plan.currentHistoryRowUpdate).toBeNull()
  })

  it('updates the only (current) entry when history has one open entry', () => {
    const history = [entry({ id: 'h1', to: undefined })]
    const plan = planPostingCorrection({ history }, 'b2', 'o2')
    expect(plan.currentHistoryRowUpdate).toEqual({ id: 'h1', brandId: 'b2', outletId: 'o2' })
  })

  it('updates only the current entry when there are past + current entries', () => {
    const history = [
      entry({ id: 'h1', from: 'Mar 2023', to: 'Feb 2025' }),
      entry({ id: 'h2', brandId: 'b1', outletId: 'o9', from: 'Feb 2025', to: undefined }),
    ]
    const plan = planPostingCorrection({ history }, 'b2', 'o2')
    expect(plan.currentHistoryRowUpdate).toEqual({ id: 'h2', brandId: 'b2', outletId: 'o2' })
  })
})
