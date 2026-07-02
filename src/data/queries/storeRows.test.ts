import { describe, it, expect } from 'vitest'
import { buildStoreGroups } from './storeRows'
import type { DataSnapshot } from './useData'
import type { LatestFailedVisit } from './dashboardSummary'

const brand = (id: string, name: string, sort: number) => ({ id, name, color: '#000', category: '', sort })
const outlet = (id: string, name: string, location = '') => ({ id, name, location })
const staff = (id: string, brandId: string, outletId: string) => ({
  id, name: id, brandId, outletId, role: '', joined: '2026-01-01', history: [],
})

function snap(partial: Partial<DataSnapshot>): DataSnapshot {
  return { brands: [], outlets: [], stores: [], staff: [], taskTemplates: [], ...partial }
}

describe('buildStoreGroups', () => {
  it('groups by brand array order and sorts rows by outlet name', () => {
    const data = snap({
      brands: [brand('b1', 'Alpha', 0), brand('b2', 'Beta', 1)],
      outlets: [outlet('o1', 'Zeta'), outlet('o2', 'Aary'), outlet('o3', 'Mid')],
      stores: [
        { brandId: 'b1', outletId: 'o1' },
        { brandId: 'b1', outletId: 'o2' },
        { brandId: 'b2', outletId: 'o3' },
      ],
    })
    const groups = buildStoreGroups(data, [])
    expect(groups.map((g) => g.brand.id)).toEqual(['b1', 'b2'])
    expect(groups[0].rows.map((r) => r.outletName)).toEqual(['Aary', 'Zeta'])
  })

  it('joins latest failed status by brand:outlet and is null when absent', () => {
    const data = snap({
      brands: [brand('b1', 'Alpha', 0)],
      outlets: [outlet('o1', 'One'), outlet('o2', 'Two')],
      stores: [
        { brandId: 'b1', outletId: 'o1' },
        { brandId: 'b1', outletId: 'o2' },
      ],
    })
    const latest: LatestFailedVisit[] = [
      {
        brandId: 'b1', outletId: 'o1', visitId: 'v1', date: '2026-07-01',
        brandName: 'Alpha', outletName: 'One', staffName: null, status: 'attention',
        failed: [{ label: 'Fridge', remark: 'hot' }],
      },
    ]
    const groups = buildStoreGroups(data, latest)
    const rows = groups[0].rows
    expect(rows.find((r) => r.outletId === 'o1')!.latest?.visitId).toBe('v1')
    expect(rows.find((r) => r.outletId === 'o2')!.latest).toBeNull()
  })

  it('counts staff posted to the store', () => {
    const data = snap({
      brands: [brand('b1', 'Alpha', 0)],
      outlets: [outlet('o1', 'One')],
      stores: [{ brandId: 'b1', outletId: 'o1' }],
      staff: [staff('s1', 'b1', 'o1'), staff('s2', 'b1', 'o1'), staff('s3', 'b1', 'o2')],
    })
    const groups = buildStoreGroups(data, [])
    expect(groups[0].rows[0].staffCount).toBe(2)
  })

  it('omits brands with no linked stores', () => {
    const data = snap({
      brands: [brand('b1', 'Alpha', 0), brand('b2', 'Beta', 1)],
      outlets: [outlet('o1', 'One')],
      stores: [{ brandId: 'b1', outletId: 'o1' }],
    })
    const groups = buildStoreGroups(data, [])
    expect(groups.map((g) => g.brand.id)).toEqual(['b1'])
  })

  it('returns [] for empty data', () => {
    expect(buildStoreGroups(snap({}), [])).toEqual([])
  })
})
