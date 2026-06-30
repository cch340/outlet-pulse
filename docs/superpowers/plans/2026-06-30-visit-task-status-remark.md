# Visit Task Status + Remark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each checklist task a 3-state status (pending/failed/success) and a free-text remark, and derive the visit's status (pending / attention required / done) from its tasks instead of a stored column.

**Architecture:** Approach A from the spec — visit status is a pure function of its tasks, computed client-side in `derived.ts` (the `visits.status` DB column is left in place but ignored). The migration only touches `visit_tasks` (add `status`, add `remark`, drop `done`). Logic lives in pure, unit-tested modules; React components are verified by the type-checking build.

**Tech Stack:** React 18 + TypeScript + Vite, Supabase (Postgres), React Query, Vitest. All styling is inline `style={}` objects driven by CSS variables.

## Global Constraints

- The build fails on unused locals/params (`tsconfig` has `noUnusedLocals`/`noUnusedParameters`) — remove every import/variable you stop using.
- Tests run in the `node` environment and only match `src/**/*.test.ts`. There are no component/DOM tests; React components are validated only by `npm run build` (`tsc -b`).
- DB rows are snake_case; the domain model is camelCase. Always convert through `mappers.ts`.
- Task status values, exact strings: `'pending' | 'failed' | 'success'`. Visit derived status: `'pending' | 'attention' | 'overdue' | 'done'`.
- Colors (verbatim): success `#16a34a`, failed/attention `#dc2626`, pending(visit) `#d97706`, overdue `#ea580c`.
- Commit message author footer line: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## Build cadence (read before starting)

Changing the core `Task`/`Visit` types in Task 2 deliberately breaks every UI file that still reads the old shape; the project will **not** pass `npm run build` again until Task 8. That is expected. The per-task gate for the **data-layer tasks (1–4)** is the targeted **Vitest** run shown in each task (Vitest compiles per-file and ignores cross-file type errors). The **UI tasks (5–8)** have no unit tests; their changes are validated together by the full `npm run build` in **Task 9**. Do not "fix" unrelated files early to chase a green build before Task 9 — follow the task order.

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/0006_task_status_remark.sql`

**Interfaces:**
- Produces: the `visit_tasks.status` (`text`, check `pending|failed|success`) and `visit_tasks.remark` (`text not null default ''`) columns; drops `visit_tasks.done`. No code depends on this at compile/test time — it is applied manually in the Supabase SQL editor before running the app.

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/0006_task_status_remark.sql`:

```sql
-- 0006_task_status_remark.sql
-- Per-task 3-state status + free-text remark, replacing the done boolean.
-- Visit status is now derived from its tasks (app-side); the visits.status
-- column is left untouched at its 'pending' default and ignored.
-- Apply AFTER 0005_task_templates.sql in the Supabase SQL editor.

alter table visit_tasks
  add column status text not null default 'pending'
  check (status in ('pending','failed','success'));

update visit_tasks set status = case when done then 'success' else 'pending' end;

alter table visit_tasks add column remark text not null default '';

alter table visit_tasks drop column done;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0006_task_status_remark.sql
git commit -m "feat: migration for visit_tasks status + remark

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> Note for the operator: apply this migration in the Supabase SQL editor before `npm run dev`. It is not required for `npm test` or `npm run build`.

---

### Task 2: Domain model + mappers

**Files:**
- Modify: `src/data/model.ts`
- Modify: `src/data/queries/mappers.ts`
- Test: `src/data/queries/mappers.test.ts`

**Interfaces:**
- Produces:
  - `TaskStatus = 'pending' | 'failed' | 'success'`
  - `Task = { id?: string; label: string; status: TaskStatus; remark: string }`
  - `Visit = { id; date; staffId; brandId; outletId; tasks: Task[] }` (no `status` field)
  - `TaskRow = { id; visit_id; label; status: TaskStatus; remark: string; sort: number }`
  - `rowToVisit(r)` no longer reads/sets a visit status
- Consumes: nothing from earlier tasks.

- [ ] **Step 1: Rewrite the mappers test for the new task shape**

Replace the `rowToVisit` block in `src/data/queries/mappers.test.ts` (lines 32–50) with:

```ts
describe('rowToVisit', () => {
  it('maps fields and orders tasks by sort, carrying status + remark', () => {
    const v = rowToVisit({
      id: 'f1',
      date: '2026-06-25',
      staff_id: null,
      brand_id: 'b1',
      outlet_id: 'o1',
      visit_tasks: [
        { id: 't2', visit_id: 'f1', label: 'B', status: 'success', remark: '', sort: 1 },
        { id: 't1', visit_id: 'f1', label: 'A', status: 'pending', remark: 'note', sort: 0 },
      ],
    })
    expect(v.staffId).toBeNull()
    expect(v.tasks.map((t) => t.label)).toEqual(['A', 'B'])
    expect(v.tasks[0]).toEqual({ id: 't1', label: 'A', status: 'pending', remark: 'note' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/data/queries/mappers.test.ts`
Expected: FAIL — the `visit_tasks` object literals error on unknown `status`/`remark` (and missing `done`), or the `toEqual` mismatches.

- [ ] **Step 3: Update the domain model**

In `src/data/model.ts`, replace the `Task`/`VisitStatus`/`Visit` block (lines 41–57) with:

```ts
export type TaskStatus = 'pending' | 'failed' | 'success'

export interface Task {
  id?: string // present once persisted; absent for default checklist templates
  label: string
  status: TaskStatus
  remark: string // '' when empty
}

export interface Visit {
  id: string
  date: string // ISO date
  staffId: string | null
  brandId: string
  outletId: string
  tasks: Task[]
}
```

- [ ] **Step 4: Update the mappers**

In `src/data/queries/mappers.ts`:

Change the import on line 1 to add `TaskStatus`:

```ts
import type { Visit, HistoryEntry, Staff, Store, Task, TaskTemplate, TaskStatus } from '../model'
```

Replace `TaskRow` (lines 24–30) with:

```ts
export interface TaskRow {
  id: string
  visit_id: string
  label: string
  status: TaskStatus
  remark: string
  sort: number
}
```

Replace `VisitRow` (lines 32–40) with (drop the `status` field):

```ts
export interface VisitRow {
  id: string
  date: string
  staff_id: string | null
  brand_id: string
  outlet_id: string
  visit_tasks: TaskRow[]
}
```

Replace `rowToTask` (line 79) with:

```ts
const rowToTask = (r: TaskRow): Task => ({ id: r.id, label: r.label, status: r.status, remark: r.remark })
```

Replace `rowToVisit` (lines 81–89) with (drop the `status` line):

```ts
export const rowToVisit = (r: VisitRow): Visit => ({
  id: r.id,
  date: r.date,
  staffId: r.staff_id,
  brandId: r.brand_id,
  outletId: r.outlet_id,
  tasks: [...r.visit_tasks].sort((a, b) => a.sort - b.sort).map(rowToTask),
})
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/data/queries/mappers.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/data/model.ts src/data/queries/mappers.ts src/data/queries/mappers.test.ts
git commit -m "feat: task status+remark in model and mappers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Derived status logic

**Files:**
- Modify: `src/data/derived.ts`
- Test: `src/data/derived.test.ts`

**Interfaces:**
- Consumes: `Task`, `Visit`, `TaskStatus` from `model.ts` (Task 2).
- Produces:
  - `VisitBaseStatus = 'pending' | 'attention' | 'done'`
  - `visitBaseStatus(tasks: Task[]): VisitBaseStatus`
  - `visitStatus(f: Visit): VisitBaseStatus`
  - `isOverdue(f: Visit): boolean` (now derived from tasks)
  - `DerivedStatus = 'done' | 'pending' | 'overdue' | 'attention'`
  - `STATUS_COLOR`, `STATUS_LABEL` (`Record<DerivedStatus, string>`)
  - `VisitVM` now has `successT`, `failedT`, `pendingT`, `resolvedT`, `total`, `progressPct` (no `doneT`)

- [ ] **Step 1: Add the failing tests**

Append to `src/data/derived.test.ts` (and extend the imports on line 2):

Change line 2 to:

```ts
import { fmt, staffForStore, visitBaseStatus, visitStatus, isOverdue, visitVM } from './derived'
```

Append at the end of the file:

```ts
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
```

> Note: `DataSnapshot` is already imported at the top of the existing test file (line 3). Do not add a second import.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/data/derived.test.ts`
Expected: FAIL — `visitBaseStatus`/`visitStatus` not exported; `vm.successT`/`resolvedT` undefined.

- [ ] **Step 3: Update `derived.ts`**

In `src/data/derived.ts`:

Change the import on line 2 to add `Task`:

```ts
import type { Brand, Visit, Outlet, Staff, Task } from './model'
```

Replace `isOverdue` (line 29) with the base-status helpers:

```ts
export type VisitBaseStatus = 'pending' | 'attention' | 'done'

export function visitBaseStatus(tasks: Task[]): VisitBaseStatus {
  if (tasks.length === 0) return 'pending'
  if (tasks.some((t) => t.status === 'pending')) return 'pending'
  if (tasks.some((t) => t.status === 'failed')) return 'attention'
  return 'done'
}

export const visitStatus = (f: Visit): VisitBaseStatus => visitBaseStatus(f.tasks)

export const isOverdue = (f: Visit) =>
  visitStatus(f) === 'pending' && new Date(f.date + 'T00:00:00') < today()
```

Replace the `DerivedStatus`/`STATUS_COLOR` block (lines 50–56) with:

```ts
export type DerivedStatus = 'done' | 'pending' | 'overdue' | 'attention'

export const STATUS_COLOR: Record<DerivedStatus, string> = {
  done: '#16a34a',
  pending: '#d97706',
  overdue: '#ea580c',
  attention: '#dc2626',
}

export const STATUS_LABEL: Record<DerivedStatus, string> = {
  done: 'Done',
  pending: 'Pending',
  overdue: 'Overdue',
  attention: 'Attention required',
}
```

Replace the `doneT: number` line in the `VisitVM` interface (line 73) with:

```ts
  successT: number
  failedT: number
  pendingT: number
  resolvedT: number
```

Replace the `visitVM` function body (lines 78–105) with:

```ts
export function visitVM(s: DataSnapshot, f: Visit): VisitVM {
  const b = brandById(s, f.brandId)
  const o = outletById(s, f.outletId)
  const st = f.staffId ? staffById(s, f.staffId) : null
  const base = visitStatus(f)
  const od = isOverdue(f)
  const status: DerivedStatus =
    base === 'done' ? 'done' : base === 'attention' ? 'attention' : od ? 'overdue' : 'pending'
  const total = f.tasks.length
  const successT = f.tasks.filter((x) => x.status === 'success').length
  const failedT = f.tasks.filter((x) => x.status === 'failed').length
  const pendingT = f.tasks.filter((x) => x.status === 'pending').length
  const resolvedT = successT + failedT
  return {
    id: f.id,
    brandName: b.name,
    brandColor: b.color,
    outletName: o.name,
    location: o.location,
    staffName: st ? st.name : 'Unassigned',
    staffInitials: st ? initials(st.name) : '–',
    title: `${b.name} · ${o.name}`,
    sub: `${st ? st.name : 'Unassigned'} · ${total} checks`,
    dateLabel: fmt(f.date),
    status,
    statusLabel: STATUS_LABEL[status],
    statusColor: STATUS_COLOR[status],
    total,
    successT,
    failedT,
    pendingT,
    resolvedT,
    progressPct: total ? Math.round((resolvedT / total) * 100) : 0,
    isOverdue: od,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/data/derived.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/derived.ts src/data/derived.test.ts
git commit -m "feat: derive visit status from task statuses

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Visit mutations

**Files:**
- Modify (full rewrite): `src/data/queries/useVisitMutations.ts`

**Interfaces:**
- Consumes: `TaskStatus` from `model.ts` (Task 2).
- Produces (hooks):
  - `useCreateVisit()` — `mutate({ brandId, outletId, staffId, date, taskLabels })`; throws if `taskLabels` is empty; inserts tasks with `status:'pending'`; no longer writes `visits.status`.
  - `useSetTaskStatus()` — `mutate({ taskId: string, status: TaskStatus })`
  - `useSetTaskRemark()` — `mutate({ taskId: string, remark: string })`
  - `useMarkAllSuccess()` — `mutate({ visitId: string })`; sets only `status='pending'` tasks to `'success'`
  - (removed) `useToggleTask`, `useMarkVisitDone`, `useToggleVisitStatus`

- [ ] **Step 1: Rewrite the mutations file**

Replace the entire contents of `src/data/queries/useVisitMutations.ts` with:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'
import type { TaskStatus } from '../model'

export function useCreateVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      brandId: string
      outletId: string
      staffId: string | null
      date: string
      taskLabels: string[]
    }) => {
      if (!input.taskLabels.length) throw new Error('A visit needs at least one task')
      const { data: v, error } = await supabase
        .from('visits')
        .insert({
          brand_id: input.brandId,
          outlet_id: input.outletId,
          staff_id: input.staffId,
          date: input.date,
        })
        .select('id')
        .single()
      if (error) throw error
      const rows = input.taskLabels.map((label, i) => ({
        visit_id: v.id,
        label,
        status: 'pending',
        sort: i,
      }))
      const { error: tErr } = await supabase.from('visit_tasks').insert(rows)
      if (tErr) throw tErr
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}

export function useSetTaskStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { taskId: string; status: TaskStatus }) => {
      const { error } = await supabase
        .from('visit_tasks')
        .update({ status: input.status })
        .eq('id', input.taskId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}

export function useSetTaskRemark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { taskId: string; remark: string }) => {
      const { error } = await supabase
        .from('visit_tasks')
        .update({ remark: input.remark })
        .eq('id', input.taskId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}

export function useMarkAllSuccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { visitId: string }) => {
      const { error } = await supabase
        .from('visit_tasks')
        .update({ status: 'success' })
        .eq('visit_id', input.visitId)
        .eq('status', 'pending')
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}
```

- [ ] **Step 2: Verify the data-layer tests still pass**

Run: `npm test`
Expected: PASS for all `src/**/*.test.ts` (mappers, derived, scheduleTasks, transferLogic). `npm run build` is intentionally still broken (UI files updated in Tasks 5–8) — do not run it yet.

- [ ] **Step 3: Commit**

```bash
git add src/data/queries/useVisitMutations.ts
git commit -m "feat: task status/remark + mark-all-success mutations

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Visit drawer — segmented control, remark, mark-all-success

**Files:**
- Modify: `src/components/VisitDrawer.tsx`

**Interfaces:**
- Consumes: `useSetTaskStatus`, `useSetTaskRemark`, `useMarkAllSuccess` (Task 4); `visitVM` with `resolvedT`/`total` (Task 3); `TaskStatus` (Task 2).

- [ ] **Step 1: Replace the imports and hook wiring**

In `src/components/VisitDrawer.tsx`, replace lines 1–12 with:

```tsx
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { visitVM } from '../data/derived'
import { pill } from '../theme'
import { Icon } from './Icon'
import type { TaskStatus } from '../data/model'
import { useSetTaskStatus, useSetTaskRemark, useMarkAllSuccess } from '../data/queries/useVisitMutations'

const SEGMENTS: { value: TaskStatus; color: string; glyph: string; title: string }[] = [
  { value: 'pending', color: '#6b7280', glyph: '–', title: 'Pending' },
  { value: 'failed', color: '#dc2626', glyph: '✕', title: 'Failed' },
  { value: 'success', color: '#16a34a', glyph: '✓', title: 'Success' },
]

export function VisitDrawer() {
  const { state, closeVisit } = useStore()
  const setStatus = useSetTaskStatus()
  const setRemark = useSetTaskRemark()
  const markAll = useMarkAllSuccess()
  const { data } = useData()
```

- [ ] **Step 2: Update the checklist count label**

Replace the count line (originally lines 61–63) — the `<div style={{ fontFamily: "'IBM Plex Mono'" ... }}>` showing `{vm.doneT}/{vm.total} complete` — with:

```tsx
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: 'var(--dim)' }}>
              {vm.resolvedT}/{vm.total} resolved
            </div>
```

- [ ] **Step 3: Replace the task list with stacked status cards + remark**

Replace the checklist list container (originally lines 65–109, the `<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>` that maps `openF.tasks`) with:

```tsx
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {openF.tasks.map((t) => (
              <div
                key={t.id}
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  borderRadius: 9,
                  padding: '11px 13px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 9,
                }}
              >
                <div style={{ fontSize: 13.5, color: 'var(--text)' }}>{t.label}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {SEGMENTS.map((seg) => {
                    const active = t.status === seg.value
                    return (
                      <button
                        key={seg.value}
                        title={seg.title}
                        onClick={() =>
                          setStatus.mutate(
                            { taskId: t.id!, status: seg.value },
                            { onError: (e) => alert(e.message) },
                          )
                        }
                        style={{
                          flex: 1,
                          padding: '7px 0',
                          borderRadius: 7,
                          border: `1px solid ${active ? seg.color : 'var(--border)'}`,
                          background: active ? seg.color : 'transparent',
                          color: active ? '#fff' : 'var(--dim)',
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {seg.glyph}
                      </button>
                    )
                  })}
                </div>
                <input
                  defaultValue={t.remark}
                  placeholder="Add a remark…"
                  onBlur={(e) => {
                    const next = e.target.value
                    if (next !== t.remark)
                      setRemark.mutate(
                        { taskId: t.id!, remark: next },
                        { onError: (err) => alert(err.message) },
                      )
                  }}
                  style={{
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    borderRadius: 7,
                    padding: '8px 10px',
                    fontFamily: "'IBM Plex Sans'",
                    fontSize: 12.5,
                    color: 'var(--text)',
                  }}
                />
              </div>
            ))}
          </div>
```

- [ ] **Step 4: Replace the footer with a single "Mark all success" button**

Replace the footer block (originally lines 112–156, the `{/* footer */}` `<div>` with the `openF.status === 'done' ? ... : ...` conditional) with:

```tsx
        {/* footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <button
            onClick={() =>
              markAll.mutate({ visitId: openF.id }, { onSuccess: () => closeVisit(), onError: (e) => alert(e.message) })
            }
            style={{
              flex: 1,
              border: 'none',
              background: '#16a34a',
              color: '#fff',
              borderRadius: 9,
              padding: 12,
              fontFamily: "'IBM Plex Sans'",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
            }}
          >
            <Icon name="task_alt" size={18} />
            Mark all success
          </button>
        </div>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/VisitDrawer.tsx
git commit -m "feat: per-task status control + remark in visit drawer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Visits list — derived counts, Attention filter, mark-all-success

**Files:**
- Modify: `src/data/store.tsx` (the `VisitFilter` union)
- Modify: `src/screens/Visits.tsx`

**Interfaces:**
- Consumes: `visitStatus` (Task 3), `useMarkAllSuccess` (Task 4), `VisitVM.resolvedT`/`pendingT` (Task 3).

- [ ] **Step 1: Add `'attention'` to the filter union**

In `src/data/store.tsx` line 16, replace:

```ts
export type VisitFilter = 'all' | 'pending' | 'overdue' | 'done'
```

with:

```ts
export type VisitFilter = 'all' | 'pending' | 'attention' | 'overdue' | 'done'
```

- [ ] **Step 2: Update the Visits screen imports and mutation hook**

In `src/screens/Visits.tsx`, replace line 3:

```ts
import { useMarkVisitDone } from '../data/queries/useVisitMutations'
```

with:

```ts
import { useMarkAllSuccess } from '../data/queries/useVisitMutations'
```

Replace line 4:

```ts
import { brandById, visitVM, isOverdue, outletById, staffById } from '../data/derived'
```

with:

```ts
import { brandById, visitVM, isOverdue, visitStatus, outletById, staffById } from '../data/derived'
```

Replace line 14:

```ts
  const markDoneMutation = useMarkVisitDone()
```

with:

```ts
  const markAllMutation = useMarkAllSuccess()
```

- [ ] **Step 3: Update counts, filter defs, and filtering to use derived status**

Replace the `counts` / `filterDefs` block (lines 20–31) with:

```ts
  const counts = {
    all: allF.length,
    pending: allF.filter((f) => visitStatus(f) === 'pending' && !isOverdue(f)).length,
    attention: allF.filter((f) => visitStatus(f) === 'attention').length,
    overdue: allF.filter(isOverdue).length,
    done: allF.filter((f) => visitStatus(f) === 'done').length,
  }
  const filterDefs: [VisitFilter, string][] = [
    ['all', 'All'],
    ['pending', 'Pending'],
    ['attention', 'Attention'],
    ['overdue', 'Overdue'],
    ['done', 'Completed'],
  ]
```

Replace the filtering block (lines 33–36) with:

```ts
  let filtered = allF
  if (S.visitFilter === 'pending') filtered = allF.filter((f) => visitStatus(f) === 'pending' && !isOverdue(f))
  else if (S.visitFilter === 'attention') filtered = allF.filter((f) => visitStatus(f) === 'attention')
  else if (S.visitFilter === 'overdue') filtered = allF.filter(isOverdue)
  else if (S.visitFilter === 'done') filtered = allF.filter((f) => visitStatus(f) === 'done')
```

- [ ] **Step 4: Update the row mapping (`canComplete` now means "has pending tasks")**

Replace the `rows` mapping (lines 46–50) with:

```ts
  const rows = filtered.map((f) => {
    const vm = visitVM(data, f)
    const d = new Date(f.date + 'T00:00:00')
    return { ...vm, day: String(d.getDate()).padStart(2, '0'), mon: MON[d.getMonth()], canComplete: vm.pendingT > 0 }
  })
```

- [ ] **Step 5: Update the desktop progress number and quick-action button**

Replace the progress number line (lines 91–93) — the `<span style={{ fontFamily: "'IBM Plex Mono'" ... }}>{f.doneT}/{f.total}</span>` — with:

```tsx
                  <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: 'var(--dim)' }}>
                    {f.resolvedT}/{f.total}
                  </span>
```

Replace the quick-action button block (lines 97–122, the `{f.canComplete && ( ... )}` button) with:

```tsx
              {f.canComplete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    markAllMutation.mutate({ visitId: f.id })
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    border: '1px solid #16a34a',
                    background: 'color-mix(in srgb, #16a34a 8%, transparent)',
                    color: '#16a34a',
                    borderRadius: 7,
                    padding: '6px 10px',
                    fontFamily: "'IBM Plex Sans'",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="check" size={16} />
                  All success
                </button>
              )}
```

- [ ] **Step 6: Commit**

```bash
git add src/data/store.tsx src/screens/Visits.tsx
git commit -m "feat: attention filter + mark-all-success in visits list

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Schedule modal — block zero-task visits

**Files:**
- Modify: `src/components/ScheduleModal.tsx`
- Test: `src/data/queries/scheduleTasks.test.ts`

**Interfaces:**
- Consumes: `planSchedule` (unchanged), `useCreateVisit` (Task 4, now throws on empty).

- [ ] **Step 1: Add the explicit empty-selection test**

Append inside the `describe('planSchedule', ...)` block in `src/data/queries/scheduleTasks.test.ts` (e.g. after the existing `'excludes unchecked items'` test):

```ts
  it('yields no visit tasks when nothing is checked', () => {
    const plan = planSchedule(
      [mk({ key: 'a', label: 'A', checked: false }), mk({ key: 'b', label: 'B', checked: false })],
      [],
    )
    expect(plan.taskLabels).toEqual([])
  })
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `npx vitest run src/data/queries/scheduleTasks.test.ts`
Expected: PASS (this asserts existing pure behavior the modal relies on).

- [ ] **Step 3: Compute `canSubmit` in the modal**

In `src/components/ScheduleModal.tsx`, after line 51 (`const selN = items.filter((t) => t.checked).length`), add:

```ts
  const canSubmit = items.some((t) => t.checked && t.label.trim())
```

- [ ] **Step 4: Show a hint and disable the Schedule button**

Replace the footer summary line (line 311) — `<div style={{ fontSize: 12, color: 'var(--dim)' }}>{summary}</div>` — with:

```tsx
          <div style={{ fontSize: 12, color: canSubmit ? 'var(--dim)' : '#dc2626' }}>
            {canSubmit ? summary : 'Add at least one task'}
          </div>
```

Replace the Schedule `<button>` (lines 329–344) with:

```tsx
            <button
              onClick={submit}
              disabled={!canSubmit}
              style={{
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 9,
                padding: '10px 18px',
                fontFamily: "'IBM Plex Sans'",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: canSubmit ? 1 : 0.5,
              }}
            >
              Schedule
            </button>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ScheduleModal.tsx src/data/queries/scheduleTasks.test.ts
git commit -m "feat: block scheduling a visit with no tasks

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Dashboard — derive status + Attention KPI

**Files:**
- Modify: `src/screens/Dashboard.tsx`

**Interfaces:**
- Consumes: `visitStatus` (Task 3).

- [ ] **Step 1: Import `visitStatus`**

In `src/screens/Dashboard.tsx`, replace line 3:

```ts
import { visitVM, isOverdue, linked, staffCount, today } from '../data/derived'
```

with:

```ts
import { visitVM, isOverdue, visitStatus, linked, staffCount, today } from '../data/derived'
```

- [ ] **Step 2: Derive period tallies (add `pAttn`)**

Replace lines 26–29:

```ts
  const pDone = periodFus.filter((f) => f.status === 'done').length
  const pPend = periodFus.filter((f) => f.status === 'pending').length
  const pOver = periodFus.filter(isOverdue).length
  const compRate = periodFus.length ? Math.round((pDone / periodFus.length) * 100) : 0
```

with:

```ts
  const pDone = periodFus.filter((f) => visitStatus(f) === 'done').length
  const pPend = periodFus.filter((f) => visitStatus(f) === 'pending').length
  const pAttn = periodFus.filter((f) => visitStatus(f) === 'attention').length
  const pOver = periodFus.filter(isOverdue).length
  const compRate = periodFus.length ? Math.round((pDone / periodFus.length) * 100) : 0
```

- [ ] **Step 3: Add the Attention KPI card and recolor Overdue**

Replace the `kpis` array (lines 38–43) with:

```ts
  const kpis = [
    { label: 'Visits', value: periodFus.length, sub: periodLabel, icon: 'fact_check', tone: 'var(--text)' },
    { label: 'Completion', value: `${compRate}%`, sub: `${pDone} completed`, icon: 'task_alt', tone: '#16a34a' },
    { label: 'Pending', value: pPend, sub: 'awaiting completion', icon: 'pending', tone: '#d97706' },
    { label: 'Attention', value: pAttn, sub: 'needs attention', icon: 'warning', tone: '#dc2626' },
    { label: 'Overdue', value: pOver, sub: 'past scheduled date', icon: 'event_busy', tone: '#ea580c' },
  ]
```

- [ ] **Step 4: Make the monthly trend chart account for attention (done vs not-done)**

Replace `mdata`/`tmax` (lines 45–49) with:

```ts
  const mdata = MK.map(([label, mm]) => {
    const fs = yearFus.filter((f) => f.date.slice(5, 7) === mm)
    const done = fs.filter((x) => visitStatus(x) === 'done').length
    return { label, done, notDone: fs.length - done }
  })
  const tmax = Math.max(1, ...mdata.map((m) => m.done + m.notDone))
```

Replace the brand breakdown `done` computation (line 55) — inside `brandBreakdown` — replacing:

```ts
    return { name: b.name, color: b.color, done: fs.filter((x) => x.status === 'done').length, total: fs.length, pct: Math.round((fs.length / bmax) * 100) }
```

with:

```ts
    return { name: b.name, color: b.color, done: fs.filter((x) => visitStatus(x) === 'done').length, total: fs.length, pct: Math.round((fs.length / bmax) * 100) }
```

Replace the `upcomingList` filter (line 67):

```ts
    .filter((f) => f.status === 'pending' && !isOverdue(f))
```

with:

```ts
    .filter((f) => visitStatus(f) === 'pending' && !isOverdue(f))
```

- [ ] **Step 5: Update the trend chart legend + bar to use `notDone`**

Replace the "Pending" legend entry (lines 146–148):

```tsx
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: tint('var(--accent)', 22) }} />Pending
              </span>
```

with:

```tsx
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: tint('var(--accent)', 22) }} />Open
              </span>
```

Replace the bar total + segment lines (lines 153 and 172). Replace line 153:

```ts
              const total = m.done + m.pending
```

with:

```ts
              const total = m.done + m.notDone
```

Replace line 172:

```tsx
                    <div style={{ height: Math.round((m.pending / tmax) * H), background: tint('var(--accent)', 22) }} />
```

with:

```tsx
                    <div style={{ height: Math.round((m.notDone / tmax) * H), background: tint('var(--accent)', 22) }} />
```

- [ ] **Step 6: Commit**

```bash
git add src/screens/Dashboard.tsx
git commit -m "feat: dashboard derives status and surfaces attention KPI

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Full build, test, and stale-reference sweep

**Files:**
- No new files; verification + cleanup only.

- [ ] **Step 1: Type-check + build the whole project**

Run: `npm run build`
Expected: PASS (no `tsc` errors). If any file still references `Task.done`, `Visit.status`, `doneT`, or a removed mutation, fix it per the patterns in Tasks 2–8.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — all files under `src/**/*.test.ts` green.

- [ ] **Step 3: Sweep for stale references**

Run:

```bash
grep -rn "useToggleTask\|useMarkVisitDone\|useToggleVisitStatus\|VisitStatus\|\bdoneT\b\|\.done\b" src --include="*.ts" --include="*.tsx"
```

Expected: no matches. (Note: `m.done` / `b.done` in `Dashboard.tsx` are local object properties, not `Task.done`; the `\.done\b` pattern will flag them — confirm by eye that the only hits, if any, are those local vars, and that nothing references the removed `Task.done` field or the deleted hooks.)

- [ ] **Step 4: Final commit (if the sweep required any fixes)**

```bash
git add -A
git commit -m "chore: finalize visit task status migration

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> If Steps 1–3 passed with no changes, skip this commit.

---

## Self-review notes

- **Spec coverage:** migration (T1), model/mappers (T2), derived status machine + colors/labels/counts (T3), mutations incl. empty-guard + mark-all-success (T4), drawer segmented control + remark + button (T5), list counts/attention filter/mark-all-success (T6), schedule-modal zero-task block (T7), dashboard derive + attention KPI (T8), full verification + sweep (T9). All spec sections map to a task.
- **Empty checklist:** prevented at creation (T7 modal disable + T4 mutation guard); `visitBaseStatus([]) → 'pending'` retained as the defensive branch (T3) and tested.
- **"Pending wins" precedence:** encoded in `visitBaseStatus` order (pending checked before failed) and covered by the `'pending, failed, success' → pending` test (T3).
- **Type consistency:** `TaskStatus` (model) → `TaskRow.status`/`rowToTask` (mappers) → `visitBaseStatus`/`visitVM` (derived) → `useSetTaskStatus`/`SEGMENTS` (mutations/drawer) all use the same `'pending' | 'failed' | 'success'` union. `resolvedT` defined in T3 is consumed in T5/T6. `'attention'` added to `VisitFilter` (T6) matches the `visitStatus` value (T3).
