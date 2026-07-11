import { describe, it, expect } from 'vitest'
import { matchesQuery, compareBy } from './listFilter'

describe('matchesQuery', () => {
  it('matches everything on an empty query', () => {
    expect(matchesQuery('', 'anything')).toBe(true)
  })

  it('matches everything on a whitespace-only query', () => {
    expect(matchesQuery('   ', 'anything')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(matchesQuery('NIKE', 'nike')).toBe(true)
    expect(matchesQuery('nike', 'NIKE')).toBe(true)
  })

  it('matches a substring, not just a prefix', () => {
    expect(matchesQuery('ike', 'Nike')).toBe(true)
  })

  it('matches when any one of several fields matches', () => {
    expect(matchesQuery('sport', 'Nike', 'Sportswear')).toBe(true)
  })

  it('returns false when no field matches', () => {
    expect(matchesQuery('adidas', 'Nike', 'Sportswear')).toBe(false)
  })

  it('ignores undefined and null fields', () => {
    expect(matchesQuery('nike', undefined, null, 'Nike')).toBe(true)
    expect(matchesQuery('nike', undefined, null)).toBe(false)
  })

  it('trims surrounding whitespace on the query', () => {
    expect(matchesQuery('  nike  ', 'Nike')).toBe(true)
  })
})

describe('compareBy', () => {
  it('sorts strings ascending, case-insensitively', () => {
    const items = [{ n: 'banana' }, { n: 'Apple' }, { n: 'cherry' }]
    const sorted = items.slice().sort(compareBy((x) => x.n, 'asc'))
    expect(sorted.map((x) => x.n)).toEqual(['Apple', 'banana', 'cherry'])
  })

  it('sorts strings descending', () => {
    const items = [{ n: 'banana' }, { n: 'Apple' }, { n: 'cherry' }]
    const sorted = items.slice().sort(compareBy((x) => x.n, 'desc'))
    expect(sorted.map((x) => x.n)).toEqual(['cherry', 'banana', 'Apple'])
  })

  it('sorts numbers numerically, not lexically', () => {
    const items = [{ c: 2 }, { c: 10 }, { c: 1 }]
    const sorted = items.slice().sort(compareBy((x) => x.c, 'asc'))
    expect(sorted.map((x) => x.c)).toEqual([1, 2, 10])
  })

  it('sorts numbers descending', () => {
    const items = [{ c: 2 }, { c: 10 }, { c: 1 }]
    const sorted = items.slice().sort(compareBy((x) => x.c, 'desc'))
    expect(sorted.map((x) => x.c)).toEqual([10, 2, 1])
  })
})
