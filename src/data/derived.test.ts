import { describe, it, expect } from 'vitest'
import { fmt, staffForStore, visitBaseStatus, visitStatus, visitComplete, isOverdue, visitVM } from './derived'
import type { DataSnapshot } from './queries/useData'

describe('fmt', () => {
  it('prefixes the short weekday to the date', () => {
    // 2026-06-29 is a Monday.
    expect(fmt('2026-06-29')).toBe('Mon, 29 Jun 2026')
  })
})

describe('staffForStore', () => {
  const snap = {
    staff: [
      { id: 's1', brandId: 'b1', outletId: 'o1' },
      { id: 's2', brandId: 'b1', outletId: 'o2' },
      { id: 's3', brandId: 'b2', outletId: 'o1' },
    ],
  } as unknown as DataSnapshot

  it('returns only staff posted to the given brand AND outlet', () => {
    expect(staffForStore(snap, 'b1', 'o1').map((s) => s.id)).toEqual(['s1'])
  })

  it('returns an empty list when no staff match the store', () => {
    expect(staffForStore(snap, 'b9', 'o9')).toEqual([])
  })
})

import type { Task, Visit } from './model'

const mkTasks = (...st: Task['status'][]): Task[] =>
  st.map((s, i) => ({ id: `t${i}`, label: `T${i}`, status: s, remark: '' }))

const mkVisit = (date: string, st: Task['status'][]): Visit => ({
  id: 'f1', date, staffId: null, brandId: 'b1', outletId: 'o1', tasks: mkTasks(...st),
})

const snap = {
  brands: [{ id: 'b1', name: 'Brand', color: '#000', category: '' }],
  outlets: [{ id: 'o1', name: 'Outlet', location: 'Loc' }],
  staff: [],
} as unknown as DataSnapshot

describe('visitBaseStatus', () => {
  it('is pending for an empty checklist', () => {
    expect(visitBaseStatus([])).toBe('pending')
  })
  it('is pending when any task is pending, even alongside a failure', () => {
    expect(visitBaseStatus(mkTasks('pending', 'failed', 'success'))).toBe('pending')
  })
  it('is attention when no task is pending and at least one failed', () => {
    expect(visitBaseStatus(mkTasks('failed', 'success'))).toBe('attention')
  })
  it('is done when every task is success', () => {
    expect(visitBaseStatus(mkTasks('success', 'success'))).toBe('done')
  })
})

describe('visitStatus', () => {
  it('returns pending when any task is pending', () => {
    expect(visitStatus(mkVisit('2999-01-01', ['pending', 'success']))).toBe('pending')
  })
  it('returns attention when no pending but at least one failed', () => {
    expect(visitStatus(mkVisit('2999-01-01', ['failed', 'success']))).toBe('attention')
  })
  it('returns done when all tasks are success', () => {
    expect(visitStatus(mkVisit('2999-01-01', ['success', 'success']))).toBe('done')
  })
})

describe('visitComplete', () => {
  it('is false while any task is still pending', () => {
    expect(visitComplete(mkVisit('2999-01-01', ['pending', 'success']))).toBe(false)
  })
  it('is true once every task is resolved, even with a failure', () => {
    expect(visitComplete(mkVisit('2999-01-01', ['failed', 'success']))).toBe(true)
    expect(visitComplete(mkVisit('2999-01-01', ['success', 'success']))).toBe(true)
  })
})

describe('isOverdue', () => {
  it('is true only for a pending visit dated before today', () => {
    expect(isOverdue(mkVisit('2000-01-01', ['pending']))).toBe(true)
    expect(isOverdue(mkVisit('2000-01-01', ['failed']))).toBe(false) // attention, not pending
    expect(isOverdue(mkVisit('2999-01-01', ['pending']))).toBe(false)
  })
})

describe('visitVM', () => {
  it('reports resolved counts and progress', () => {
    const vm = visitVM(snap, mkVisit('2999-01-01', ['success', 'failed', 'pending']))
    expect(vm.successT).toBe(1)
    expect(vm.failedT).toBe(1)
    expect(vm.pendingT).toBe(1)
    expect(vm.resolvedT).toBe(2)
    expect(vm.progressPct).toBe(67)
    expect(vm.status).toBe('pending')
  })
  it('maps attention status, label, and color', () => {
    const vm = visitVM(snap, mkVisit('2999-01-01', ['failed', 'success']))
    expect(vm.status).toBe('attention')
    expect(vm.statusLabel).toBe('Attention required')
    expect(vm.statusColor).toBe('#dc2626')
  })
  it('maps overdue for a late pending visit', () => {
    const vm = visitVM(snap, mkVisit('2000-01-01', ['pending']))
    expect(vm.status).toBe('overdue')
    expect(vm.statusColor).toBe('#ea580c')
  })
})
