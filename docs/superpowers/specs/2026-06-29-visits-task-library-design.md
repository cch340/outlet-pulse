# Visits & Task Library — Design

Date: 2026-06-29
Status: Approved (pending written-spec review)

## Goal

Enhance the (currently "Follow-up") scheduling feature so users control the checklist
instead of editing code, declutter navigation, and standardise terminology.

Four user requirements drive this:

1. Users can create **reusable tasks** that appear in the schedule modal, replacing the
   hardcoded `DEFAULT_TASKS` list.
2. Users can add a **one-time task** directly in the schedule modal (not saved for reuse).
3. **All tasks are ticked by default** in the schedule modal.
4. The scheduled date also **shows the weekday**.

During brainstorming the scope expanded (user-directed) to include a navigation
reorganisation and a domain rename, because adding a task-management screen is the natural
moment to restructure the nav.

## Decisions (from brainstorming)

- Reusable task library is managed in **both** places: inline in the modal (add + "save for
  future"), and in a **dedicated management screen** for edit/delete/reorder.
- The management screen lives under a new **"Manage"** top-level nav item that also absorbs
  Brands, Outlets, and Staff (keeps the mobile BottomNav lean).
- The library **starts empty** (no migration seeding the old 5 tasks).
- Rename **"Follow-ups" → "Visits"** everywhere, **including the database tables**.

## Scope: four workstreams

Implementation order (each lands independently and is verifiable on its own):
**W3 rename → W2 nav → W1 task library → W4 weekday.**

W3 is done first because it is a pure mechanical refactor; verifying the app still builds and
runs cleanly isolates rename mistakes from the real feature work that follows.

---

## W3 — Rename Follow-ups → Visits (everything, incl. DB)

### Database

New migration `supabase/migrations/0003_rename_visits.sql`, applied manually via the Supabase
SQL editor after the existing migrations. Uses `ALTER TABLE ... RENAME` so existing rows are
preserved:

- `follow_ups` → `visits`
- `follow_up_tasks` → `visit_tasks`
- column `follow_up_tasks.follow_up_id` → `visit_tasks.visit_id`
- Drop and recreate the authenticated-only RLS policies (from `0002_auth_rls.sql`) under the
  new table names. Behaviour is identical (org-wide shared, authenticated-only).

### Code identifiers (rename throughout `src/`)

- Types: `FollowUp`→`Visit`, `FollowUpStatus`→`VisitStatus`, `FollowUpVM`→`VisitVM`,
  `FollowUpRow`→`VisitRow`, `TaskRow` stays but `follow_up_id`→`visit_id`.
- Derived: `fuVM`→`visitVM`.
- Mappers: `rowToFollowUp`→`rowToVisit`; query/select strings reference `visits` /
  `visit_tasks(*)`.
- Mutations file `useFollowUpMutations.ts`→`useVisitMutations.ts`: `useCreateFollowUp`→
  `useCreateVisit`, `useMarkFollowUpDone`→`useMarkVisitDone`, `useToggleFollowUpStatus`→
  `useToggleVisitStatus`, `useToggleTask` stays (operates on `visit_tasks`).
- Query keys: `queryKeys.followups`→`queryKeys.visits`.
- Component: `FollowUpDrawer`→`VisitDrawer` (file + symbol).
- Screen: `Followups.tsx`→`Visits.tsx`, component `Followups`→`Visits`.
- Store/state: `openFuId`→`openVisitId`, `fuFilter`→`visitFilter`, `FuFilter`→`VisitFilter`,
  actions `openFu`/`closeFu`/`setFuFilter`→`openVisit`/`closeVisit`/`setVisitFilter`.
- `Screen` value `'followups'`→`'visits'`.

### User-facing strings → "Visit(s)"

Per the explore map, update at least: `nav.ts` (label + TITLES), `Visits.tsx` empty-state copy,
`Dashboard.tsx` (KPI label, chart titles "… by month/brand", "Overdue visits"),
`ScheduleModal.tsx` ("Schedule a visit", subtitle), `VisitDrawer.tsx` (header "Visit · {date}",
"Reopen visit").

### Verification

`npm run build` (tsc strict) and `npm test` pass; app boots and Visits screen reads/writes
against the renamed tables.

---

## W2 — "Manage" nav consolidation

Top-level nav goes from 5 items to **3**: **Dashboard · Visits · Manage**.

- `Screen` type becomes `'dashboard' | 'visits' | 'manage'`.
- New state `manageTab: 'brands' | 'outlets' | 'staff' | 'tasks'` (default `'brands'`) with a
  `setManageTab` action.
- New `src/screens/Manage.tsx`: renders an in-screen tab bar (Brands · Outlets · Staff · Tasks)
  and the active sub-panel. It reuses the **existing** `Brands`/`Outlets`/`Staff` screen bodies
  unchanged (extracted/rendered as sub-components) and adds the new **Tasks** panel (W1).
- `App.tsx` switch: `dashboard | visits | manage`.
- `NAV` (in `nav.ts`) becomes the 3 items; `TITLES` updated to the 3 screens. Sidebar and
  BottomNav loop over the new `NAV` unchanged in structure.
- The overdue **badge** (currently keyed to `'followups'`) moves to the **`'visits'`** item.

Note: Brands/Outlets/Staff already manage their own selection state in `AppState`
(`selectedBrandId`, `selectedOutletId`) — unaffected by being nested under Manage.

### Verification

All three top-level screens reachable; Manage tabs switch sub-panels; mobile BottomNav shows 3
items; overdue badge appears on Visits.

---

## W1 — Reusable task library + one-time tasks

### Database

New table in a dedicated migration `supabase/migrations/0004_task_templates.sql`
(applied after `0003`):

```sql
create table task_templates (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);
```

Authenticated-only RLS matching the other tables. Org-wide shared. **No seed rows** (starts
empty). Table name `task_templates` (chosen over `visit_task_templates` for brevity; these are
templates for visit checklist tasks).

### Data layer

- `model.ts`: add `TaskTemplate { id: string; label: string; sort: number }`. **Remove
  `DEFAULT_TASKS`.**
- `mappers.ts`: `TaskTemplateRow` + `rowToTaskTemplate`.
- `keys.ts`: `queryKeys.taskTemplates`.
- `useData.ts`: 6th `useQuery` fetching templates ordered by `sort`; add `taskTemplates` to the
  combined `DataSnapshot`.
- New `useTaskTemplateMutations.ts`: `useCreateTaskTemplate`, `useRenameTaskTemplate`,
  `useDeleteTaskTemplate`, `useReorderTaskTemplates` (or a single update for sort). Each
  invalidates `queryKeys.taskTemplates`.

### Schedule modal checklist (reqs #1–#3)

The `addForm.tasks: boolean[]` parallel array is replaced by a list:

```ts
interface ScheduleTaskItem {
  key: string            // stable React key (template id, or a generated id for one-time rows)
  label: string
  checked: boolean
  templateId?: string    // set when the row originates from the library
  saveAsTemplate?: boolean // for newly-added inline rows: also persist as a template on submit
}
```

Behaviour:

- On modal open, every `taskTemplates` row becomes an item with `checked: true` (req #3).
  Because templates are server data (React Query) and `addForm` is UI state, the modal
  populates its task list from templates when it opens (e.g. an effect keyed on open + template
  list), rather than `openAdd` trying to read server data.
- **"+ Add task"** input appends `{ checked: true, saveAsTemplate: false }` (req #2 — one-time
  by default). A per-row **"Save for future use"** toggle flips `saveAsTemplate`.
- Each row has a checkbox (tick/untick) and custom rows can be removed.

Submit logic (extracted to a pure module `src/data/queries/scheduleTasks.ts` +
`scheduleTasks.test.ts`, following the `transferLogic.ts` convention):

- `taskLabels` = items where `checked` → inserted into `visit_tasks` (existing `useCreateVisit`
  flow, unchanged contract).
- `newTemplateLabels` = items where `saveAsTemplate && !templateId` (and non-empty, de-duped vs
  existing templates) → inserted into `task_templates`.
- The modal calls `useCreateVisit` then `useCreateTaskTemplate` for any new templates (or a
  combined orchestration), invalidating both query keys.

The pure module is unit-tested for: all-ticked default, mixed tick state, one-time vs
save-for-future partitioning, empty-label rejection, and de-dup against existing templates.

### Tasks management panel (Manage → Tasks)

List of templates (ordered by `sort`) with rename, delete, reorder, and an add input. Plain
list following existing screen styling (inline styles + theme vars). Reorder updates `sort`.

### Verification

`scheduleTasks.test.ts` passes. Manually: create templates in Manage→Tasks, open schedule
modal → templates appear all-ticked; add a one-time task (not saved) → appears in this visit
only; add a task with "save for future" → appears in the library afterwards.

---

## W4 — Show the weekday (req #4)

- `derived.ts` `fmt`: include the short weekday →
  `new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit',
  month: 'short', year: 'numeric' })` → e.g. **"Mon, 29 Jun 2026"**. This flows to every
  `dateLabel` (dashboard, visits list, drawer).
- Schedule modal: beside the date picker, show the selected date's weekday as a live hint
  (e.g. the full weekday "Monday") that updates as the date changes.

### Verification

Date labels across the app include the weekday; modal shows the correct live weekday for the
picked date.

---

## Out of scope / YAGNI

- No per-user scoping of templates (app stays org-wide shared, consistent with existing data).
- No drag-and-drop polish required for reorder beyond simple up/down (can be minimal).
- No rename of internal-only helpers that don't carry the domain term (e.g. generic utilities).

## Testing summary

- New: `scheduleTasks.test.ts` (pure submit/merge logic).
- Existing suites continue to pass after the rename (`mappers.test.ts`, `transferLogic.test.ts`).
- `npm run build` must stay green (strict unused-locals — delete `DEFAULT_TASKS` usages fully).
