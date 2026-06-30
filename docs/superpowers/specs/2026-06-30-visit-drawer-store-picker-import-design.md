# Visit drawer: collapsed store picker + import tasks — design

## Problem

Two usability gaps in the visit drawer's edit affordances (built in the
"edit an existing visit" feature):

1. The store selector renders **every** store as an always-visible chip row,
   which lengthens the drawer header — most of the time the user only needs to
   see the current store.
2. Adding checklist tasks is one-at-a-time typing. Users often want to pull in
   several of their **saved task templates** at once instead of retyping them.

## Scope

Both changes live entirely in `src/components/VisitDrawer.tsx`, plus one new
mutation and one new pure helper. No schema change.

### 1. Collapsed store picker

- Replace the always-visible store chip row with a single **current-store
  button**: brand-color dot + `Brand · Outlet` label + a chevron, styled with
  the existing inline conventions.
- Clicking the button toggles a local `storePickerOpen` flag that reveals the
  existing store chip list directly below it.
- Selecting a store calls the existing `useUpdateVisit` with the new
  `brandId`/`outletId` and `staffId` reset to the first staff of the new store
  (`staffForStore(...)[0]?.id ?? null`) — unchanged from today — then sets
  `storePickerOpen = false`.
- Selecting the already-current store just collapses the picker (no mutation).
- Default (collapsed) state keeps the header compact.

### 2. Import tasks from templates

- Add an **Import** button immediately to the right of the existing **Add**
  button in the add-task row.
- Clicking it toggles a local `importOpen` panel (same inline-expanding style as
  the store picker) listing the **importable templates**: saved task templates
  (`data.taskTemplates`) whose label is not already in this visit's checklist.
  Each row has a checkbox for multi-select, tracked in `selectedImportIds`.
- A footer **"Import N"** button inserts every checked template as a pending
  task via the new `useImportVisitTasks` mutation, then closes the panel and
  clears `selectedImportIds`.
- If there are no importable templates (all already present, or none exist), the
  panel shows a short hint and the Import button is disabled.

## Data / schema

No migration. Uses existing `visit_tasks` (`visit_id`, `label`, `status`,
`remark`, `sort`) and `data.taskTemplates` (`{ id, label, sort }`).

## New mutation (`src/data/queries/useVisitMutations.ts`)

`useImportVisitTasks` — input `{ visitId: string; labels: string[] }`.

- Reads the visit's current max `sort` once (same descending-order/limit-1 read
  as `useAddVisitTask`).
- Inserts all labels in a single `visit_tasks` insert with consecutive sorts
  (`base, base+1, …` where `base = max+1`, or `0` when the visit has no tasks),
  each `status: 'pending'`, `remark: ''`.
- No-op guard: if `labels` is empty, do nothing.
- Invalidates `queryKeys.visits` on success.

A single batched insert (not N calls to `useAddVisitTask`) avoids racing on the
max-sort read.

## New pure helper (`src/data/queries/visitEdit.ts` + test)

`importableTemplates(templates, tasks)` — returns the templates whose label is
not already among the visit's task labels.

- `templates: { id: string; label: string }[]`
- `tasks: { label: string }[]`
- Match is **case-insensitive and trimmed**: a template is excluded when its
  normalized label (`label.trim().toLowerCase()`) equals any task's normalized
  label.
- Returns the surviving templates in input order.

## State (local to `VisitDrawer`)

- `storePickerOpen: boolean`
- `importOpen: boolean`
- `selectedImportIds: string[]`

## Derived / status

Unchanged. `visitVM` recomputes status/counts from the task list, so imported
tasks update the badges automatically after refetch.

## Testing

`importableTemplates` gets unit tests (added to the existing
`visitEdit.test.ts`): excludes an exact-label match; excludes a
case/whitespace-different match; keeps non-matching templates; handles empty
templates and empty tasks. The mutation and the two inline panels are thin
UI/Supabase wiring, untested per codebase convention.

## Error handling

Existing `alert(e.message)` pattern for the import mutation.
