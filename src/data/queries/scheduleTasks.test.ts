import { describe, it, expect } from 'vitest'
import { itemsFromTemplates, planSchedule, type ScheduleTaskItem } from './scheduleTasks'

describe('itemsFromTemplates', () => {
  it('maps every template to a checked item keyed by template id', () => {
    const items = itemsFromTemplates([
      { id: 't1', label: 'Stock' },
      { id: 't2', label: 'Cleanliness' },
    ])
    expect(items).toEqual([
      { key: 't1', label: 'Stock', checked: true, templateId: 't1' },
      { key: 't2', label: 'Cleanliness', checked: true, templateId: 't2' },
    ])
  })
})

describe('planSchedule', () => {
  const mk = (p: Partial<ScheduleTaskItem>): ScheduleTaskItem => ({
    key: 'k', label: 'L', checked: true, ...p,
  })

  it('returns all checked labels as visit tasks', () => {
    const plan = planSchedule(
      [mk({ key: 'a', label: 'A' }), mk({ key: 'b', label: 'B' })],
      [],
    )
    expect(plan.taskLabels).toEqual(['A', 'B'])
    expect(plan.newTemplateLabels).toEqual([])
  })

  it('excludes unchecked items from visit tasks', () => {
    const plan = planSchedule(
      [mk({ key: 'a', label: 'A', checked: false }), mk({ key: 'b', label: 'B' })],
      [],
    )
    expect(plan.taskLabels).toEqual(['B'])
  })

  it('a one-time task (no saveAsTemplate) is a visit task only', () => {
    const plan = planSchedule([mk({ key: 'a', label: 'Spot check' })], [])
    expect(plan.taskLabels).toEqual(['Spot check'])
    expect(plan.newTemplateLabels).toEqual([])
  })

  it('saveAsTemplate on a new label adds it to newTemplateLabels', () => {
    const plan = planSchedule([mk({ key: 'a', label: 'New check', saveAsTemplate: true })], [])
    expect(plan.newTemplateLabels).toEqual(['New check'])
  })

  it('does not re-save a label that already exists as a template (case-insensitive)', () => {
    const plan = planSchedule(
      [mk({ key: 'a', label: 'stock', saveAsTemplate: true })],
      [{ label: 'Stock' }],
    )
    expect(plan.newTemplateLabels).toEqual([])
  })

  it('does not re-save an item that came from a template', () => {
    const plan = planSchedule(
      [mk({ key: 't1', label: 'Stock', templateId: 't1', saveAsTemplate: true })],
      [],
    )
    expect(plan.newTemplateLabels).toEqual([])
  })

  it('saves a template even when the item is unchecked for this visit', () => {
    const plan = planSchedule(
      [mk({ key: 'a', label: 'Future check', checked: false, saveAsTemplate: true })],
      [],
    )
    expect(plan.taskLabels).toEqual([])
    expect(plan.newTemplateLabels).toEqual(['Future check'])
  })

  it('ignores empty/whitespace labels in both outputs', () => {
    const plan = planSchedule([mk({ key: 'a', label: '   ', saveAsTemplate: true })], [])
    expect(plan.taskLabels).toEqual([])
    expect(plan.newTemplateLabels).toEqual([])
  })

  it('de-dupes duplicate new template labels within the same submit', () => {
    const plan = planSchedule(
      [
        mk({ key: 'a', label: 'Audit', saveAsTemplate: true }),
        mk({ key: 'b', label: 'audit', saveAsTemplate: true }),
      ],
      [],
    )
    expect(plan.newTemplateLabels).toEqual(['Audit'])
  })
})
