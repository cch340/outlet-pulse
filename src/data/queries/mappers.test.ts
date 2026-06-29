import { describe, it, expect } from 'vitest'
import { rowToStaff, rowToFollowUp, rowToStore } from './mappers'

describe('rowToStore', () => {
  it('maps snake_case to camelCase', () => {
    expect(rowToStore({ brand_id: 'b', outlet_id: 'o' })).toEqual({ brandId: 'b', outletId: 'o' })
  })
})

describe('rowToStaff', () => {
  it('maps fields and orders history by created_at', () => {
    const staff = rowToStaff({
      id: 's1',
      name: 'John',
      brand_id: 'b1',
      outlet_id: 'o1',
      role: 'Supervisor',
      joined: '2023-03-01',
      staff_history: [
        { id: 'h2', staff_id: 's1', brand_id: 'b1', outlet_id: 'o2', from_label: 'Feb 2025', to_label: null, reason: null, created_at: '2025-02-01T00:00:00Z' },
        { id: 'h1', staff_id: 's1', brand_id: 'b1', outlet_id: 'o1', from_label: 'Mar 2023', to_label: 'Feb 2025', reason: 'x', created_at: '2023-03-01T00:00:00Z' },
      ],
    })
    expect(staff.id).toBe('s1')
    expect(staff.brandId).toBe('b1')
    expect(staff.history.map((h) => h.from)).toEqual(['Mar 2023', 'Feb 2025'])
    expect(staff.history[0].to).toBe('Feb 2025')
    expect(staff.history[1].to).toBeUndefined()
  })
})

describe('rowToFollowUp', () => {
  it('maps fields and orders tasks by sort', () => {
    const fu = rowToFollowUp({
      id: 'f1',
      date: '2026-06-25',
      staff_id: null,
      brand_id: 'b1',
      outlet_id: 'o1',
      status: 'pending',
      follow_up_tasks: [
        { id: 't2', follow_up_id: 'f1', label: 'B', done: true, sort: 1 },
        { id: 't1', follow_up_id: 'f1', label: 'A', done: false, sort: 0 },
      ],
    })
    expect(fu.staffId).toBeNull()
    expect(fu.tasks.map((t) => t.label)).toEqual(['A', 'B'])
    expect(fu.tasks[0].id).toBe('t1')
  })
})
