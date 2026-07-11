import { describe, it, expect } from 'vitest'
import { toHash, parseHash, DEFAULT_URL_STATE, type UrlState } from './urlState'

const mk = (o: Partial<UrlState> = {}): UrlState => ({ ...DEFAULT_URL_STATE, ...o })

describe('toHash', () => {
  it('omits every default for a plain dashboard', () => {
    expect(toHash(mk())).toBe('#/dashboard')
  })

  it('always returns at least #/<screen>', () => {
    expect(toHash(mk({ screen: 'stores' }))).toBe('#/stores')
    expect(toHash(mk({ screen: 'visits' }))).toBe('#/visits')
    expect(toHash(mk({ screen: 'manage' }))).toBe('#/manage')
  })

  it('emits visit status and q only when non-default', () => {
    expect(toHash(mk({ screen: 'visits', visitFilter: 'overdue' }))).toBe('#/visits?status=overdue')
    expect(toHash(mk({ screen: 'visits', q: 'abc' }))).toBe('#/visits?q=abc')
    expect(toHash(mk({ screen: 'visits', visitFilter: 'overdue', q: 'abc' }))).toBe(
      '#/visits?status=overdue&q=abc',
    )
    expect(toHash(mk({ screen: 'visits', visitFilter: 'all', q: '' }))).toBe('#/visits')
  })

  it('emits manage tab only when non-default', () => {
    expect(toHash(mk({ screen: 'manage', manageTab: 'staff' }))).toBe('#/manage?tab=staff')
    expect(toHash(mk({ screen: 'manage', manageTab: 'brands' }))).toBe('#/manage')
  })

  it('does not emit params that belong to another screen', () => {
    expect(toHash(mk({ screen: 'dashboard', visitFilter: 'overdue', q: 'x', manageTab: 'staff' }))).toBe(
      '#/dashboard',
    )
    expect(toHash(mk({ screen: 'manage', visitFilter: 'overdue', q: 'x', manageTab: 'staff' }))).toBe(
      '#/manage?tab=staff',
    )
  })

  it('URL-encodes q (spaces, ampersands, unicode)', () => {
    expect(toHash(mk({ screen: 'visits', q: 'a b' }))).toBe('#/visits?q=a+b')
    expect(toHash(mk({ screen: 'visits', q: 'a&b' }))).toBe('#/visits?q=a%26b')
    expect(toHash(mk({ screen: 'visits', q: 'café' }))).toBe('#/visits?q=caf%C3%A9')
  })
})

describe('parseHash', () => {
  it('round-trips every screen with its params', () => {
    const cases: UrlState[] = [
      mk({ screen: 'dashboard' }),
      mk({ screen: 'stores' }),
      mk({ screen: 'visits', visitFilter: 'overdue', q: 'samsung' }),
      mk({ screen: 'visits', visitFilter: 'done' }),
      mk({ screen: 'manage', manageTab: 'staff' }),
      mk({ screen: 'manage', manageTab: 'tasks' }),
      mk({ screen: 'manage', manageTab: 'recurring' }),
    ]
    for (const c of cases) expect(parseHash(toHash(c))).toEqual(c)
  })

  it('decodes q (spaces, ampersands, unicode)', () => {
    expect(parseHash('#/visits?q=a+b').q).toBe('a b')
    expect(parseHash('#/visits?q=a%26b').q).toBe('a&b')
    expect(parseHash('#/visits?q=caf%C3%A9').q).toBe('café')
  })

  it('accepts a hash with or without the leading #', () => {
    expect(parseHash('/visits?status=done')).toEqual(mk({ screen: 'visits', visitFilter: 'done' }))
    expect(parseHash('visits?status=done')).toEqual(mk({ screen: 'visits', visitFilter: 'done' }))
  })

  it('falls back to defaults for empty / garbage input', () => {
    expect(parseHash('')).toEqual(DEFAULT_URL_STATE)
    expect(parseHash('#')).toEqual(DEFAULT_URL_STATE)
    expect(parseHash('#/')).toEqual(DEFAULT_URL_STATE)
    expect(parseHash('#/bogus?x=1')).toEqual(DEFAULT_URL_STATE)
  })

  it('falls back to defaults for unknown status / tab values', () => {
    expect(parseHash('#/visits?status=nope')).toEqual(mk({ screen: 'visits' }))
    expect(parseHash('#/manage?tab=nope')).toEqual(mk({ screen: 'manage' }))
  })

  it('ignores params that belong to a different screen', () => {
    // q/status on manage are not honored; tab on visits is not honored.
    expect(parseHash('#/manage?q=abc&status=overdue')).toEqual(mk({ screen: 'manage' }))
    expect(parseHash('#/visits?tab=staff')).toEqual(mk({ screen: 'visits' }))
  })
})
