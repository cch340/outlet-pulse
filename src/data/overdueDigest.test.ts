import { describe, expect, it } from 'vitest'
import { digestMessage } from './overdueDigest'

describe('digestMessage', () => {
  it('returns null when nothing is overdue', () => {
    expect(digestMessage(0)).toBeNull()
    expect(digestMessage(-3)).toBeNull()
  })

  it('uses the singular noun for one overdue visit', () => {
    expect(digestMessage(1)).toBe('You have 1 overdue visit — check the Visits tab.')
  })

  it('uses the plural noun for multiple overdue visits', () => {
    expect(digestMessage(5)).toBe('You have 5 overdue visits — check the Visits tab.')
  })
})
