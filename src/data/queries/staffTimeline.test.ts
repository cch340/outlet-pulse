import { describe, it, expect } from 'vitest'
import { buildStaffTimeline } from './staffTimeline'
import type { HistoryEntry } from '../model'

const resolve = (e: HistoryEntry) => ({
  brandName: `B:${e.brandId}`,
  brandColor: '#111111',
  outletName: `O:${e.outletId}`,
})

describe('buildStaffTimeline', () => {
  it('orders most-recent-first and flags the initial + current postings', () => {
    // Input is oldest→newest, as produced by rowToStaff.
    const history: HistoryEntry[] = [
      { brandId: 'b1', outletId: 'o1', from: 'Mar 2023', to: 'Feb 2025', reason: undefined },
      { brandId: 'b1', outletId: 'o2', from: 'Feb 2025', to: undefined, reason: 'Store closure' },
    ]
    const vms = buildStaffTimeline(history, resolve)

    expect(vms.map((v) => v.fromLabel)).toEqual(['Feb 2025', 'Mar 2023'])
    // Newest first: current posting, then the initial join.
    expect(vms[0].isCurrent).toBe(true)
    expect(vms[0].isInitial).toBe(false)
    expect(vms[0].periodLabel).toBe('Since Feb 2025')
    expect(vms[0].reason).toBe('Store closure')
    expect(vms[0].outletName).toBe('O:o2')

    expect(vms[1].isCurrent).toBe(false)
    expect(vms[1].isInitial).toBe(true)
    expect(vms[1].periodLabel).toBe('Mar 2023 – Feb 2025')
    expect(vms[1].reason).toBeUndefined()
  })

  it('handles a single never-transferred posting (initial and current)', () => {
    const history: HistoryEntry[] = [{ brandId: 'b1', outletId: 'o1', from: 'Jul 2026', to: undefined }]
    const vms = buildStaffTimeline(history, resolve)
    expect(vms).toHaveLength(1)
    expect(vms[0].isCurrent).toBe(true)
    expect(vms[0].isInitial).toBe(true)
    expect(vms[0].periodLabel).toBe('Since Jul 2026')
  })

  it('produces stable unique keys per entry', () => {
    const history: HistoryEntry[] = [
      { brandId: 'b1', outletId: 'o1', from: 'Mar 2023', to: 'Feb 2025' },
      { brandId: 'b1', outletId: 'o2', from: 'Feb 2025', to: undefined },
    ]
    const keys = buildStaffTimeline(history, resolve).map((v) => v.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
