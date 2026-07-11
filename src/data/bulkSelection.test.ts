import { describe, it, expect } from 'vitest'
import { toggleId, selectAll, allSelected } from './bulkSelection'

describe('toggleId', () => {
  it('adds an id that is absent', () => {
    expect([...toggleId(new Set(), 'a')]).toEqual(['a'])
  })

  it('removes an id that is present', () => {
    expect([...toggleId(new Set(['a', 'b']), 'a')]).toEqual(['b'])
  })

  it('does not mutate the input set', () => {
    const src = new Set(['a'])
    toggleId(src, 'b')
    expect([...src]).toEqual(['a'])
  })
})

describe('selectAll', () => {
  it('returns a set of exactly the given ids', () => {
    expect([...selectAll(['a', 'b', 'a'])].sort()).toEqual(['a', 'b'])
  })

  it('returns an empty set for no ids', () => {
    expect(selectAll([]).size).toBe(0)
  })
})

describe('allSelected', () => {
  it('is true when every visible id is selected', () => {
    expect(allSelected(new Set(['a', 'b', 'c']), ['a', 'b'])).toBe(true)
  })

  it('is false when a visible id is missing', () => {
    expect(allSelected(new Set(['a']), ['a', 'b'])).toBe(false)
  })

  it('is false when there are no visible ids', () => {
    expect(allSelected(new Set(['a']), [])).toBe(false)
  })
})
