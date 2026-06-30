import { describe, it, expect } from 'vitest'
import { resolveDateRange, orderByIds, foldStatusCounts, pageCount } from './visitsQuery'

describe('resolveDateRange', () => {
  const today = '2026-06-30'
  it('all → open range', () => {
    expect(resolveDateRange('all', '', '', today)).toEqual({ from: null, to: null })
  })
  it('month → first..last day of current month', () => {
    expect(resolveDateRange('month', '', '', today)).toEqual({ from: '2026-06-01', to: '2026-06-30' })
  })
  it('year → Jan 1..Dec 31', () => {
    expect(resolveDateRange('year', '', '', today)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })
  it('last30 → today-29..today inclusive', () => {
    expect(resolveDateRange('last30', '', '', today)).toEqual({ from: '2026-06-01', to: '2026-06-30' })
  })
  it('last90 → today-89..today inclusive', () => {
    expect(resolveDateRange('last90', '', '', today)).toEqual({ from: '2026-04-02', to: '2026-06-30' })
  })
  it('custom → passes through, empty sides become null', () => {
    expect(resolveDateRange('custom', '2026-01-15', '2026-02-20', today)).toEqual({ from: '2026-01-15', to: '2026-02-20' })
    expect(resolveDateRange('custom', '', '', today)).toEqual({ from: null, to: null })
  })
})

describe('orderByIds', () => {
  it('reorders items to match the id sequence', () => {
    const items = [{ id: 'b' }, { id: 'a' }, { id: 'c' }]
    expect(orderByIds(items, ['a', 'b', 'c']).map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })
  it('drops ids with no matching item', () => {
    const items = [{ id: 'a' }]
    expect(orderByIds(items, ['a', 'missing']).map((x) => x.id)).toEqual(['a'])
  })
})

describe('foldStatusCounts', () => {
  it('fills missing statuses with 0 and sums into all', () => {
    expect(foldStatusCounts([{ status: 'pending', n: 2 }, { status: 'done', n: 3 }])).toEqual({
      all: 5, pending: 2, attention: 0, overdue: 0, done: 3,
    })
  })
  it('ignores unknown statuses', () => {
    expect(foldStatusCounts([{ status: 'weird', n: 9 }])).toEqual({
      all: 0, pending: 0, attention: 0, overdue: 0, done: 0,
    })
  })
})

describe('pageCount', () => {
  it('is at least 1 even when empty', () => {
    expect(pageCount(0, 25)).toBe(1)
  })
  it('rounds up', () => {
    expect(pageCount(26, 25)).toBe(2)
    expect(pageCount(50, 25)).toBe(2)
  })
})
