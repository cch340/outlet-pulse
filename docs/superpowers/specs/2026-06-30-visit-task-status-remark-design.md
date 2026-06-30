# Visit checklist enhancement: per-task status + remark, derived visit status

**Date:** 2026-06-30
**Status:** Approved (design)

## Summary

Enrich the visit checklist so each task carries a **3-state status** (`pending` / `failed` / `success`) and a free-text **remark**, replacing today's single `done: boolean`. The **visit status becomes fully derived** from its tasks (no longer a manually-toggled stored column), gaining an **"attention required"** state in addition to pending/done. The user sets each task's status via a color-coded segmented control and can resolve a whole checklist with a "Mark all success" shortcut.

## Goals

- A task has a status of `pending`, `failed`, or `success` (was: `done` boolean).
- A task has an optional, always-available free-text remark.
- Visit status is derived from task statuses with a new `attention` state.
- Per-task status is set from a segmented control rendered **below** the task label, conveying state by **color** (with a small assistive glyph), so it stays compact on mobile.
- A "Mark all success" shortcut (list + drawer) sets all *pending* tasks to success.
- A visit cannot be created with zero tasks — creation is blocked in the schedule modal.

## Non-goals

- No server-side / SQL reporting infrastructure now. Reports are expected to be in-app, computed over already-loaded data, as a later feature. A SQL view or trigger-maintained column is documented below as a non-breaking future option but is **not** built now.
- No manual override of visit status. Status always reflects the tasks.
- No change to scheduling/template flows beyond inserting tasks with `status:'pending'` and blocking zero-task creation (see Validation).

## Status rules (the core state machine)

### Visit status from its tasks — "pending wins"

```
visitBaseStatus(tasks):
  total === 0                       → 'pending'    # defensive only — new visits can't be empty
  any task.status === 'pending'     → 'pending'    # pending takes precedence over failures
  any task.status === 'failed'      → 'attention'  # no pending left, at least one failed
  else (all success)                → 'done'
```

Precedence decision (confirmed): when a checklist contains **both** a still-pending task and a failed task, the visit is **`pending`**. A failure only surfaces as `attention` once no task is left un-acted-on. Zero-task visits are **prevented at creation** (see Validation); the `total === 0 → pending` branch is kept only as a defensive fallback so the derived function never crashes on a legacy/edge row.

### Layering the date (overdue)

`DerivedStatus = 'done' | 'pending' | 'overdue' | 'attention'`

- base `pending` + date before today → `overdue`
- base `pending` + date today/future → `pending`
- `attention` and `done` ignore the date (an `attention` visit stays `attention` even if late).

This mirrors today's rule (`overdue` = a pending visit past its date); only the base status now comes from tasks instead of a stored column.

### Colors & labels

| Derived status | Color | Label |
|---|---|---|
| done | `#16a34a` (green) | Done |
| pending | `#d97706` (amber) | Pending |
| overdue | `#ea580c` (orange) | Overdue |
| attention | `#dc2626` (red) | Attention required |

`overdue` shifts from today's `#dc2626` to `#ea580c` so it doesn't collide with the new `attention` red. Labels come from an explicit map (the old `capitalize` trick can't produce "Attention required").

Task-status colors (segmented control): `pending` = neutral/dim, `failed` = `#dc2626`, `success` = `#16a34a`.

## Data model (`src/data/model.ts`)

```ts
export type TaskStatus = 'pending' | 'failed' | 'success'

export interface Task {
  id?: string
  label: string
  status: TaskStatus   // replaces `done: boolean`
  remark: string       // new; '' when empty
}
```

`Visit` **loses its `status` field** — visit status is derived only, never stored on the domain object. `tasks: Task[]` is unchanged otherwise. The `VisitStatus` type (`'done' | 'pending'`) is removed from the model; the derived union lives in `derived.ts`.

## Derived layer (`src/data/derived.ts`)

- New pure function `visitBaseStatus(tasks): VisitBaseStatus` (`'pending' | 'attention' | 'done'`) implementing the state machine above, plus a `visitStatus(f: Visit)` convenience wrapper (`visitBaseStatus(f.tasks)`). These are the canonical base-status source for every consumer (Visits list, Dashboard).
- `isOverdue` reworked to use the base status (`visitStatus(f) === 'pending' && date < today`) instead of `f.status`.
- `DerivedStatus` gains `'attention'`.
- `STATUS_COLOR` gains `attention` and updates `overdue` per the table.
- New explicit `STATUS_LABEL` map.
- `visitVM` exposes counts for the progress bar:
  - `successT`, `failedT`, `pendingT`, `resolvedT` (= `successT + failedT`), `total`
  - `progressPct = total ? round(resolvedT / total * 100) : 0` ("resolved" fraction)
  - (the old `doneT` is replaced by these; update consumers — the list and drawer show `resolvedT/total`)

## Database

### Migration `supabase/migrations/0006_task_status_remark.sql`

```sql
-- 0006_task_status_remark.sql
-- Per-task 3-state status + free-text remark, replacing the done boolean.
-- Apply AFTER 0005_task_templates.sql in the Supabase SQL editor.

alter table visit_tasks
  add column status text not null default 'pending'
  check (status in ('pending','failed','success'));

update visit_tasks set status = case when done then 'success' else 'pending' end;

alter table visit_tasks add column remark text not null default '';

alter table visit_tasks drop column done;
```

The `visits` table is **untouched**. Its `status` column stays at its `'pending'` default and is ignored by the app (Approach A — see below). No data is wiped; existing `done=true` tasks migrate to `success`, `done=false` to `pending`.

### Approach A: derive in the app, leave the `visits.status` column dead

Chosen over (B) physically dropping `visits.status` — an unnecessary destructive change — and (C) keeping it stored & re-synced on every task change, which reintroduces the two-source-of-truth problem. Approach A is the smallest, safest migration and matches how the app already derives `overdue` client-side.

### Future option (NOT built now): server-side status for reporting

If in-app reporting ever needs server-side aggregation (`GROUP BY status` in SQL, or an external BI tool), add **one** of these later without touching client logic:

- **SQL view** `visit_status_v` computing each visit's status from `visit_tasks` via `CASE`/aggregate. Always consistent, nothing to keep in sync.
- **Trigger-maintained `visits.status`** recomputed on task insert/update/delete. Indexed `GROUP BY` is then trivial; still auto-derived (no manual override).

Both are non-breaking additions; the spec records them so the choice is documented, not implied.

## Mappers (`src/data/queries/mappers.ts`)

- `TaskRow`: drop `done`; add `status: TaskStatus` and `remark: string`.
- `rowToTask`: `{ id, label, status, remark }`.
- `rowToVisit`: stop reading `status` from the row (it's no longer on the domain `Visit`). Task sort by the `sort` column is unchanged.
- `VisitRow.status` is no longer mapped onto the domain object (the select can keep `*`; the field is simply ignored).

## Mutations (`src/data/queries/useVisitMutations.ts`)

| Old | New | Behavior |
|---|---|---|
| `useToggleTask({ taskId, done })` | `useSetTaskStatus({ taskId, status })` | `update visit_tasks set status=? where id=?` |
| — | `useSetTaskRemark({ taskId, remark })` | `update visit_tasks set remark=? where id=?` |
| `useMarkVisitDone({ visitId })` | `useMarkAllSuccess({ visitId })` | `update visit_tasks set status='success' where visit_id=? and status='pending'` — leaves `failed` tasks failed |
| `useToggleVisitStatus(...)` | **removed** | — |
| `useCreateVisit(...)` | (same name) | inserts tasks with `status:'pending'` (drop `done`); no longer writes `visits.status` |

All mutations continue to `invalidateQueries({ queryKey: queryKeys.visits })` on success. Query keys are unchanged.

## UI

### `src/components/VisitDrawer.tsx` — task row

Each task renders as a stacked card:

```
┌─────────────────────────────────────────┐
│ Restock front display                    │  ← label
│ [   –   |   ✕   |   ✓   ]                 │  ← segmented control (color = state)
│ Add a remark…                            │  ← always-visible remark input
└─────────────────────────────────────────┘
```

- **Segmented control** below the label, full-width. Three segments map to `pending` / `failed` / `success`, shown by **color** (neutral / red / green). The active segment is filled with its color; inactive segments are muted outlines. A small glyph (`–` / `✕` / `✓`) accompanies each so state isn't conveyed by color alone (accessibility + scannability). Tapping a segment calls `useSetTaskStatus`.
- **Remark input** below the control, always visible, single-line, persisted on blur (only when changed) via `useSetTaskRemark`.
- Drawer header keeps the progress bar (now "resolved" = `(successT+failedT)/total`) and the derived status pill (four states).
- **"Mark all success"** button replaces "Mark complete"; **"Reopen visit" is removed**.

### `src/components/ScheduleModal.tsx` — block empty visits

A visit must have at least one task. The modal's **Schedule** submit is **disabled when no tasks are checked** (`planSchedule(...).taskLabels.length === 0`), with a short hint near the button ("Add at least one task"). The `useCreateVisit` mutation also guards defensively — it throws if called with an empty `taskLabels` — so the rule holds even if a caller bypasses the button. (Ad-hoc and template tasks both count; the check is purely on the resulting checked-task count.)

### `src/screens/Visits.tsx` — list

- Progress bar uses the new counts.
- Desktop quick **"Done"** button becomes **"Mark all success"** (calls `useMarkAllSuccess`).
- Filter chips gain an **"Attention"** option (alongside all / pending / overdue / done). "Attention" = derived status `attention`. The `VisitFilter` union in `src/data/store.tsx` gains `'attention'`.
- Status pill renders the four derived states with the colors above.

### `src/screens/Dashboard.tsx` — derive status + surface "Attention" KPI

Dashboard currently reads the now-removed `f.status`. All such reads switch to `visitStatus(f)`:
- `pDone` = `visitStatus(f) === 'done'`; `pPend` = `visitStatus(f) === 'pending'`; `pOver` = `isOverdue(f)` (unchanged); new `pAttn` = `visitStatus(f) === 'attention'`.
- `compRate` = `pDone / periodFus.length` (unchanged formula).
- A new **"Attention"** KPI card is added to the KPI row: value `pAttn`, sub "needs attention", icon `warning`, tone `#dc2626`. (Overdue KPI keeps its own `#ea580c`/`#dc2626` styling — see colors note.)
- Monthly trend chart: the two-segment bar keeps `done` vs the remainder; the "pending" segment becomes "not done" = `total - done` so attention visits are still represented in the bar height. `done` per month = `visitStatus(f) === 'done'`.
- Brand breakdown: `done` per brand = `visitStatus(f) === 'done'` (the `total` denominator is unchanged, so attention visits fall into the not-done remainder).
- `upcomingList` filter switches to `visitStatus(f) === 'pending' && !isOverdue(f)`.

The Overdue KPI icon tone stays red; only the *visit status pill/bar* `overdue` color moves to `#ea580c`. Dashboard KPI accent colors are independent of `STATUS_COLOR` and are left as-is except for the new Attention card.

## Testing

`src/data/derived.test.ts` (new or extended) covers the status state machine as pure-function tests:

- empty checklist → `pending`
- any pending present (even alongside a failed task) → `pending`
- no pending + ≥1 failed → `attention`
- all success → `done`
- overdue layering: base `pending` + past date → `overdue`; `attention`/`done` + past date unchanged
- counts: `successT`/`failedT`/`pendingT`/`progressPct` for a mixed checklist
- defensive: zero tasks → `pending` (never throws)

`scheduleTasks.test.ts` gains a case asserting `planSchedule` yields an empty `taskLabels` when nothing is checked (the condition the modal uses to disable submit).

`scheduleTasks.ts` / `scheduleTasks.test.ts` are unaffected (scheduling still emits task labels; tasks default to `status:'pending'` on insert).

## Touch list (for the plan)

- `supabase/migrations/0006_task_status_remark.sql` (new)
- `src/data/model.ts` — `Task`, `TaskStatus`, remove `Visit.status`/`VisitStatus`
- `src/data/queries/mappers.ts` — `TaskRow`, `rowToTask`, `rowToVisit`
- `src/data/derived.ts` — `visitBaseStatus`, `isOverdue`, `DerivedStatus`, `STATUS_COLOR`, `STATUS_LABEL`, `visitVM` counts
- `src/data/queries/useVisitMutations.ts` — rename/replace mutations; `useCreateVisit` guards against empty `taskLabels`
- `src/components/ScheduleModal.tsx` — disable submit when no tasks checked + hint
- `src/components/VisitDrawer.tsx` — segmented control, remark input, buttons
- `src/screens/Visits.tsx` — counts, "Mark all success", "Attention" filter, pill
- `src/screens/Dashboard.tsx` — derive status via `visitStatus`, add "Attention" KPI
- `src/data/store.tsx` — `VisitFilter` union gains `'attention'`
- `src/data/derived.test.ts` — state-machine tests
- `src/data/queries/mappers.test.ts` — update `rowToVisit` fixture (`status`/`remark` on tasks, drop `done`)
- `src/data/queries/scheduleTasks.test.ts` — add empty-`taskLabels` assertion
- Verify no other consumers of `Task.done`, `Visit.status`, `useToggleTask`, `useMarkVisitDone`, `useToggleVisitStatus`, or `doneT` remain (grep before finishing).
```
