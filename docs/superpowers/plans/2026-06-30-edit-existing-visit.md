# Edit an Existing Visit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users edit an existing visit (store, date, assigned staff, add/remove checklist tasks) directly from the visit drawer, with every change auto-saving.

**Architecture:** Three new thin React Query mutations on the `visits`/`visit_tasks` tables (no schema change), one small pure-logic module for the add/remove helpers, and inline edit affordances added to `VisitDrawer.tsx` that reuse existing derived helpers (`staffForStore`) and styles (`chip`).

**Tech Stack:** React 18 + TypeScript + Vite, React Query, Supabase JS client, Vitest (node env).

## Global Constraints

- All styling is inline `style={}` objects driven by CSS variables (`src/theme.ts`, `src/index.css`). No CSS framework.
- DB rows are snake_case; the domain model is camelCase. Mutations write snake_case columns directly.
- Mutations invalidate query keys from `src/data/queries/keys.ts` on success (`queryKeys.visits`).
- Build fails on unused locals/params (`noUnusedLocals`/`noUnusedParameters`).
- Tests only match `src/**/*.test.ts` and run in the `node` environment — pure logic only, no React/DOM tests.
- Extract non-trivial pure logic into a `.test.ts`-covered module rather than embedding in a component/mutation.

---

### Task 1: Pure helpers for task add/remove (`visitEdit.ts`)

**Files:**
- Create: `src/data/queries/visitEdit.ts`
- Test: `src/data/queries/visitEdit.test.ts`

**Interfaces:**
- Consumes: the `Task` type from `src/data/model.ts` (`{ id?, label, status, remark }`).
- Produces:
  - `nextTaskSort(tasks: { }[]): number` — returns `tasks.length` worth of ordering; specifically `max(existing sort indices)+1`. Since `Task` carries no `sort` field in the domain model, sort is derived from array length: returns `tasks.length`.
  - `taskHasResult(task: { status: TaskStatus; remark: string }): boolean` — `true` when the task has a recorded result (`status !== 'pending'` or `remark.trim() !== ''`).

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/queries/visitEdit.test.ts`
Expected: FAIL — cannot resolve `./visitEdit` / functions not defined.

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { TaskStatus } from '../model'

/** Sort/append position for a newly added task: the end of the current list. */
export function nextTaskSort(tasks: unknown[]): number {
  return tasks.length
}

/** Whether a task already carries a recorded result, so removing it should confirm. */
export function taskHasResult(task: { status: TaskStatus; remark: string }): boolean {
  return task.status !== 'pending' || task.remark.trim() !== ''
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/queries/visitEdit.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/queries/visitEdit.ts src/data/queries/visitEdit.test.ts
git commit -m "feat: pure helpers for visit task add/remove"
```

---

### Task 2: Visit-edit mutations (`useVisitMutations.ts`)

**Files:**
- Modify: `src/data/queries/useVisitMutations.ts` (append three hooks)

**Interfaces:**
- Consumes: `supabase` from `../../lib/supabase`, `queryKeys` from `./keys`.
- Produces:
  - `useUpdateVisit()` → mutation accepting `{ visitId: string; brandId?: string; outletId?: string; staffId?: string | null; date?: string }`. Writes only the provided fields to the `visits` row (snake_case columns `brand_id`, `outlet_id`, `staff_id`, `date`).
  - `useAddVisitTask()` → mutation accepting `{ visitId: string; label: string; sort: number }`. Inserts a `visit_tasks` row `{ visit_id, label, status: 'pending', remark: '', sort }`.
  - `useRemoveVisitTask()` → mutation accepting `{ taskId: string }`. Deletes the `visit_tasks` row.

  > No unit test: these are thin Supabase calls following the existing `useCreateVisit`/`useSetTaskStatus` pattern in the same file (consistent with the codebase, which does not unit-test mutations).

- [ ] **Step 1: Append the three mutation hooks**

Add at the end of `src/data/queries/useVisitMutations.ts`:

```typescript
export function useUpdateVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      visitId: string
      brandId?: string
      outletId?: string
      staffId?: string | null
      date?: string
    }) => {
      const patch: Record<string, unknown> = {}
      if (input.brandId !== undefined) patch.brand_id = input.brandId
      if (input.outletId !== undefined) patch.outlet_id = input.outletId
      if (input.staffId !== undefined) patch.staff_id = input.staffId
      if (input.date !== undefined) patch.date = input.date
      const { error } = await supabase.from('visits').update(patch).eq('id', input.visitId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}

export function useAddVisitTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { visitId: string; label: string; sort: number }) => {
      const { error } = await supabase.from('visit_tasks').insert({
        visit_id: input.visitId,
        label: input.label,
        status: 'pending',
        remark: '',
        sort: input.sort,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}

export function useRemoveVisitTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { taskId: string }) => {
      const { error } = await supabase.from('visit_tasks').delete().eq('id', input.taskId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS (tsc + vite build succeed; no unused-locals errors).

- [ ] **Step 3: Commit**

```bash
git add src/data/queries/useVisitMutations.ts
git commit -m "feat: mutations to update a visit and add/remove its tasks"
```

---

### Task 3: Editable store, date & staff in the drawer header

**Files:**
- Modify: `src/components/VisitDrawer.tsx`

**Interfaces:**
- Consumes: `useUpdateVisit` (Task 2); `staffForStore`, `brandById`, `outletById` from `../data/derived`; `chip` from `../theme`.
- Produces: drawer header where store, date, and staff are editable and auto-save.

- [ ] **Step 1: Add imports and instantiate the update mutation**

At the top of `src/components/VisitDrawer.tsx`, extend the derived import and add the others:

```typescript
import { visitVM, staffForStore } from '../data/derived'
import { pill, chip } from '../theme'
import { useSetTaskStatus, useSetTaskRemark, useMarkAllSuccess, useUpdateVisit } from '../data/queries/useVisitMutations'
```

Inside `VisitDrawer`, alongside the other mutation hooks:

```typescript
  const updateVisit = useUpdateVisit()
```

- [ ] **Step 2: Replace the header date/staff block with editable controls**

Replace the header `<div style={{ flex: 1 }}>…</div>` block (the one containing "Visit · {vm.dateLabel}", the title, and "Staff on duty · {vm.staffName}") with:

```tsx
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: vm.brandColor }} />
              {vm.title}
            </div>

            {/* Store (brand · outlet) */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {data.stores.map((s) => {
                const b = brandById(data, s.brandId)
                const o = outletById(data, s.outletId)
                const active = s.brandId === openF.brandId && s.outletId === openF.outletId
                return (
                  <button
                    key={`${s.brandId}|${s.outletId}`}
                    onClick={() => {
                      if (active) return
                      const list = staffForStore(data, s.brandId, s.outletId)
                      updateVisit.mutate(
                        { visitId: openF.id, brandId: s.brandId, outletId: s.outletId, staffId: list[0]?.id ?? null },
                        { onError: (e) => alert(e.message) },
                      )
                    }}
                    style={chip(active)}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: b.color }} />
                    {b.name} · {o.name}
                  </button>
                )
              })}
            </div>

            {/* Date */}
            <input
              type="date"
              value={openF.date}
              aria-label="Visit date"
              onChange={(e) =>
                updateVisit.mutate(
                  { visitId: openF.id, date: e.target.value },
                  { onError: (err) => alert(err.message) },
                )
              }
              style={{
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                borderRadius: 8,
                padding: '8px 10px',
                fontFamily: "'IBM Plex Sans'",
                fontSize: 13,
                color: 'var(--text)',
                width: 'fit-content',
              }}
            />

            {/* Staff reassign */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>Staff on duty</span>
              {staffForStore(data, openF.brandId, openF.outletId).length === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--dim)' }}>Unassigned</span>
              ) : (
                staffForStore(data, openF.brandId, openF.outletId).map((st) => (
                  <button
                    key={st.id}
                    onClick={() =>
                      updateVisit.mutate(
                        { visitId: openF.id, staffId: st.id },
                        { onError: (e) => alert(e.message) },
                      )
                    }
                    style={chip(openF.staffId === st.id)}
                  >
                    {st.name}
                  </button>
                ))
              )}
            </div>
          </div>
```

Note: `brandById`/`outletById` were not previously imported. Update the import:

```typescript
import { visitVM, staffForStore, brandById, outletById } from '../data/derived'
```

The status `<span style={pill(...)}>` and the close `<button>` that followed the old block stay as-is, after this new `<div>`.

- [ ] **Step 3: Verify the build and dev render**

Run: `npm run build`
Expected: PASS. Then `npm run dev`, open a visit, confirm: store chips highlight the current store and switching one re-points the visit (staff resets to the new store's first member); the date input changes the visit date; staff chips reassign.

- [ ] **Step 4: Commit**

```bash
git add src/components/VisitDrawer.tsx
git commit -m "feat: edit store, date and staff inline in the visit drawer"
```

---

### Task 4: Add/remove checklist tasks in the drawer

**Files:**
- Modify: `src/components/VisitDrawer.tsx`

**Interfaces:**
- Consumes: `useAddVisitTask`, `useRemoveVisitTask` (Task 2); `nextTaskSort`, `taskHasResult` (Task 1); `Icon`.
- Produces: a remove (×) button per task row and a "+ Add task" input row that auto-save.

- [ ] **Step 1: Add imports, state, and mutation hooks**

Extend imports in `src/components/VisitDrawer.tsx`:

```typescript
import { useState } from 'react'
import { useSetTaskStatus, useSetTaskRemark, useMarkAllSuccess, useUpdateVisit, useAddVisitTask, useRemoveVisitTask } from '../data/queries/useVisitMutations'
import { nextTaskSort, taskHasResult } from '../data/queries/visitEdit'
```

Inside `VisitDrawer`, add the hooks and local input state:

```typescript
  const addTask = useAddVisitTask()
  const removeTask = useRemoveVisitTask()
  const [newTaskLabel, setNewTaskLabel] = useState('')
```

- [ ] **Step 2: Add a remove button to each task row**

In the task `.map((t) => ( … ))`, change the label line so the label and a remove button share a row. Replace:

```tsx
                <div style={{ fontSize: 13.5, color: 'var(--text)' }}>{t.label}</div>
```

with:

```tsx
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontSize: 13.5, color: 'var(--text)', flex: 1 }}>{t.label}</div>
                  <button
                    type="button"
                    title="Remove task"
                    aria-label={`Remove ${t.label}`}
                    onClick={() => {
                      if (taskHasResult(t) && !confirm(`Remove "${t.label}"? It already has a recorded result.`)) return
                      removeTask.mutate({ taskId: t.id! }, { onError: (e) => alert(e.message) })
                    }}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)', padding: 2, flexShrink: 0 }}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
```

- [ ] **Step 3: Add the "+ Add task" input row**

Immediately after the closing `</div>` of the task list container (the `<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>` that wraps the `.map`), add:

```tsx
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              value={newTaskLabel}
              onChange={(e) => setNewTaskLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                const label = newTaskLabel.trim()
                if (!label) return
                addTask.mutate(
                  { visitId: openF.id, label, sort: nextTaskSort(openF.tasks) },
                  { onSuccess: () => setNewTaskLabel(''), onError: (err) => alert(err.message) },
                )
              }}
              placeholder="Add a task…"
              style={{
                flex: 1,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                borderRadius: 8,
                padding: '9px 12px',
                fontFamily: "'IBM Plex Sans'",
                fontSize: 13,
                color: 'var(--text)',
              }}
            />
            <button
              type="button"
              onClick={() => {
                const label = newTaskLabel.trim()
                if (!label) return
                addTask.mutate(
                  { visitId: openF.id, label, sort: nextTaskSort(openF.tasks) },
                  { onSuccess: () => setNewTaskLabel(''), onError: (err) => alert(err.message) },
                )
              }}
              style={{
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                borderRadius: 8,
                padding: '9px 16px',
                fontFamily: "'IBM Plex Sans'",
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Add
            </button>
          </div>
```

- [ ] **Step 4: Verify the build and dev render**

Run: `npm run build`
Expected: PASS. Then `npm run dev`, open a visit: typing a label + Enter/Add appends a pending task; the × removes a pending task immediately and prompts a confirm for one with a recorded result; the "resolved/total" counter and status badge update after each change.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS (includes `visitEdit.test.ts`).

- [ ] **Step 6: Commit**

```bash
git add src/components/VisitDrawer.tsx
git commit -m "feat: add and remove visit checklist tasks from the drawer"
```

---

## Self-Review Notes

- **Spec coverage:** Store edit (Task 3 store chips), date edit (Task 3 date input), staff reassign (Task 3 staff chips with first-staff reset on store change), add/remove tasks (Task 4), pure helpers + tests (Task 1), mutations (Task 2), `alert`-based error handling (all UI tasks), no schema change. All spec sections map to a task.
- **Type consistency:** `useUpdateVisit`/`useAddVisitTask`/`useRemoveVisitTask` signatures defined in Task 2 are consumed verbatim in Tasks 3–4. `nextTaskSort`/`taskHasResult` defined in Task 1 are consumed in Task 4.
- **Placeholder scan:** No TBD/TODO; every code step shows full code.
