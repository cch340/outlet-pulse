# Add task to existing visits — design

## Problem

Users sometimes create visits first, then later add a new task template in
Manage → Visit Tasks. The newly created template does not appear in the visits
that already exist. Today the only way to backfill is to open each visit and use
the in-drawer "Import from saved tasks" flow one visit at a time.

This feature provides the inverse of that import flow: from the Visit Tasks
panel, push a single task template into many existing visits at once.

## Scope

- Entry point: a per-row button in `TaskTemplatesPanel` (Manage → Tasks).
- A modal that lists every visit that does **not** already have a task with this
  label (case-insensitive, trimmed match), sorted newest date first.
- Multi-select with a select-all/deselect-all checkbox.
- Each visit row shows: date, store ("Brand · Outlet"), and staff name.
- An "Add to N visits" action that inserts the task into all selected visits.

Out of scope: editing/removing tasks across visits, filtering by visit status
(all visits missing the task are eligible, including completed/past ones).

## UI

### TaskTemplatesPanel row

Each template row gains a small action button (icon + label, styled like the
existing row controls) that opens the modal scoped to that template's label.

### AddTaskToVisitsModal

- Title references the task label, e.g. `Add "Restock shelves" to visits`.
- Body:
  - Empty state when no eligible visits: "All visits already have this task."
  - Select-all checkbox row (checked when every eligible visit is selected;
    clicking toggles between none and all).
  - One row per eligible visit, each with a 20×20 styled checkbox (matching the
    existing import/schedule checkbox pattern) and three pieces of info:
    - date (formatted as elsewhere in the app)
    - store: `Brand · Outlet`
    - staff: staff name, or "Unassigned" when `staffId` is null
- Footer: "Add to N visits" button, disabled when nothing is selected. On
  success the modal closes.

Follows the existing modal/checkbox visual pattern (ScheduleModal,
VisitDrawer import panel): button-based checkboxes, `surface2` container,
`var(--border)` borders, check icon at 14px.

## Data layer

New mutation in `src/data/queries/useVisitMutations.ts`:

```
useAddTaskToVisits({ label, visitIds: string[] })
```

For each visit id: compute the next `sort` (max existing `sort` for that visit
+ 1) and insert a `visit_tasks` row with the given `label`, `status: 'pending'`,
`remark: ''`. Invalidate `queryKeys.visits` on success.

Mirrors `useImportVisitTasks` but fans out across multiple visits for a single
label instead of multiple labels into one visit.

## Pure logic + test

Per repo convention, the eligibility filter is extracted into a pure helper in
`src/data/queries/visitEdit.ts` with a `.test.ts`:

```
eligibleVisitsForLabel(visits: Visit[], label: string): Visit[]
```

Returns visits whose tasks do not already contain `label` (case-insensitive,
trimmed), reusing the same matching approach as `importableTemplates`. Ordering
(newest-first) is applied in the component using existing date sorting; the
helper only filters.

Tests cover: visit already containing the label (excluded), case/whitespace
differences (still treated as duplicate → excluded), visit missing the label
(included), empty visit list.

## State

Modal open state and the target template are tracked locally in
`TaskTemplatesPanel` (`useState`). No domain data is held in UI state; the visit
list is derived from the `DataSnapshot` at render time.
