import { describe, it, expect } from 'vitest'
import { taskHasResult, importableTemplates } from './visitEdit'

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

describe('importableTemplates', () => {
  const tpl = (id: string, label: string) => ({ id, label })

  it('returns all templates when the checklist is empty', () => {
    const templates = [tpl('t1', 'Stock'), tpl('t2', 'Cleanliness')]
    expect(importableTemplates(templates, [])).toEqual(templates)
  })

  it('returns an empty array when there are no templates', () => {
    expect(importableTemplates([], [{ label: 'Stock' }])).toEqual([])
  })

  it('excludes a template whose label exactly matches a task', () => {
    const templates = [tpl('t1', 'Stock'), tpl('t2', 'Cleanliness')]
    expect(importableTemplates(templates, [{ label: 'Stock' }])).toEqual([tpl('t2', 'Cleanliness')])
  })

  it('excludes a template that differs only by case or surrounding whitespace', () => {
    const templates = [tpl('t1', 'Stock Check'), tpl('t2', 'Cleanliness')]
    const tasks = [{ label: '  stock check ' }]
    expect(importableTemplates(templates, tasks)).toEqual([tpl('t2', 'Cleanliness')])
  })

  it('preserves input order of the surviving templates', () => {
    const templates = [tpl('t1', 'A'), tpl('t2', 'B'), tpl('t3', 'C')]
    expect(importableTemplates(templates, [{ label: 'B' }])).toEqual([tpl('t1', 'A'), tpl('t3', 'C')])
  })
})
