import { describe, it, expect } from 'vitest'
import { computeStaffStats } from './staffStats'
import type { Task, Visit } from './model'

const mkTasks = (...st: Task['status'][]): Task[] =>
  st.map((s, i) => ({ id: `t${i}`, label: `T${i}`, status: s, remark: '' }))

let seq = 0
const mkVisit = (date: string, st: Task['status'][]): Visit => ({
  id: `v${seq++}`,
  date,
  staffId: 's1',
  brandId: 'b1',
  outletId: 'o1',
  tasks: mkTasks(...st),
})

describe('computeStaffStats', () => {
  it('returns zeroed stats for no visits', () => {
    const s = computeStaffStats([], '2026-07-11')
    expect(s.totalVisits).toBe(0)
    expect(s.doneCount).toBe(0)
    expect(s.attentionCount).toBe(0)
    expect(s.pendingCount).toBe(0)
    expect(s.overdueCount).toBe(0)
    expect(s.completionRate).toBe(0)
    expect(s.taskSuccessRate).toBeNull()
    expect(s.failedTaskCount).toBe(0)
    expect(s.lastVisitDate).toBeNull()
    expect(s.monthly).toHaveLength(6)
    expect(s.monthly.every((m) => m.total === 0 && m.done === 0)).toBe(true)
  })

  it('classifies mixed statuses and computes rates', () => {
    const visits = [
      mkVisit('2026-07-01', ['success', 'success']), // done
      mkVisit('2026-07-02', ['success', 'failed']), // attention
      mkVisit('2026-07-03', ['success', 'pending']), // pending (not overdue: today)
    ]
    const s = computeStaffStats(visits, '2026-07-03')
    expect(s.totalVisits).toBe(3)
    expect(s.doneCount).toBe(1)
    expect(s.attentionCount).toBe(1)
    expect(s.pendingCount).toBe(1)
    // (done + attention) / total
    expect(s.completionRate).toBeCloseTo(2 / 3)
    // success=4, failed=1 → 4/5
    expect(s.taskSuccessRate).toBeCloseTo(4 / 5)
    expect(s.failedTaskCount).toBe(1)
    expect(s.lastVisitDate).toBe('2026-07-03')
  })

  it('flags pending visits before today as overdue, but not future/today pending', () => {
    const visits = [
      mkVisit('2026-07-01', ['pending']), // overdue
      mkVisit('2026-07-11', ['pending']), // today → not overdue
      mkVisit('2026-07-20', ['pending']), // future → not overdue
      mkVisit('2026-07-05', ['success']), // done, ignored by overdue
    ]
    const s = computeStaffStats(visits, '2026-07-11')
    expect(s.pendingCount).toBe(3)
    expect(s.overdueCount).toBe(1)
  })

  it('returns null taskSuccessRate when no tasks are resolved', () => {
    const visits = [mkVisit('2026-07-01', ['pending', 'pending']), mkVisit('2026-07-02', [])]
    const s = computeStaffStats(visits, '2026-07-11')
    expect(s.taskSuccessRate).toBeNull()
    expect(s.failedTaskCount).toBe(0)
  })

  it('treats an all-success visit as full task success rate', () => {
    const s = computeStaffStats([mkVisit('2026-07-01', ['success', 'success'])], '2026-07-11')
    expect(s.taskSuccessRate).toBe(1)
  })

  it('buckets the last six months oldest→newest with zero-fill', () => {
    const visits = [
      mkVisit('2026-07-01', ['success']), // Jul done
      mkVisit('2026-07-05', ['pending']), // Jul not done
      mkVisit('2026-05-10', ['success', 'failed']), // May attention → done
      mkVisit('2026-02-01', ['success']), // Feb — outside 6-month window (Feb..Jul incl.? no)
    ]
    const s = computeStaffStats(visits, '2026-07-11')
    expect(s.monthly.map((m) => m.ym)).toEqual([
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
    ])
    expect(s.monthly.map((m) => m.label)).toEqual(['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'])
    const jul = s.monthly[5]
    expect(jul).toMatchObject({ total: 2, done: 1 })
    const may = s.monthly[3]
    expect(may).toMatchObject({ total: 1, done: 1 })
    const feb = s.monthly[0]
    expect(feb).toMatchObject({ total: 1, done: 1 })
    // months with no visits are present and zeroed
    expect(s.monthly[1]).toMatchObject({ ym: '2026-03', total: 0, done: 0 })
  })

  it('spans a year boundary (today Jan 2027 → Aug 2026 .. Jan 2027)', () => {
    const visits = [
      mkVisit('2026-08-15', ['success']),
      mkVisit('2027-01-02', ['failed', 'success']), // attention → done
    ]
    const s = computeStaffStats(visits, '2027-01-20')
    expect(s.monthly.map((m) => m.ym)).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
    ])
    expect(s.monthly[0]).toMatchObject({ label: 'Aug', total: 1, done: 1 })
    expect(s.monthly[5]).toMatchObject({ label: 'Jan', total: 1, done: 1 })
  })

  it('ignores visits outside the 6-month window in monthly buckets', () => {
    const s = computeStaffStats([mkVisit('2026-01-01', ['success'])], '2026-07-11')
    // Jan 2026 is not in Feb..Jul; every bucket stays zero
    expect(s.monthly.every((m) => m.total === 0)).toBe(true)
    // but it still counts toward the overall totals
    expect(s.totalVisits).toBe(1)
    expect(s.doneCount).toBe(1)
  })
})
