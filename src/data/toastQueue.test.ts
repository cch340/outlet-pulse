import { describe, it, expect } from 'vitest'
import { addToast, removeToast, MAX_TOASTS, type Toast } from './toastQueue'

const t = (id: number): Toast => ({ id, variant: 'success', message: `m${id}` })

describe('addToast', () => {
  it('appends to the end of the stack', () => {
    expect(addToast([t(1)], t(2)).map((x) => x.id)).toEqual([1, 2])
  })

  it('caps the stack at max, dropping the oldest', () => {
    const full = [t(1), t(2), t(3)]
    expect(addToast(full, t(4), 3).map((x) => x.id)).toEqual([2, 3, 4])
  })

  it('defaults the cap to MAX_TOASTS', () => {
    const list = Array.from({ length: MAX_TOASTS }, (_, i) => t(i + 1))
    const out = addToast(list, t(99))
    expect(out).toHaveLength(MAX_TOASTS)
    expect(out[out.length - 1].id).toBe(99)
  })

  it('does not mutate the input list', () => {
    const list = [t(1)]
    addToast(list, t(2))
    expect(list).toEqual([t(1)])
  })
})

describe('removeToast', () => {
  it('removes the matching id', () => {
    expect(removeToast([t(1), t(2)], 1).map((x) => x.id)).toEqual([2])
  })

  it('is a no-op when the id is absent', () => {
    expect(removeToast([t(1)], 9).map((x) => x.id)).toEqual([1])
  })
})
