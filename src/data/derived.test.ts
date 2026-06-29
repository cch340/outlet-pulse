import { describe, it, expect } from 'vitest'
import { fmt } from './derived'

describe('fmt', () => {
  it('prefixes the short weekday to the date', () => {
    // 2026-06-29 is a Monday.
    expect(fmt('2026-06-29')).toBe('Mon, 29 Jun 2026')
  })
})
