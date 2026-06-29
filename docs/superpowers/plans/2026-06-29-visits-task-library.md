# Visits & Task Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded follow-up checklist with a user-managed reusable task library plus one-time tasks, consolidate Brands/Outlets/Staff/Tasks under a single "Manage" nav item, rename the "Follow-ups" domain to "Visits" (incl. database), and show the weekday on scheduled dates.

**Architecture:** Server data flows DB row → mapper → domain model → derived view-model → component (React Query for server state, a separate `useState` store for UI state). New pure logic goes in a testable `.ts` module with a sibling `.test.ts`, per the `transferLogic.ts` convention. Styling is inline `style={}` objects driven by CSS variables — no CSS framework.

**Tech Stack:** React 18, TypeScript (strict, `noUnusedLocals`/`noUnusedParameters`), Vite, @tanstack/react-query, Supabase, Vitest (node env, `src/**/*.test.ts` only).

## Global Constraints

- Build gate: `npm run build` runs `tsc -b` (fails on unused locals/params) then `vite build`. Must stay green at every task boundary.
- Test gate: `npm test` (`vitest run`). Tests run in the `node` environment; only `src/**/*.test.ts` match. No DOM/component tests — pure logic only.
- All styling is inline `style={}` objects using CSS variables (`var(--surface)`, `var(--border)`, `var(--accent)`, `var(--dim)`, `var(--text)`, `var(--surface2)`). Reuse helpers from `src/theme.ts` (`chip`, `card`, `pill`).
- Data is **per-user scoped** (as of `0003_per_user_scoping.sql`): every table has an `owner_id uuid not null references auth.users(id) on delete cascade default auth.uid()` column, set by the DB default, with a per-user RLS policy `"owner access"` of `owner_id = auth.uid()`. The client never sends or selects `owner_id`. **New tables must follow this same pattern**; new mappers/mutations do NOT handle `owner_id` (the DB default fills it, and `select('*')` returns it but mappers ignore it).
- Migrations live in `supabase/migrations/`, are numbered in order, and are applied manually via the Supabase SQL editor. Plan tasks create the files; they cannot run the SQL.
- Go through mappers (snake_case row → camelCase model); never pass raw rows around. Domain model lives in `src/data/model.ts`; derived/view-model helpers in `src/data/derived.ts`.
- Git identity for commits: `git -c user.email=cch340@gmail.com commit ...`.

**Implementation order:** W3 rename → W2 nav → W1 task library → W4 weekday. Each workstream keeps the build green at its boundary.

---

## W3 — Rename Follow-ups → Visits (database + code)

### Task 1: Database rename migration

**Files:**
- Create: `supabase/migrations/0004_rename_visits.sql`

**Interfaces:**
- Produces: tables `visits` (was `follow_ups`), `visit_tasks` (was `follow_up_tasks`), column `visit_tasks.visit_id` (was `follow_up_id`). The `owner_id` column, `"owner access"` RLS policy, indexes, and FK constraints all follow the tables automatically through a rename.

- [ ] **Step 1: Create the migration file**

```sql
-- 0004_rename_visits.sql
-- Rename the "follow-up" domain to "visits".
-- A table rename carries its rows, owner_id column, "owner access" RLS policy,
-- indexes, and FK constraints with it, so nothing needs re-creating.
-- Apply AFTER 0003_per_user_scoping.sql in the Supabase SQL editor.

alter table follow_ups       rename to visits;
alter table follow_up_tasks  rename to visit_tasks;
alter table visit_tasks      rename column follow_up_id to visit_id;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0004_rename_visits.sql
git -c user.email=cch340@gmail.com commit -m "feat(db): rename follow_ups/follow_up_tasks to visits/visit_tasks"
```

> NOTE FOR IMPLEMENTER: This SQL must be run manually in the Supabase SQL editor for the live app to work against the renamed tables. The code tasks below assume it has been (or will be) applied. The code itself builds and unit-tests pass without the DB being migrated.

---

### Task 2: Rename the data layer + all consumers to "Visits"

This is one atomic refactor: every file that references the follow-up domain changes together so the build stays green. Work through the sub-steps in order, then build, test, and commit once. `DEFAULT_TASKS` and the `Task` type are intentionally **kept** here (they are removed in W1).

Identifier map applied throughout:
- `FollowUp` → `Visit`, `FollowUpStatus` → `VisitStatus`, `FollowUpVM` → `VisitVM`, `FollowUpRow` → `VisitRow`
- `rowToFollowUp` → `rowToVisit`, `fuVM` → `visitVM`
- `useCreateFollowUp` → `useCreateVisit`, `useMarkFollowUpDone` → `useMarkVisitDone`, `useToggleFollowUpStatus` → `useToggleVisitStatus` (`useToggleTask` keeps its name)
- mutation input field `followUpId` → `visitId`
- `queryKeys.followups` → `queryKeys.visits`; `DataSnapshot.followups` → `DataSnapshot.visits`
- Screen value `'followups'` → `'visits'`; state `openFuId` → `openVisitId`, `fuFilter` → `visitFilter`, `FuFilter` → `VisitFilter`; actions `openFu`/`closeFu`/`setFuFilter` → `openVisit`/`closeVisit`/`setVisitFilter`
- DB table strings: `'follow_ups'` → `'visits'`, `'follow_up_tasks'` → `'visit_tasks'`, column `follow_up_id` → `visit_id`
- Files renamed: `useFollowUpMutations.ts` → `useVisitMutations.ts`, `components/FollowUpDrawer.tsx` → `components/VisitDrawer.tsx`, `screens/Followups.tsx` → `screens/Visits.tsx`

**Files:**
- Modify: `src/data/queries/keys.ts`, `src/data/model.ts`, `src/data/queries/mappers.ts`, `src/data/queries/mappers.test.ts`, `src/data/queries/useData.ts`, `src/data/derived.ts`, `src/data/store.tsx`, `src/data/nav.ts`, `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/BottomNav.tsx`, `src/screens/Dashboard.tsx`, `src/components/ScheduleModal.tsx`
- Rename + modify: `src/data/queries/useFollowUpMutations.ts` → `src/data/queries/useVisitMutations.ts`; `src/components/FollowUpDrawer.tsx` → `src/components/VisitDrawer.tsx`; `src/screens/Followups.tsx` → `src/screens/Visits.tsx`

**Interfaces:**
- Produces: `Visit`, `VisitStatus`, `VisitVM`, `visitVM(s, v)`, `useCreateVisit`, `useMarkVisitDone({ visitId })`, `useToggleVisitStatus({ visitId, status })`, `useToggleTask({ taskId, done })`, `queryKeys.visits`, `DataSnapshot.visits`, Screen `'visits'`, store `openVisitId`/`visitFilter`/`openVisit`/`closeVisit`/`setVisitFilter`.

- [ ] **Step 1: `keys.ts` — rename the key**

```ts
export const queryKeys = {
  brands: ['brands'] as const,
  outlets: ['outlets'] as const,
  stores: ['stores'] as const,
  staff: ['staff'] as const,
  visits: ['visits'] as const,
}
```

- [ ] **Step 2: `model.ts` — rename the type (keep `Task` and `DEFAULT_TASKS`)**

Replace the `FollowUpStatus` + `FollowUp` block (lines 47–57) with:

```ts
export type VisitStatus = 'done' | 'pending'

export interface Visit {
  id: string
  date: string // ISO date
  staffId: string | null
  brandId: string
  outletId: string
  status: VisitStatus
  tasks: Task[]
}
```

Leave `Task` (lines 41–45) and `DEFAULT_TASKS` (lines 59–66) unchanged.

- [ ] **Step 3: `mappers.ts` — rename row type, column, mapper**

Change the import on line 1 to `import type { Visit, HistoryEntry, Staff, Store, Task } from '../model'`. Replace `TaskRow` field `follow_up_id` with `visit_id`. Replace the `FollowUpRow` interface and `rowToFollowUp` with:

```ts
export interface TaskRow {
  id: string
  visit_id: string
  label: string
  done: boolean
  sort: number
}

export interface VisitRow {
  id: string
  date: string
  staff_id: string | null
  brand_id: string
  outlet_id: string
  status: 'done' | 'pending'
  visit_tasks: TaskRow[]
}
```

```ts
export const rowToVisit = (r: VisitRow): Visit => ({
  id: r.id,
  date: r.date,
  staffId: r.staff_id,
  brandId: r.brand_id,
  outletId: r.outlet_id,
  status: r.status,
  tasks: [...r.visit_tasks].sort((a, b) => a.sort - b.sort).map(rowToTask),
})
```

- [ ] **Step 4: `useData.ts` — rename query, fetch, snapshot field**

Replace the `FollowUp`/`rowToFollowUp` imports with `Visit`/`rowToVisit`. Update `DataSnapshot.followups: FollowUp[]` → `visits: Visit[]`. Replace `fetchFollowups` and its use:

```ts
async function fetchVisits(): Promise<Visit[]> {
  const { data, error } = await supabase
    .from('visits')
    .select('*, visit_tasks(*)')
    .order('date')
  if (error) throw error
  return data.map(rowToVisit)
}
```

In `useData()`, rename the query const and key, include it in `queries`, and return `visits`:

```ts
  const visits = useQuery({ queryKey: queryKeys.visits, queryFn: fetchVisits })

  const queries = [brands, outlets, stores, staff, visits]
  return {
    data: {
      brands: brands.data ?? [],
      outlets: outlets.data ?? [],
      stores: stores.data ?? [],
      staff: staff.data ?? [],
      visits: visits.data ?? [],
    },
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
  }
```

- [ ] **Step 5: Rename `useFollowUpMutations.ts` → `useVisitMutations.ts`**

```bash
git mv src/data/queries/useFollowUpMutations.ts src/data/queries/useVisitMutations.ts
```

Replace the file contents with:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'

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
      const { data: v, error } = await supabase
        .from('visits')
        .insert({
          brand_id: input.brandId,
          outlet_id: input.outletId,
          staff_id: input.staffId,
          date: input.date,
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw error
      if (input.taskLabels.length) {
        const rows = input.taskLabels.map((label, i) => ({
          visit_id: v.id,
          label,
          done: false,
          sort: i,
        }))
        const { error: tErr } = await supabase.from('visit_tasks').insert(rows)
        if (tErr) throw tErr
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}

export function useToggleTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { taskId: string; done: boolean }) => {
      const { error } = await supabase
        .from('visit_tasks')
        .update({ done: input.done })
        .eq('id', input.taskId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}

export function useMarkVisitDone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { visitId: string }) => {
      const { error } = await supabase
        .from('visit_tasks')
        .update({ done: true })
        .eq('visit_id', input.visitId)
      if (error) throw error
      const { error: fErr } = await supabase
        .from('visits')
        .update({ status: 'done' })
        .eq('id', input.visitId)
      if (fErr) throw fErr
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}

export function useToggleVisitStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { visitId: string; status: 'done' | 'pending' }) => {
      const next = input.status === 'done' ? 'pending' : 'done'
      const { error } = await supabase
        .from('visits')
        .update({ status: next })
        .eq('id', input.visitId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.visits }),
  })
}
```

- [ ] **Step 6: `derived.ts` — rename type/VM/helper**

Update the import on line 2 to `import type { Brand, Visit, Outlet, Staff } from './model'`. Change `isOverdue` signature to `(f: Visit)`. Rename `FollowUpVM` → `VisitVM` and `fuVM` → `visitVM` with signature `export function visitVM(s: DataSnapshot, f: Visit): VisitVM`. (Body unchanged; `fmt(f.date)` stays — weekday is added in W4.)

- [ ] **Step 7: `store.tsx` — rename Screen value, state, actions**

- Line 11: `export type Screen = 'dashboard' | 'brands' | 'outlets' | 'staff' | 'visits'`
- Line 14: `export type VisitFilter = 'all' | 'pending' | 'overdue' | 'done'`
- In `AppState`: `fuFilter: VisitFilter` → rename to `visitFilter: VisitFilter`; `openFuId: string | null` → `openVisitId: string | null`.
- In `seed()`: `fuFilter: 'all'` → `visitFilter: 'all'`; `openFuId: null` → `openVisitId: null`.
- In `StoreActions`: `setFuFilter(f: VisitFilter): void`, `openFu(id: string): void`, `closeFu(): void` → `setVisitFilter`, `openVisit`, `closeVisit`.
- In `actions`: 
```ts
      setVisitFilter: (visitFilter) => patch({ visitFilter }),
      openVisit: (openVisitId) => patch({ openVisitId }),
      closeVisit: () => patch({ openVisitId: null }),
```
- In `go`: `patch({ activeScreen, openFuId: null })` → `patch({ activeScreen, openVisitId: null })`.

- [ ] **Step 8: `nav.ts` — rename the followups item (still 5 items here; W2 collapses them)**

```ts
export const NAV: NavDef[] = [
  { key: 'dashboard', label: 'Dashboard', short: 'Home', icon: 'space_dashboard' },
  { key: 'brands', label: 'Brands', short: 'Brands', icon: 'sell' },
  { key: 'outlets', label: 'Outlets', short: 'Outlets', icon: 'storefront' },
  { key: 'staff', label: 'Staff', short: 'Staff', icon: 'groups' },
  { key: 'visits', label: 'Visits', short: 'Visits', icon: 'fact_check' },
]

export const TITLES: Record<Screen, [string, string]> = {
  dashboard: ['Summary', 'Year & month visit overview'],
  brands: ['Brand Management', 'Brands and the outlets they operate in'],
  outlets: ['Outlet Management', 'Malls and the brands hosted'],
  staff: ['Staff Management', 'Assignments and transfers'],
  visits: ['Visits', 'Scheduled store visits & checks'],
}
```

- [ ] **Step 9: Rename screen + drawer files**

```bash
git mv src/screens/Followups.tsx src/screens/Visits.tsx
git mv src/components/FollowUpDrawer.tsx src/components/VisitDrawer.tsx
```

In `src/screens/Visits.tsx`: rename component `export function Followups()` → `export function Visits()`; imports `useMarkFollowUpDone` → `useMarkVisitDone` (from `'../data/queries/useVisitMutations'`), `fuVM` → `visitVM`, `type FuFilter` → `type VisitFilter`; `setFuFilter`/`openFu` → `setVisitFilter`/`openVisit`; `data.followups` → `data.visits`; `S.fuFilter` → `S.visitFilter`; `filterDefs: [VisitFilter, string][]`; `markDoneMutation.mutate({ followUpId: f.id })` → `markDoneMutation.mutate({ visitId: f.id })`; empty-state copy `'No follow-ups match this filter.'` → `'No visits match this filter.'`.

In `src/components/VisitDrawer.tsx`: rename component `FollowUpDrawer` → `VisitDrawer`; imports from `'../data/queries/useVisitMutations'` with `useMarkVisitDone`, `useToggleVisitStatus`; `fuVM` → `visitVM`; `closeFu` → `closeVisit`; `S.openFuId` → `S.openVisitId`; `data.followups` → `data.visits`; `markDone.mutate({ followUpId: openF.id }, ...)` → `markDone.mutate({ visitId: openF.id }, ...)`; `toggleStatus.mutate({ followUpId: openF.id, status: openF.status }, ...)` → `{ visitId: openF.id, status: openF.status }`; header text `Follow-up · {vm.dateLabel}` → `Visit · {vm.dateLabel}`; footer button `Reopen follow-up` → `Reopen visit`. (Local variable `openF` may keep its name.)

- [ ] **Step 10: `App.tsx` — update imports + switch**

Imports: `import { Visits } from './screens/Visits'` (was Followups) and `import { VisitDrawer } from './components/VisitDrawer'` (was FollowUpDrawer). Switch line: `{state.activeScreen === 'followups' && <Followups />}` → `{state.activeScreen === 'visits' && <Visits />}`. Render `<VisitDrawer />` (was `<FollowUpDrawer />`).

- [ ] **Step 11: `Sidebar.tsx` + `BottomNav.tsx` — badge key + data field**

In both files: `data.followups.filter(isOverdue)` → `data.visits.filter(isOverdue)`; badge condition `n.key === 'followups'` → `n.key === 'visits'`.

- [ ] **Step 12: `Dashboard.tsx` — data field, VM helper, labels**

`import { visitVM, isOverdue, linked, staffCount, today } from '../data/derived'` (was `fuVM`); `openFu` → `openVisit`; every `data.followups` → `data.visits`; `yearFus`/`monthFus`/etc. may keep their local names; `.map((f) => fuVM(data, f))` → `visitVM`; `openFu(f.id)` → `openVisit(f.id)`. User-facing strings: KPI `label: 'Follow-ups'` → `'Visits'`; `'Follow-up performance — {periodLabel}'` → `'Visit performance — {periodLabel}'`; `'Follow-ups by month'` → `'Visits by month'`; `'Follow-ups by brand'` → `'Visits by brand'`; `'Overdue follow-ups'` → `'Overdue visits'`. ("Upcoming visits" already uses the term.)

- [ ] **Step 13: `ScheduleModal.tsx` — mutation import + title copy (task logic unchanged for now)**

`import { useCreateVisit } from '../data/queries/useVisitMutations'`; `const create = useCreateVisit()`. Header `'Schedule a follow-up'` → `'Schedule a visit'`. (The `DEFAULT_TASKS` checklist and submit logic stay as-is until W1.)

- [ ] **Step 13b: `mappers.test.ts` — rename the mapper, row field, and describe block**

The existing test references the old symbols and would fail `npm test`. Update the import on line 2 to `import { rowToStaff, rowToVisit, rowToStore } from './mappers'`, and replace the `rowToFollowUp` block (lines 32–50) with:

```ts
describe('rowToVisit', () => {
  it('maps fields and orders tasks by sort', () => {
    const v = rowToVisit({
      id: 'f1',
      date: '2026-06-25',
      staff_id: null,
      brand_id: 'b1',
      outlet_id: 'o1',
      status: 'pending',
      visit_tasks: [
        { id: 't2', visit_id: 'f1', label: 'B', done: true, sort: 1 },
        { id: 't1', visit_id: 'f1', label: 'A', done: false, sort: 0 },
      ],
    })
    expect(v.staffId).toBeNull()
    expect(v.tasks.map((t) => t.label)).toEqual(['A', 'B'])
    expect(v.tasks[0].id).toBe('t1')
  })
})
```

- [ ] **Step 14: Build, test, and verify no stragglers**

Run: `npm run build && npm test`
Expected: build succeeds (tsc + vite), all existing tests pass.
Run: `grep -rni "follow" src` (sanity)
Expected: no remaining user-facing "follow-up" strings or `followup`/`FollowUp`/`fuVM`/`fuFilter`/`openFuId` identifiers in `src`. (The DB migration files under `supabase/` are historical and may still say `follow_ups` — that is fine.)

- [ ] **Step 15: Commit**

```bash
git add -A
git -c user.email=cch340@gmail.com commit -m "refactor: rename follow-ups domain to visits across the app"
```

---

## W2 — "Manage" nav consolidation

### Task 3: Collapse Brands/Outlets/Staff into a Manage screen

Top-level nav becomes Dashboard · Visits · Manage. Brands/Outlets/Staff render as tabs inside a new `Manage` screen, joined by a **Tasks** tab that shows a temporary placeholder (replaced with the real panel in W1 Task 7).

**Files:**
- Modify: `src/data/store.tsx`, `src/data/nav.ts`, `src/App.tsx`
- Create: `src/screens/Manage.tsx`

**Interfaces:**
- Consumes: `Brands`, `Outlets`, `Staff` screen components (rendered unchanged).
- Produces: Screen `'manage'`; store `manageTab: ManageTab` + `setManageTab(tab)`; `ManageTab = 'brands' | 'outlets' | 'staff' | 'tasks'`; `Manage` screen component.

- [ ] **Step 1: `store.tsx` — Screen union, manageTab state + action**

- Line 11: `export type Screen = 'dashboard' | 'visits' | 'manage'`
- Add below the other view types: `export type ManageTab = 'brands' | 'outlets' | 'staff' | 'tasks'`
- In `AppState` (after `activeScreen`): `manageTab: ManageTab`
- In `seed()`: `manageTab: 'brands',`
- In `StoreActions`: `setManageTab(tab: ManageTab): void`
- In `actions`: `setManageTab: (manageTab) => patch({ manageTab }),`

- [ ] **Step 2: `nav.ts` — 3 nav items + 3 titles**

```ts
export const NAV: NavDef[] = [
  { key: 'dashboard', label: 'Dashboard', short: 'Home', icon: 'space_dashboard' },
  { key: 'visits', label: 'Visits', short: 'Visits', icon: 'fact_check' },
  { key: 'manage', label: 'Manage', short: 'Manage', icon: 'tune' },
]

export const TITLES: Record<Screen, [string, string]> = {
  dashboard: ['Summary', 'Year & month visit overview'],
  visits: ['Visits', 'Scheduled store visits & checks'],
  manage: ['Manage', 'Brands, outlets, staff & visit tasks'],
}
```

- [ ] **Step 3: Create `src/screens/Manage.tsx`**

```tsx
import { useStore, type ManageTab } from '../data/store'
import { chip } from '../theme'
import { Brands } from './Brands'
import { Outlets } from './Outlets'
import { Staff } from './Staff'

const TABS: [ManageTab, string][] = [
  ['brands', 'Brands'],
  ['outlets', 'Outlets'],
  ['staff', 'Staff'],
  ['tasks', 'Tasks'],
]

export function Manage() {
  const { state, setManageTab } = useStore()
  const tab = state.manageTab

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setManageTab(k)} style={chip(tab === k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'brands' && <Brands />}
      {tab === 'outlets' && <Outlets />}
      {tab === 'staff' && <Staff />}
      {tab === 'tasks' && (
        <div style={{ padding: 28, textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
          Task library — coming up next.
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: `App.tsx` — swap imports + switch to the 3 screens**

Remove the `Brands`, `Outlets`, `Staff` imports; add `import { Manage } from './screens/Manage'`. Replace the screen switch block with:

```tsx
              {state.activeScreen === 'dashboard' && <Dashboard />}
              {state.activeScreen === 'visits' && <Visits />}
              {state.activeScreen === 'manage' && <Manage />}
```

- [ ] **Step 5: Build, test**

Run: `npm run build && npm test`
Expected: green. (`Brands`/`Outlets`/`Staff` are now imported by `Manage`, not `App`; no unused-import errors.)

- [ ] **Step 6: Manual check**

Run: `npm run dev`. Verify: 3 top-level nav items (desktop sidebar + mobile bottom nav); Manage shows a tab bar; switching tabs swaps Brands/Outlets/Staff bodies; Tasks tab shows the placeholder; the overdue badge appears on Visits.

- [ ] **Step 7: Commit**

```bash
git add -A
git -c user.email=cch340@gmail.com commit -m "feat: consolidate brands/outlets/staff/tasks under a Manage nav item"
```

---

## W1 — Reusable task library + one-time tasks

### Task 4: `task_templates` table + data layer

**Files:**
- Create: `supabase/migrations/0005_task_templates.sql`
- Modify: `src/data/model.ts`, `src/data/queries/mappers.ts`, `src/data/queries/keys.ts`, `src/data/queries/useData.ts`
- Create: `src/data/queries/useTaskTemplateMutations.ts`

**Interfaces:**
- Produces: `TaskTemplate { id; label; sort }`; `TaskTemplateRow`/`rowToTaskTemplate`; `queryKeys.taskTemplates`; `DataSnapshot.taskTemplates: TaskTemplate[]`; mutations `useCreateTaskTemplate({ label, sort })`, `useRenameTaskTemplate({ id, label })`, `useDeleteTaskTemplate({ id })`, `useReorderTaskTemplates({ ids })`. The DB `owner_id` column is set by its default and never appears in these signatures.

- [ ] **Step 1: Create the migration**

The table follows the per-user scoping pattern established in `0003_per_user_scoping.sql`: an `owner_id` column defaulting to `auth.uid()` plus a per-user `"owner access"` policy. The client code (mapper, mutations below) does NOT reference `owner_id` — the DB fills it.

```sql
-- 0005_task_templates.sql
-- Reusable visit-task templates shown in the schedule modal. Per-user scoped
-- (owner_id defaults to auth.uid()), matching every other table after
-- 0003_per_user_scoping.sql. Starts empty (no seed rows).
-- Apply AFTER 0004_rename_visits.sql in the Supabase SQL editor.

create table task_templates (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  sort       int  not null default 0,
  created_at timestamptz not null default now(),
  owner_id   uuid not null references auth.users(id) on delete cascade default auth.uid()
);

alter table task_templates enable row level security;
create policy "owner access" on task_templates
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
```

- [ ] **Step 2: `model.ts` — add `TaskTemplate`, remove `DEFAULT_TASKS`**

Add:

```ts
export interface TaskTemplate {
  id: string
  label: string
  sort: number
}
```

Delete the `DEFAULT_TASKS` const (lines 59–66) and its leading comment. (Its last consumer, `ScheduleModal`, is rewritten in Task 6 — which is committed together with this is NOT required; build stays green because Task 6 follows. To keep THIS task green, keep `DEFAULT_TASKS` and remove it in Task 6 instead.)

> DECISION: Remove `DEFAULT_TASKS` in **Task 6** (where its consumer changes), not here, so this task builds green. In this step, only **add** `TaskTemplate`.

- [ ] **Step 3: `mappers.ts` — add the template row + mapper**

```ts
export interface TaskTemplateRow {
  id: string
  label: string
  sort: number
}

export const rowToTaskTemplate = (r: TaskTemplateRow): TaskTemplate => ({
  id: r.id,
  label: r.label,
  sort: r.sort,
})
```

Add `TaskTemplate` to the `import type { ... } from '../model'` line.

- [ ] **Step 4: `keys.ts` — add the key**

Add `taskTemplates: ['taskTemplates'] as const,` to `queryKeys`.

- [ ] **Step 5: `useData.ts` — fetch templates, add to snapshot**

Add `TaskTemplate` to the model import and `rowToTaskTemplate` to the mappers import. Add `taskTemplates: TaskTemplate[]` to `DataSnapshot`. Add:

```ts
async function fetchTaskTemplates(): Promise<TaskTemplate[]> {
  const { data, error } = await supabase.from('task_templates').select('*').order('sort')
  if (error) throw error
  return data.map(rowToTaskTemplate)
}
```

In `useData()`:

```ts
  const taskTemplates = useQuery({ queryKey: queryKeys.taskTemplates, queryFn: fetchTaskTemplates })

  const queries = [brands, outlets, stores, staff, visits, taskTemplates]
```

and add `taskTemplates: taskTemplates.data ?? [],` to the returned `data`.

- [ ] **Step 6: Create `src/data/queries/useTaskTemplateMutations.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from './keys'

export function useCreateTaskTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { label: string; sort: number }) => {
      const { error } = await supabase
        .from('task_templates')
        .insert({ label: input.label, sort: input.sort })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.taskTemplates }),
  })
}

export function useRenameTaskTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; label: string }) => {
      const { error } = await supabase
        .from('task_templates')
        .update({ label: input.label })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.taskTemplates }),
  })
}

export function useDeleteTaskTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string }) => {
      const { error } = await supabase.from('task_templates').delete().eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.taskTemplates }),
  })
}

export function useReorderTaskTemplates() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { ids: string[] }) => {
      // Persist new order by writing each row's index as its sort value.
      for (let i = 0; i < input.ids.length; i++) {
        const { error } = await supabase
          .from('task_templates')
          .update({ sort: i })
          .eq('id', input.ids[i])
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.taskTemplates }),
  })
}
```

- [ ] **Step 7: Build, test**

Run: `npm run build && npm test`
Expected: green (`DEFAULT_TASKS` still present, still used by `ScheduleModal`).

- [ ] **Step 8: Commit**

```bash
git add -A
git -c user.email=cch340@gmail.com commit -m "feat: add task_templates table, model, and mutations"
```

---

### Task 5: `scheduleTasks` pure logic module (TDD)

**Files:**
- Create: `src/data/queries/scheduleTasks.ts`
- Test: `src/data/queries/scheduleTasks.test.ts`

**Interfaces:**
- Produces:
  - `interface ScheduleTaskItem { key: string; label: string; checked: boolean; templateId?: string; saveAsTemplate?: boolean }`
  - `itemsFromTemplates(templates: { id: string; label: string }[]): ScheduleTaskItem[]` — one item per template, `checked: true`, `key`/`templateId` = template id.
  - `interface SchedulePlan { taskLabels: string[]; newTemplateLabels: string[] }`
  - `planSchedule(items: ScheduleTaskItem[], existing: { label: string }[]): SchedulePlan` — `taskLabels` = trimmed labels of checked, non-empty items; `newTemplateLabels` = trimmed labels of items with `saveAsTemplate && !templateId && non-empty`, de-duped case-insensitively against `existing` and against each other.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/queries/scheduleTasks.test.ts`
Expected: FAIL — `scheduleTasks` module not found.

- [ ] **Step 3: Implement `scheduleTasks.ts`**

```ts
export interface ScheduleTaskItem {
  key: string
  label: string
  checked: boolean
  templateId?: string
  saveAsTemplate?: boolean
}

export interface SchedulePlan {
  taskLabels: string[]
  newTemplateLabels: string[]
}

export function itemsFromTemplates(
  templates: { id: string; label: string }[],
): ScheduleTaskItem[] {
  return templates.map((t) => ({
    key: t.id,
    label: t.label,
    checked: true,
    templateId: t.id,
  }))
}

export function planSchedule(
  items: ScheduleTaskItem[],
  existing: { label: string }[],
): SchedulePlan {
  const taskLabels: string[] = []
  const newTemplateLabels: string[] = []
  const seen = new Set(existing.map((t) => t.label.trim().toLowerCase()))

  for (const it of items) {
    const label = it.label.trim()
    if (!label) continue
    if (it.checked) taskLabels.push(label)
    if (it.saveAsTemplate && !it.templateId) {
      const norm = label.toLowerCase()
      if (!seen.has(norm)) {
        seen.add(norm)
        newTemplateLabels.push(label)
      }
    }
  }
  return { taskLabels, newTemplateLabels }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/queries/scheduleTasks.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/data/queries/scheduleTasks.ts src/data/queries/scheduleTasks.test.ts
git -c user.email=cch340@gmail.com commit -m "feat: add scheduleTasks pure module with tests"
```

---

### Task 6: Dynamic schedule-modal checklist

Replace `addForm.tasks: boolean[]` with `ScheduleTaskItem[]`, seed from templates (all ticked), support inline add + "save for future", and submit via `planSchedule`.

**Files:**
- Modify: `src/data/store.tsx`, `src/data/model.ts`, `src/components/ScheduleModal.tsx`

**Interfaces:**
- Consumes: `itemsFromTemplates`, `planSchedule`, `ScheduleTaskItem` (Task 5); `useCreateVisit` (W3); `useCreateTaskTemplate` (Task 4); `data.taskTemplates` (Task 4).
- Produces: `AddForm.tasks: ScheduleTaskItem[]`.

- [ ] **Step 1: `store.tsx` — retype `AddForm.tasks`, drop `toggleAfTask`, empty seed**

- Add import at top: `import type { ScheduleTaskItem } from './queries/scheduleTasks'`
- In `AddForm`: `tasks: boolean[]` → `tasks: ScheduleTaskItem[]`
- In `openAdd`: `tasks: [true, true, true, false, false]` → `tasks: []`
- Remove `toggleAfTask(i: number): void` from `StoreActions` and the `toggleAfTask` implementation in `actions`. (The modal now manages the list via `setAf('tasks', ...)`.)

- [ ] **Step 2: `model.ts` — remove `DEFAULT_TASKS`**

Delete the `DEFAULT_TASKS` const and its leading comment (now unused).

- [ ] **Step 3: Rewrite `ScheduleModal.tsx`**

Full new file:

```tsx
import { useEffect, useState, type CSSProperties } from 'react'
import { useStore } from '../data/store'
import { useData } from '../data/queries/useData'
import { brandById, outletById } from '../data/derived'
import { chip } from '../theme'
import { Icon } from './Icon'
import { useCreateVisit } from '../data/queries/useVisitMutations'
import { useCreateTaskTemplate } from '../data/queries/useTaskTemplateMutations'
import { itemsFromTemplates, planSchedule, type ScheduleTaskItem } from '../data/queries/scheduleTasks'

const fieldLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: 'var(--dim)',
  marginBottom: 9,
}

const FULL_WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const weekdayOf = (iso: string) => (iso ? FULL_WD[new Date(iso + 'T00:00:00').getDay()] : '')

export function ScheduleModal() {
  const { state, closeAdd, setAf } = useStore()
  const create = useCreateVisit()
  const createTemplate = useCreateTaskTemplate()
  const { data } = useData()
  const [newLabel, setNewLabel] = useState('')
  const S = state

  // Seed the checklist from the saved templates (all ticked) each time the modal opens.
  useEffect(() => {
    if (S.addOpen) setAf('tasks', itemsFromTemplates(data.taskTemplates))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S.addOpen])

  if (!S.addOpen || !S.addForm) return null

  const af = S.addForm
  const items = af.tasks
  const selN = items.filter((t) => t.checked).length
  const [sb, so] = af.storeKey.split('|')
  const bName = brandById(data, sb)?.name ?? '—'
  const oName = outletById(data, so)?.name ?? '—'
  const summary = `${bName} · ${oName} · ${selN} tasks`
  const ovPos = S.isMobile ? 'absolute' : 'fixed'
  const dayName = weekdayOf(af.date)

  const setItems = (next: ScheduleTaskItem[]) => setAf('tasks', next)
  const toggle = (key: string) =>
    setItems(items.map((t) => (t.key === key ? { ...t, checked: !t.checked } : t)))
  const toggleSave = (key: string) =>
    setItems(items.map((t) => (t.key === key ? { ...t, saveAsTemplate: !t.saveAsTemplate } : t)))
  const remove = (key: string) => setItems(items.filter((t) => t.key !== key))
  const addItem = () => {
    const label = newLabel.trim()
    if (!label) return
    const key = `new-${label.toLowerCase()}-${items.length}`
    setItems([...items, { key, label, checked: true, saveAsTemplate: false }])
    setNewLabel('')
  }

  const submit = () => {
    const [b, o] = af.storeKey.split('|')
    if (!b || !o) return
    const plan = planSchedule(items, data.taskTemplates)
    create.mutate(
      { brandId: b, outletId: o, staffId: af.staffId || null, date: af.date, taskLabels: plan.taskLabels },
      {
        onSuccess: () => {
          plan.newTemplateLabels.forEach((label, i) =>
            createTemplate.mutate({ label, sort: data.taskTemplates.length + i }),
          )
          closeAdd()
        },
        onError: (e) => alert(e.message),
      },
    )
  }

  return (
    <div
      onClick={closeAdd}
      style={{ position: ovPos, inset: 0, zIndex: 60, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: '100%',
          maxHeight: '92vh',
          overflow: 'auto',
          background: 'var(--surface)',
          borderRadius: 14,
          boxShadow: '0 30px 80px rgba(0,0,0,.3)',
          animation: 'pop .18s ease',
        }}
      >
        {/* header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Schedule a visit</div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>Plan a store visit and the checks to perform</div>
          </div>
          <button onClick={closeAdd} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)' }}>
            <Icon name="close" size={22} />
          </button>
        </div>

        {/* body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={fieldLabel}>Store (brand · outlet)</div>
            {data.stores.length === 0 && (
              <div
                style={{
                  border: '1px dashed var(--border)',
                  borderRadius: 9,
                  padding: '12px 14px',
                  fontSize: 13,
                  color: 'var(--dim)',
                  lineHeight: 1.5,
                }}
              >
                No stores yet. A store is a brand linked to an outlet — go to{' '}
                <strong style={{ color: 'var(--text)' }}>Manage → Brands</strong>, edit a brand, and tick the
                outlet it operates in under <strong style={{ color: 'var(--text)' }}>Operates in outlets</strong>.
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.stores.map((s) => {
                const b = brandById(data, s.brandId)
                const o = outletById(data, s.outletId)
                const key = `${s.brandId}|${s.outletId}`
                return (
                  <button key={key} onClick={() => setAf('storeKey', key)} style={chip(af.storeKey === key)}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: b.color }} />
                    {b.name} · {o.name}
                  </button>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={fieldLabel}>Scheduled date</div>
              <input
                type="date"
                value={af.date}
                onChange={(e) => setAf('date', e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontFamily: "'IBM Plex Sans'",
                  fontSize: 13,
                  color: 'var(--text)',
                }}
              />
              {dayName && <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 6 }}>{dayName}</div>}
            </div>
          </div>
          <div>
            <div style={fieldLabel}>Tasks to check</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((t) => (
                <div
                  key={t.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    borderRadius: 9,
                    padding: '10px 13px',
                  }}
                >
                  <button
                    onClick={() => toggle(t.key)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1.5px solid ${t.checked ? 'var(--accent)' : 'var(--border)'}`,
                        background: t.checked ? 'var(--accent)' : 'transparent',
                      }}
                    >
                      {t.checked && <Icon name="check" size={15} color="#fff" />}
                    </span>
                    <span style={{ fontSize: 13.5, color: 'var(--text)' }}>{t.label}</span>
                  </button>
                  {!t.templateId && (
                    <button
                      onClick={() => toggleSave(t.key)}
                      title={t.saveAsTemplate ? 'Will be saved for future visits' : 'Save for future use'}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: t.saveAsTemplate ? 'var(--accent)' : 'var(--dim)',
                      }}
                    >
                      <Icon name={t.saveAsTemplate ? 'bookmark_added' : 'bookmark_add'} size={17} />
                      Save
                    </button>
                  )}
                  <button onClick={() => remove(t.key)} title="Remove" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dim)', padding: 2 }}>
                    <Icon name="close" size={18} />
                  </button>
                </div>
              ))}
              {items.length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--dim)', padding: '2px 2px' }}>
                  No tasks yet — add one below, or create reusable tasks in Manage → Tasks.
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addItem()
                    }
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
                  onClick={addItem}
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
            </div>
          </div>
        </div>

        {/* footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>{summary}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={closeAdd}
              style={{
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                borderRadius: 9,
                padding: '10px 18px',
                fontFamily: "'IBM Plex Sans'",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              style={{
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 9,
                padding: '10px 18px',
                fontFamily: "'IBM Plex Sans'",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Build, test**

Run: `npm run build && npm test`
Expected: green. No remaining `DEFAULT_TASKS` or `toggleAfTask` references (`grep -rn "DEFAULT_TASKS\|toggleAfTask" src` returns nothing).

- [ ] **Step 5: Manual check**

`npm run dev`. With at least one template created (or none): open the schedule modal → templates appear all ticked; type a task + Add → appears ticked; toggle its "Save"; pick a store + date; Schedule. Re-open: a saved task now appears as a template row (no Save button); a non-saved one does not.

- [ ] **Step 6: Commit**

```bash
git add -A
git -c user.email=cch340@gmail.com commit -m "feat: dynamic schedule-modal checklist with template + one-time tasks"
```

---

### Task 7: Tasks management panel (Manage → Tasks)

**Files:**
- Create: `src/components/TaskTemplatesPanel.tsx`
- Modify: `src/screens/Manage.tsx`

**Interfaces:**
- Consumes: `data.taskTemplates` (Task 4); `useCreateTaskTemplate`, `useRenameTaskTemplate`, `useDeleteTaskTemplate`, `useReorderTaskTemplates` (Task 4).
- Produces: `TaskTemplatesPanel` component.

- [ ] **Step 1: Create `src/components/TaskTemplatesPanel.tsx`**

```tsx
import { useState } from 'react'
import { useData } from '../data/queries/useData'
import { card } from '../theme'
import { Icon } from './Icon'
import {
  useCreateTaskTemplate,
  useRenameTaskTemplate,
  useDeleteTaskTemplate,
  useReorderTaskTemplates,
} from '../data/queries/useTaskTemplateMutations'

export function TaskTemplatesPanel() {
  const { data } = useData()
  const createT = useCreateTaskTemplate()
  const renameT = useRenameTaskTemplate()
  const deleteT = useDeleteTaskTemplate()
  const reorderT = useReorderTaskTemplates()
  const [newLabel, setNewLabel] = useState('')

  const templates = data.taskTemplates
  const ids = templates.map((t) => t.id)

  const add = () => {
    const label = newLabel.trim()
    if (!label) return
    createT.mutate({ label, sort: templates.length }, { onError: (e) => alert(e.message) })
    setNewLabel('')
  }

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    const next = ids.slice()
    ;[next[index], next[j]] = [next[j], next[index]]
    reorderT.mutate({ ids: next }, { onError: (e) => alert(e.message) })
  }

  const inputStyle = {
    border: '1px solid var(--border)',
    background: 'var(--surface2)',
    borderRadius: 8,
    padding: '9px 12px',
    fontFamily: "'IBM Plex Sans'",
    fontSize: 13,
    color: 'var(--text)',
  } as const
  const iconBtn = {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: 'var(--dim)',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
  } as const

  return (
    <div style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Visit tasks</div>
        <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2 }}>
          Reusable checks shown (all ticked) when scheduling a visit.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="New task…"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={add}
          style={{
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {templates.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--dim)', padding: '4px 2px' }}>
            No tasks yet. Add your first reusable check above.
          </div>
        )}
        {templates.map((t, i) => (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              borderRadius: 9,
              padding: '8px 10px 8px 12px',
            }}
          >
            <input
              defaultValue={t.label}
              onBlur={(e) => {
                const label = e.target.value.trim()
                if (label && label !== t.label) renameT.mutate({ id: t.id, label }, { onError: (err) => alert(err.message) })
                else e.target.value = t.label
              }}
              style={{ ...inputStyle, flex: 1, background: 'transparent', border: '1px solid transparent' }}
            />
            <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up" style={{ ...iconBtn, opacity: i === 0 ? 0.3 : 1 }}>
              <Icon name="arrow_upward" size={18} />
            </button>
            <button onClick={() => move(i, 1)} disabled={i === templates.length - 1} title="Move down" style={{ ...iconBtn, opacity: i === templates.length - 1 ? 0.3 : 1 }}>
              <Icon name="arrow_downward" size={18} />
            </button>
            <button
              onClick={() => deleteT.mutate({ id: t.id }, { onError: (err) => alert(err.message) })}
              title="Delete"
              style={{ ...iconBtn, color: '#dc2626' }}
            >
              <Icon name="delete" size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into `Manage.tsx`**

Add `import { TaskTemplatesPanel } from '../components/TaskTemplatesPanel'`. Replace the Tasks-tab placeholder block:

```tsx
      {tab === 'tasks' && <TaskTemplatesPanel />}
```

- [ ] **Step 3: Build, test**

Run: `npm run build && npm test`
Expected: green.

- [ ] **Step 4: Manual check**

`npm run dev` → Manage → Tasks: add tasks, rename one (blur to save), reorder with arrows, delete one. Confirm the schedule modal reflects the same list (all ticked, in the same order).

- [ ] **Step 5: Commit**

```bash
git add -A
git -c user.email=cch340@gmail.com commit -m "feat: task library management panel under Manage → Tasks"
```

---

## W4 — Show the weekday

### Task 8: Add the weekday to formatted dates (TDD)

**Files:**
- Modify: `src/data/derived.ts`
- Test: `src/data/derived.test.ts` (create)

The schedule modal already shows the full weekday beside the date picker (added in Task 6). This task adds the short weekday to every formatted `dateLabel` (dashboard, visits list, drawer) by changing `fmt`.

**Interfaces:**
- Produces: `fmt(iso)` returns `"<Weekday>, DD Mon YYYY"`, e.g. `"Mon, 29 Jun 2026"`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { fmt } from './derived'

describe('fmt', () => {
  it('prefixes the short weekday to the date', () => {
    // 2026-06-29 is a Monday.
    expect(fmt('2026-06-29')).toBe('Mon, 29 Jun 2026')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/derived.test.ts`
Expected: FAIL — current `fmt` returns `"29 Jun 2026"` (no weekday).

- [ ] **Step 3: Update `fmt`**

Replace the `fmt` definition (lines 10–11) with:

```ts
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const fmt = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  const rest = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  return `${WEEKDAY[d.getDay()]}, ${rest}`
}
```

(The weekday is computed from `getDay()` rather than `Intl` so the format is deterministic across environments; `rest` keeps the existing, already-trusted `en-GB` formatting.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/derived.test.ts`
Expected: PASS.

- [ ] **Step 5: Build + full test run**

Run: `npm run build && npm test`
Expected: green.

- [ ] **Step 6: Manual check**

`npm run dev`: date labels in the Visits list, Visit drawer header, and dashboard attention lists now read e.g. "Mon, 29 Jun 2026". The schedule modal shows the full weekday under the date picker.

- [ ] **Step 7: Commit**

```bash
git add -A
git -c user.email=cch340@gmail.com commit -m "feat: show weekday on formatted visit dates"
```

---

## Self-Review

**Spec coverage:**
- W1 req #1 (reusable tasks replace hardcoded list) → Tasks 4, 6, 7 (table + modal seeding + management panel); `DEFAULT_TASKS` removed in Task 6.
- W1 req #2 (one-time task in modal) → Task 6 inline "Add a task…" with no "Save", partitioned by `planSchedule` (Task 5).
- W1 req #3 (all ticked by default) → `itemsFromTemplates` sets `checked: true` (Task 5); inline adds default `checked: true` (Task 6).
- W4 req #4 (show weekday) → modal hint (Task 6) + `fmt` weekday everywhere (Task 8).
- W2 (Manage nav) → Task 3; Tasks tab filled in Task 7.
- W3 (rename incl. DB) → Tasks 1–2.

**Placeholder scan:** The only intentional temporary is the Tasks-tab placeholder string in Task 3, explicitly replaced in Task 7 Step 2 — not a plan gap. No "TBD"/"handle edge cases" left.

**Type consistency:** `ScheduleTaskItem`/`SchedulePlan`/`itemsFromTemplates`/`planSchedule` (Task 5) match their use in Task 6. Mutation input fields are consistent: `useMarkVisitDone({ visitId })`, `useToggleVisitStatus({ visitId, status })`, `useCreateTaskTemplate({ label, sort })`, `useReorderTaskTemplates({ ids })`. `DataSnapshot.visits`/`.taskTemplates`, `queryKeys.visits`/`.taskTemplates`, and store `visitFilter`/`openVisitId`/`manageTab` are used consistently across tasks.
