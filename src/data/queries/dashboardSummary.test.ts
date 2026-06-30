import { describe, it, expect } from 'vitest'
import { mapDashboardSummary, mapMissingLabelVisit, EMPTY_SUMMARY, mapLatestFailedTasks } from './dashboardSummary'

describe('mapDashboardSummary', () => {
  it('maps a full snake_case payload to the camelCase domain shape', () => {
    const raw = {
      kpis_month: { total: 5, done: 3, pending: 2, overdue: 1 },
      kpis_year: { total: 40, done: 30, pending: 10, overdue: 4 },
      trend: [{ month: '2026-01', done: 2, total: 3 }],
      brand_breakdown: [{ brand_id: 'b1', done: 4, total: 6 }],
      overdue: [{ id: 'v1', date: '2026-05-01', brand_name: 'B', outlet_name: 'O', staff_name: 'S' }],
      upcoming: [{ id: 'v2', date: '2026-07-01', brand_name: 'B', outlet_name: 'O', staff_name: null }],
      overdue_total: 12,
      upcoming_total: 7,
    }
    expect(mapDashboardSummary(raw)).toEqual({
      kpisMonth: { total: 5, done: 3, pending: 2, overdue: 1 },
      kpisYear: { total: 40, done: 30, pending: 10, overdue: 4 },
      trend: [{ month: '2026-01', done: 2, total: 3 }],
      brandBreakdown: [{ brandId: 'b1', done: 4, total: 6 }],
      overdue: [{ id: 'v1', date: '2026-05-01', brandName: 'B', outletName: 'O', staffName: 'S' }],
      upcoming: [{ id: 'v2', date: '2026-07-01', brandName: 'B', outletName: 'O', staffName: null }],
      overdueTotal: 12,
      upcomingTotal: 7,
    })
  })

  it('defaults missing arrays to [] and missing kpi fields to 0', () => {
    expect(mapDashboardSummary({})).toEqual(EMPTY_SUMMARY)
    expect(mapDashboardSummary({ kpis_month: { total: 3 } }).kpisMonth).toEqual({
      total: 3, done: 0, pending: 0, overdue: 0,
    })
  })

  it('coerces numeric strings (bigint-as-string) to numbers', () => {
    const r = mapDashboardSummary({ overdue_total: '9', kpis_year: { total: '40' } })
    expect(r.overdueTotal).toBe(9)
    expect(r.kpisYear.total).toBe(40)
  })
})

describe('mapMissingLabelVisit', () => {
  it('maps a row to camelCase with null staff fallback', () => {
    expect(mapMissingLabelVisit({ id: 'v1', date: '2026-06-30', brand_name: 'B', outlet_name: 'O', staff_name: null }))
      .toEqual({ id: 'v1', date: '2026-06-30', brandName: 'B', outletName: 'O', staffName: null })
  })
})

describe('mapLatestFailedTasks', () => {
  it('maps an attention visit with failed tasks (remarks preserved)', () => {
    const raw = [
      {
        brand_id: 'b1', outlet_id: 'o1', id: 'v1', date: '2026-06-01',
        brand_name: 'Acme', outlet_name: 'Mall', staff_name: 'Sam',
        base_status: 'attention',
        failed: [
          { label: 'Fridge temp', remark: 'too warm' },
          { label: 'Shelf tidy', remark: '' },
        ],
      },
    ]
    expect(mapLatestFailedTasks(raw)).toEqual([
      {
        brandId: 'b1', outletId: 'o1', visitId: 'v1', date: '2026-06-01',
        brandName: 'Acme', outletName: 'Mall', staffName: 'Sam',
        status: 'attention',
        failed: [
          { label: 'Fridge temp', remark: 'too warm' },
          { label: 'Shelf tidy', remark: '' },
        ],
      },
    ])
  })

  it('maps an all-success (done) visit with empty failed list and null staff', () => {
    const raw = [
      {
        brand_id: 'b2', outlet_id: 'o2', id: 'v2', date: '2026-06-02',
        brand_name: 'Beta', outlet_name: 'Plaza', staff_name: null,
        base_status: 'done', failed: [],
      },
    ]
    expect(mapLatestFailedTasks(raw)).toEqual([
      {
        brandId: 'b2', outletId: 'o2', visitId: 'v2', date: '2026-06-02',
        brandName: 'Beta', outletName: 'Plaza', staffName: null,
        status: 'done', failed: [],
      },
    ])
  })

  it('coerces missing remark/failed/staff to defaults and non-array input to []', () => {
    expect(mapLatestFailedTasks(null)).toEqual([])
    expect(mapLatestFailedTasks(undefined)).toEqual([])
    const r = mapLatestFailedTasks([
      { brand_id: 'b', outlet_id: 'o', id: 'v', date: '2026-06-03',
        brand_name: 'B', outlet_name: 'O', base_status: 'attention',
        failed: [{ label: 'X' }] },
    ])
    expect(r[0].staffName).toBeNull()
    expect(r[0].failed).toEqual([{ label: 'X', remark: '' }])
  })
})
