import { describe, it, expect } from 'vitest'
import { nextTaskSort, taskHasResult } from './visitEdit'

describe('nextTaskSort', () => {
  it('returns 0 for an empty checklist', () => {
    expect(nextTaskSort([])).toBe(0)
  })
  it('returns the count of existing tasks (next append position)', () => {
    expect(nextTaskSort([{}, {}, {}])).toBe(3)
  })
})

describe('taskHasResult', () => {
  it('is false for a pending task with an empty remark', () => {
    expect(taskHasResult({ status: 'pending', remark: '' })).toBe(false)
  })
  it('is false for a pending task whose remark is only whitespace', () => {
    expect(taskHasResult({ status: 'pending', remark: '   ' })).toBe(false)
  })
  it('is true when the status is not pending', () => {
    expect(taskHasResult({ status: 'success', remark: '' })).toBe(true)
    expect(taskHasResult({ status: 'failed', remark: '' })).toBe(true)
  })
  it('is true when a pending task has a non-empty remark', () => {
    expect(taskHasResult({ status: 'pending', remark: 'left a note' })).toBe(true)
  })
})
