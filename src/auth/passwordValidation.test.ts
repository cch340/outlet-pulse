import { describe, expect, it } from 'vitest'
import { MIN_PASSWORD_LENGTH, validateNewPassword } from './passwordValidation'

describe('validateNewPassword', () => {
  it('rejects a password shorter than the minimum length', () => {
    const err = validateNewPassword('short', 'short')
    expect(err).toBe(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  })

  it('rejects a password exactly one char below the minimum', () => {
    const pw = 'a'.repeat(MIN_PASSWORD_LENGTH - 1)
    expect(validateNewPassword(pw, pw)).toMatch(/at least/)
  })

  it('rejects when the confirmation does not match', () => {
    const err = validateNewPassword('longenough1', 'longenough2')
    expect(err).toBe('Passwords do not match.')
  })

  it('checks length before mismatch (too-short mismatched pair reports length)', () => {
    const err = validateNewPassword('abc', 'xyz')
    expect(err).toMatch(/at least/)
  })

  it('accepts a valid matching password at the minimum length', () => {
    const pw = 'a'.repeat(MIN_PASSWORD_LENGTH)
    expect(validateNewPassword(pw, pw)).toBeNull()
  })

  it('accepts a valid matching password above the minimum length', () => {
    expect(validateNewPassword('supersecret123', 'supersecret123')).toBeNull()
  })
})
