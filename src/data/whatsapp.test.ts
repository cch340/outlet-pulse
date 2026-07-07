import { describe, it, expect } from 'vitest'
import { toWaDigits, waUrl, isValidPhone } from './whatsapp'

describe('toWaDigits', () => {
  it('strips symbols and converts a leading 0 to 60 (Malaysia)', () => {
    expect(toWaDigits('012-345 6789')).toBe('60123456789')
  })
  it('strips a leading + and spaces, keeping the country code', () => {
    expect(toWaDigits('+60 12 345 6789')).toBe('60123456789')
  })
  it('leaves an already-normalized 60 number unchanged', () => {
    expect(toWaDigits('60123456789')).toBe('60123456789')
  })
  it('returns empty string when there are no digits', () => {
    expect(toWaDigits('  ')).toBe('')
    expect(toWaDigits('abc')).toBe('')
  })
})

describe('waUrl', () => {
  it('builds a wa.me url from normalized digits', () => {
    expect(waUrl('012-345 6789')).toBe('https://wa.me/60123456789')
  })
  it('returns null when there are no digits', () => {
    expect(waUrl('')).toBeNull()
  })
})

describe('isValidPhone', () => {
  it('treats empty/whitespace as valid (optional field)', () => {
    expect(isValidPhone('')).toBe(true)
    expect(isValidPhone('   ')).toBe(true)
  })
  it('rejects too-short numbers', () => {
    expect(isValidPhone('123')).toBe(false)
  })
  it('accepts a normal MY mobile number', () => {
    expect(isValidPhone('012-345 6789')).toBe(true)
  })
  it('rejects numbers longer than 15 digits (E.164 max)', () => {
    expect(isValidPhone('1234567890123456')).toBe(false)
  })
})
