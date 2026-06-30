import { describe, it, expect } from 'vitest'
import { isOpen, toggle, setAll, allOpen, parseState } from './cardCollapse'

describe('cardCollapse', () => {
  it('treats an absent id as collapsed by default', () => {
    expect(isOpen({}, 'a')).toBe(false)
    expect(isOpen({ a: true }, 'a')).toBe(true)
    expect(isOpen({ a: false }, 'a')).toBe(false)
  })

  it('toggle flips a key and defaults absent keys to open', () => {
    expect(toggle({}, 'a')).toEqual({ a: true })
    expect(toggle({ a: true }, 'a')).toEqual({ a: false })
    expect(toggle({ a: false }, 'a')).toEqual({ a: true })
  })

  it('toggle does not mutate the input', () => {
    const s = { a: true }
    const next = toggle(s, 'a')
    expect(s).toEqual({ a: true })
    expect(next).toEqual({ a: false })
  })

  it('setAll maps every id to the given open value', () => {
    expect(setAll(['a', 'b'], true)).toEqual({ a: true, b: true })
    expect(setAll(['a', 'b'], false)).toEqual({ a: false, b: false })
  })

  it('allOpen is true only when every id is open', () => {
    expect(allOpen({ a: true, b: true }, ['a', 'b'])).toBe(true)
    expect(allOpen({ a: true, b: false }, ['a', 'b'])).toBe(false)
    expect(allOpen({ a: true }, ['a', 'b'])).toBe(false)
    expect(allOpen({}, [])).toBe(true)
  })

  it('parseState returns {} for null or invalid JSON, and the object otherwise', () => {
    expect(parseState(null)).toEqual({})
    expect(parseState('not json')).toEqual({})
    expect(parseState('{"a":true}')).toEqual({ a: true })
    expect(parseState('[1,2]')).toEqual({})
  })
})
