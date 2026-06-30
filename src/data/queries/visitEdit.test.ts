import { describe, it, expect } from 'vitest'
import { taskHasResult, importableTemplates, eligibleVisitsForLabel } from './visitEdit'
import type { Visit } from '../model'

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

describe('eligibleVisitsForLabel', () => {
  const visit = (id: string, labels: string[]): Visit => ({
    id,
    date: '2026-06-30',
    staffId: null,
    brandId: 'b',
    outletId: 'o',
    tasks: labels.map((label) => ({ label, status: 'pending', remark: '' })),
  })

  it('includes visits that do not have a task with the label', () => {
    const visits = [visit('v1', ['Restock shelves']), visit('v2', [])]
    expect(eligibleVisitsForLabel(visits, 'Clean entrance').map((v) => v.id)).toEqual(['v1', 'v2'])
  })

  it('excludes visits that already have the label', () => {
    const visits = [visit('v1', ['Clean entrance']), visit('v2', ['Restock shelves'])]
    expect(eligibleVisitsForLabel(visits, 'Clean entrance').map((v) => v.id)).toEqual(['v2'])
  })

  it('matches case-insensitively and trims whitespace on both sides', () => {
    const visits = [visit('v1', ['  clean ENTRANCE '])]
    expect(eligibleVisitsForLabel(visits, '  Clean entrance  ')).toEqual([])
  })

  it('returns an empty array for an empty visit list', () => {
    expect(eligibleVisitsForLabel([], 'Anything')).toEqual([])
  })
})
