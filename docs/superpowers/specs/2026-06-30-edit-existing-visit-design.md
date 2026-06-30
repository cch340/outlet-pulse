# Edit an existing visit — design

## Problem

A visit's details are fixed once created via `ScheduleModal`. Users need to correct
mistakes (wrong date picked) and adapt to reality (the assigned staff took leave,
the wrong store was chosen, the checklist needs another item) without deleting and
re-creating the visit.

## Scope

From the open visit drawer, the user can edit an existing visit:

- **Store** (brand · outlet)
- **Date**
- **Assigned staff**
- **Checklist tasks** — add or remove

Every change **auto-saves immediately** (matching the drawer's existing behaviour
for task status and remark) and the drawer reflects the refetched data. No edit
mode, no explicit Save button.

Out of scope: bulk editing across visits; editing task labels in place; changing a
task's status/remark (already supported).

## Approach

Inline editing inside `VisitDrawer.tsx`. The drawer is already the place an existing
visit opens and already auto-saves on interaction, so the affordances extend that
pattern rather than introducing a second screen.

## Data / schema

No migration required. The existing tables already carry everything:

- `visits` — `date`, `staff_id` (nullable, `on delete set null`), `brand_id`,
  `outlet_id`.
- `visit_tasks` — `visit_id`, `label`, `status` (`pending`/`failed`/`success`),
  `remark`, `sort`.

## New mutations (`src/data/queries/useVisitMutations.ts`)

Each follows the existing pattern and invalidates `queryKeys.visits` on success.

- `useUpdateVisit` — updates the `visits` row from
  `{ visitId, brandId?, outletId?, staffId?, date? }`. Only provided fields are
  written.
- `useAddVisitTask` — inserts one `visit_tasks` row
  `{ visit_id, label, status: 'pending', remark: '', sort }`.
- `useRemoveVisitTask` — deletes a `visit_tasks` row by `{ taskId }`.

## Drawer changes (`src/components/VisitDrawer.tsx`)

- **Store** — a chip selector over `data.stores` (reusing the `chip()` style from
  `ScheduleModal`). Picking a different store calls `useUpdateVisit` with the new
  `brandId`/`outletId` **and** an `staffId` set to the **first** staff of the new
  store via `staffForStore(data, brandId, outletId)` (or `null` if that store has
  no staff). This mirrors `ScheduleModal`'s "default to first staff" behaviour; the
  user can still reassign afterwards.
- **Date** — the header date becomes a `type="date"` input bound to the visit's
  date; `onChange` calls `useUpdateVisit({ visitId, date })`.
- **Staff** — the "Staff on duty" line becomes a reassign control listing
  `staffForStore(data, brandId, outletId)`. Selecting one calls
  `useUpdateVisit({ visitId, staffId })`. Shows "Unassigned" when `staffId` is null.
- **Checklist** — each task row gains a remove (×) button; a "+ Add task" input row
  at the bottom inserts a new pending task via `useAddVisitTask`. Removing a task
  that **already has a recorded result** (status ≠ `pending`, or a non-empty remark)
  prompts a `confirm()` first; pending tasks with empty remarks remove without a
  prompt.

## Derived / status

Unchanged. `visitVM` already recomputes status, overdue, and resolved/pending counts
from the task list, so moving the date or adding/removing tasks updates the badges
automatically after refetch.

## Pure logic + tests (`src/data/queries/visitEdit.ts` + `visitEdit.test.ts`)

Per repo convention, the non-trivial pure logic is extracted and unit-tested:

1. `nextTaskSort(tasks)` — the `sort` value for a newly added task (current max + 1,
   or 0 when empty).
2. `taskHasResult(task)` — whether a task has a recorded result and therefore needs
   the remove confirmation (`status !== 'pending' || remark.trim() !== ''`).

Mutations and drawer wiring stay thin and follow existing patterns, so they are not
unit-tested (consistent with the rest of the codebase).

## Error handling

Mutation failures surface via the existing `alert(e.message)` pattern used
throughout the drawer.
