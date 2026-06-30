# Visits page — server-side pagination & filters (Spec 1)

**Date:** 2026-06-30
**Status:** Approved for planning

## Motivation

The Visits page currently renders every visit held in the global in-memory list
(`useData().visits`, fetched whole at startup). As visit volume grows this load
becomes slow and heavy. We want the Visits page to load and filter data **one
page at a time from the database**, and to add several requested features:

1. Pagination.
2. A date-range filter.
3. An expandable, read-only checklist detail under each visit (task · status
   color · remark), collapsed by default, plus an expand-all / collapse-all
   toggle.
4. A "show latest visit per store" toggle, evaluated within the date-range
   filter.

## Scope decision (decomposition)

Truly removing the global visits fetch is a two-part effort. This spec is **part
one**:

- **Spec 1 (this doc):** The Visits screen reads from a new server-side
  paginated query instead of `useData().visits`. Adds one DB migration (a status
  view + two RPCs) and new query hooks. Delivers all four features above.
- **Spec 2 (follow-up, NOT in this spec):** Convert the remaining consumers of
  the global fetch — Dashboard analytics, the overdue badge in
  `Sidebar`/`BottomNav`, `AddTaskToVisitsModal`, and `VisitDrawer` — to targeted
  / aggregate queries, then delete `fetchVisits`. This is what finally stops the
  app loading all visits.

After Spec 1, the global `useData().visits` fetch is **unchanged** and still
backs the Dashboard, badges, drawer, and add-task modal. Only the Visits screen
is migrated. This keeps the change reviewable and ships the features without
touching unrelated screens.

## Existing context

- Schema: `visits (id, date, staff_id, brand_id, outlet_id, owner_id)` and
  `visit_tasks (id, visit_id, label, status, remark, sort, owner_id)`. RLS on
  every table is `owner_id = auth.uid()` (migration `0003`). Postgres functions
  default to `SECURITY INVOKER`, so a function/view querying these tables is
  automatically scoped to the caller's rows.
- Status is derived from a visit's tasks (`src/data/derived.ts`):
  - base `pending` if any task is `pending` (or zero tasks); else `attention` if
    any task is `failed`; else `done`.
  - `overdue` = base `pending` **and** `date < today`.
  - The four-way `DerivedStatus` used for display is
    `done | pending | overdue | attention`.
- "today" in the client is the browser-local calendar date (`today()` in
  `derived.ts`). To keep "overdue" identical between SQL and JS, the client
  passes its own today (`p_today`) into the RPCs rather than relying on the
  server clock.
- All visit mutations call `qc.invalidateQueries({ queryKey: queryKeys.visits })`
  (i.e. `['visits']`) on success, with no optimistic updates.
- Mappers: `rowToVisit` maps `{ ...visit, visit_tasks(*) }` to the domain
  `Visit` (tasks sorted by `sort`).
- The current screen sorts ascending by date, filters by status chips
  (all/pending/attention/overdue/done) with counts, and a text search over
  brand/outlet/staff names. Clicking a row opens `VisitDrawer`.

## Database migration — `supabase/migrations/0007_visit_pagination.sql`

Applied manually in the Supabase SQL editor, after `0006`.

### View: `visit_with_status` (`security_invoker = true`)

One row per visit with:

- passthrough columns: `id, date, staff_id, brand_id, outlet_id, owner_id`
- `total`, `success_t`, `failed_t`, `pending_t` — task counts (left join +
  aggregate over `visit_tasks`)
- `base_status text` — `'pending' | 'attention' | 'done'` using the rule above
  (`pending` when `total = 0` or any pending task; else `attention` if any
  failed; else `done`)
- search text columns: `brand_name`, `outlet_name`, `staff_name` (joins to
  `brands` / `outlets` / `staff`; `staff_name` null when `staff_id` is null)

Note: `overdue` is **not** stored in the view because it depends on the caller's
"today"; it is computed in the RPCs from `base_status` + `date < p_today`.

`status` (four-way) is derived in the RPCs as:
`base_status = 'pending' AND date < p_today → 'overdue'`, otherwise `base_status`
(`done`/`attention`/`pending`).

### RPC: `visits_page(...)`

```
visits_page(
  p_today    date,
  p_from     date,        -- inclusive; null = open lower bound
  p_to       date,        -- inclusive; null = open upper bound
  p_status   text,        -- 'all' | 'pending' | 'attention' | 'overdue' | 'done'
  p_latest   boolean,     -- latest visit per store within the date range
  p_search   text,        -- '' = no search; ILIKE over brand/outlet/staff names
  p_limit    int,
  p_offset   int
) returns table (id uuid, total_count bigint)
```

Pipeline (as a single SQL statement using CTEs):

1. **ranged** — `visit_with_status` filtered by `p_from`/`p_to` (inclusive,
   null = open) and by `p_search` (when non-empty, `ILIKE '%'||p_search||'%'`
   against `brand_name`, `outlet_name`, `coalesce(staff_name,'')`).
2. **scoped** — if `p_latest` then
   `distinct on (brand_id, outlet_id) … order by brand_id, outlet_id, date desc, id desc`
   over **ranged**; else **ranged** unchanged.
3. **statused** — derive four-way `status` (using `p_today`), then filter by
   `p_status` (`'all'` = no filter).
4. Final select: `id`, `count(*) over () as total_count`,
   `order by date desc, id desc`, `limit p_limit offset p_offset`.

Returns the page's ids in display order; `total_count` is the full filtered
count (same on every row; the hook reads it from the first row, or treats an
empty result as total 0).

Default display order is **newest-first** (`date desc, id desc`).

### RPC: `visit_status_counts(...)`

```
visit_status_counts(
  p_today  date,
  p_from   date,
  p_to     date,
  p_latest boolean,
  p_search text
) returns table (status text, n bigint)
```

Same **ranged → scoped** pipeline (no status filter, no pagination), then
`group by` the derived four-way status. The hook also derives the `all` count as
the sum. Statuses with zero rows simply won't appear; the hook defaults missing
keys to 0.

## Query layer

### `src/data/queries/keys.ts`

Extend `queryKeys.visits` usage with parameterised child keys (kept under the
`['visits']` prefix so existing invalidation cascades):

- `visitsPage(params)` → `['visits', 'page', params]`
- `visitStatusCounts(params)` → `['visits', 'counts', params]`

`params` is a plain serialisable object: `{ today, from, to, status, latest,
search, limit, offset }`.

### `src/data/queries/useVisitsPage.ts`

- `useVisitsPage(params)`:
  1. `supabase.rpc('visits_page', { ... })` → `{ id, total_count }[]`.
  2. If empty → `{ visits: [], total: 0 }`.
  3. Else hydrate: `supabase.from('visits').select('*, visit_tasks(*)').in('id', ids)`,
     map via `rowToVisit`, then **re-sort to the RPC's id order** (PostgREST
     `.in` does not preserve order). The re-sort is a pure helper
     (`orderByIds(visits, ids)`) so it can be unit-tested.
  4. Return `{ visits, total, isLoading, isError }`.
- `useVisitStatusCounts(params)`: `supabase.rpc('visit_status_counts', {...})`,
  fold rows into `{ all, pending, attention, overdue, done }` (missing = 0).

Both use `useQuery` with `keepPreviousData: true` so paging/filtering doesn't
flash empty.

### Pure helpers — `src/data/queries/visitsQuery.ts` (+ `.test.ts`)

- `resolveDateRange(preset, customFrom, customTo, today)` →
  `{ from: string | null, to: string | null }` for each preset (`all`,
  `month`, `last30`, `last90`, `year`, `custom`). Pure; unit-tested.
- `orderByIds(visits, ids)` → visits sorted to match `ids`. Pure; unit-tested.
- `foldStatusCounts(rows)` → the counts object. Pure; unit-tested.

## Visits screen — `src/screens/Visits.tsx`

Reads from `useVisitsPage` / `useVisitStatusCounts` instead of `data.visits`.
Still uses `data.brands/outlets/staff` (small reference tables, already fetched)
for `visitVM` display lookups.

### Local state (`useState`, per the chosen state location)

- `datePreset: DatePreset` (default `'all'`), `customFrom`, `customTo`
- `latestPerStore: boolean` (default `false`)
- `page: number` (0-based; default 0)
- `expandedIds: Set<string>` and `allExpanded: boolean`
- existing `visitFilter` (status chips) and `q` (search) stay in the global
  store as today.

Changing any filter (status, date range, latest, search) resets `page` to 0.
Changing page or filters resets `expandedIds`/`allExpanded` to collapsed.

### Toolbar (above the list)

- Status chips — unchanged, but counts come from `useVisitStatusCounts`.
- Date-range control: preset buttons/segmented control + from/to `<input
  type="date">` shown for `custom`. Styled with existing inline-style /
  CSS-variable conventions.
- "Latest per store" checkbox.
- "Expand all" checkbox — toggles `allExpanded`; sets/clears `expandedIds` for
  the current page.

### Row + expandable detail

- Desktop and mobile rows keep their current layout, with a chevron expand
  button added (own click handler; `stopPropagation` so it doesn't open the
  drawer). Row body still opens `VisitDrawer` via `openVisit`.
- Expanded panel (read-only): for each task — label, a status color dot
  (`pending` grey `#6b7280`, `failed` red `#dc2626`, `success` green `#16a34a`),
  and the remark (muted, "—" when empty). A small `taskStatusColor(status)`
  helper centralises the colors.

### Pagination footer

- Prev / Next buttons (disabled at bounds), "Page X of Y", and total count.
  `Y = max(1, ceil(total / pageSize))`, `pageSize = 25`.
- Empty state preserved ("No visits match this filter.").

## Behavior decisions (locked)

- **Page size:** 25.
- **Default sort:** newest-first (`date desc`).
- **Default date range:** All time (pagination bounds the fetch regardless).
- **Latest-per-store ordering:** within the date range, newest per
  `(brand_id, outlet_id)`, tie-broken by `id desc`; status/search/pagination
  apply after.
- **Overdue parity:** client passes `p_today` so SQL and JS agree.
- **Editing:** remains in `VisitDrawer`; the inline detail is read-only.

## Testing

- `visitsQuery.test.ts`: `resolveDateRange` for every preset (including
  open-ended and custom), `orderByIds` (order preserved, missing/extra ids), and
  `foldStatusCounts` (missing keys default to 0, `all` = sum).
- SQL (view + RPCs) is verified manually in the Supabase SQL editor, consistent
  with how migrations are applied in this project.
- No DOM/component tests (matches repo convention).

## Files

- New: `supabase/migrations/0007_visit_pagination.sql`
- New: `src/data/queries/useVisitsPage.ts`
- New: `src/data/queries/visitsQuery.ts` + `visitsQuery.test.ts`
- Edit: `src/data/queries/keys.ts` (parameterised child keys)
- Edit: `src/screens/Visits.tsx` (read from new hooks; toolbar; expandable
  detail; pagination)
- Possibly edit: `src/data/derived.ts` (export a `taskStatusColor` helper) —
  only if not co-located in the screen.

## Risks / notes

- The view/RPCs must be `SECURITY INVOKER` (the Postgres default) so RLS
  scoping by `owner_id` is preserved. Verify in the SQL editor that a second
  user sees only their rows.
- `keepPreviousData` avoids empty flashes between pages/filters.
- This spec intentionally leaves the global fetch in place; the scaling win is
  only fully realised after Spec 2.
