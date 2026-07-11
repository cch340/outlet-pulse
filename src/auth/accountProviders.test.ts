import { describe, it, expect } from 'vitest'
import { hasPasswordAuth, providerNote } from './accountProviders'

describe('hasPasswordAuth', () => {
  it('is true for an email-only account', () => {
    expect(hasPasswordAuth([{ provider: 'email' }])).toBe(true)
  })

  it('is true when email is one of several providers', () => {
    expect(hasPasswordAuth([{ provider: 'google' }, { provider: 'email' }])).toBe(true)
  })

  it('is false for a google-only account', () => {
    expect(hasPasswordAuth([{ provider: 'google' }])).toBe(false)
  })

  it('is false for null / undefined / empty input', () => {
    expect(hasPasswordAuth(null)).toBe(false)
    expect(hasPasswordAuth(undefined)).toBe(false)
    expect(hasPasswordAuth([])).toBe(false)
  })
})

describe('providerNote', () => {
  it('returns null for an email-only account', () => {
    expect(providerNote([{ provider: 'email' }])).toBeNull()
  })

  it('returns null when both email and google are present', () => {
    expect(providerNote([{ provider: 'email' }, { provider: 'google' }])).toBeNull()
  })

  it('names Google for a google-only account', () => {
    expect(providerNote([{ provider: 'google' }])).toBe(
      'You signed in with Google — your password is managed by your Google account.',
    )
  })

  it('names GitHub with correct casing', () => {
    expect(providerNote([{ provider: 'github' }])).toBe(
      'You signed in with GitHub — your password is managed by your GitHub account.',
    )
  })

  it('joins multiple non-email providers generically', () => {
    expect(providerNote([{ provider: 'google' }, { provider: 'github' }])).toBe(
      'You signed in with Google/GitHub — your password is managed by your Google/GitHub account.',
    )
  })

  it('capitalizes an unknown provider generically', () => {
    expect(providerNote([{ provider: 'twitter' }])).toBe(
      'You signed in with Twitter — your password is managed by your Twitter account.',
    )
  })

  it('falls back to a generic note for null / undefined / empty input', () => {
    const fallback = 'Password sign-in is not enabled for this account.'
    expect(providerNote(null)).toBe(fallback)
    expect(providerNote(undefined)).toBe(fallback)
    expect(providerNote([])).toBe(fallback)
  })
})
