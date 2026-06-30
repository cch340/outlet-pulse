# Remove the global visits fetch (Spec 2)

**Date:** 2026-06-30
**Status:** Approved for planning
**Follows:** `2026-06-30-visits-page-pagination-design.md` (Spec 1)

## Motivation

Spec 1 made the Visits screen server-side paginated, but the app still loads
**every visit and task** at startup via `fetchVisits` in
`src/data/queries/useData.ts`, because the Dashboard, the overdue badge, the
add-task modal, and the visit drawer all read the global `data.visits` array.
Spec 2 removes that fetch so each piece loads only what it needs, completing the
scaling work.

## Scope

In scope — convert every consumer of `data.visits` to a targeted query, then
delete `fetchVisits`:

- Dashboard analytics (KPIs, monthly trend, brand breakdown, attention lists)
- Overdue badge (`Sidebar`, `BottomNav`)
- Visit drawer (single visit by id)
- Add-task modal (visits missing a label)
- `useData` / `DataSnapshot` (drop `visits`)

Out of scope — the Visits screen (already done in Spec 1), and any change to the
reference-data queries (brands, outlets, stores, staff, taskTemplates), which
stay fully fetched (they are small and bounded).

## Existing context

- Spec 1 added `visit_with_status` (a `security_invoker` view computing
  `base_status` + task counts + joined names) and the RPCs `visits_page` /
  `visit_status_counts`. Spec 2 builds on that view.
- `base_status` is the three-way status (`pending`/`attention`/`done`);
  `overdue` is derived as `base_status = 'pending' AND date < p_today`, with
  `p_today` passed from the client for browser/SQL parity.
- Dashboard semantics today (from `src/data/derived.ts` + `Dashboard.tsx`):
  - **done** (a.k.a. "complete") = `visitComplete` = `base_status != 'pending'`
    (both `done` and `attention` count as complete).
  - **pending** KPI = `base_status = 'pending'` (this set includes overdue).
  - **overdue** KPI = `base_status = 'pending' AND date < today`.
  - monthly trend: per month of the current year, `done` vs `total`.
  - brand breakdown: per brand for the current year, `done` vs `total`.
  - overdue list: all overdue visits, **oldest first**.
  - upcoming list: all `pending && !overdue`, **soonest first**.
- All visit mutations invalidate `['visits']`; new query keys nest under it so
  they refresh automatically (no mutation changes).
- The Shell (`App.tsx`) currently gates the whole app on `useData().isLoading` —
  which today waits on visits. After Spec 2 it waits only on reference data, so
  first paint is faster; visit-dependent sections show their own loading state.

## Database migration — `supabase/migrations/0008_dashboard_and_lookups.sql`

Applied manually in the Supabase SQL editor, after `0007`. All functions are
`SECURITY INVOKER` (the default) so `owner_id = auth.uid()` RLS stays in force.

### RPC: `dashboard_summary(p_today date, p_year text, p_month text, p_list_limit int) returns json`

Returns one JSON object (snake_case keys) with everything the Dashboard's
visit-derived widgets need, in a single round trip:

```jsonc
{
  "kpis_month":  { "total": int, "done": int, "pending": int, "overdue": int },
  "kpis_year":   { "total": int, "done": int, "pending": int, "overdue": int },
  "trend":       [ { "month": "YYYY-MM", "done": int, "total": int }, … 12 entries … ],
  "brand_breakdown": [ { "brand_id": uuid, "done": int, "total": int }, … ],
  "overdue":     [ { "id": uuid, "date": "YYYY-MM-DD", "brand_name": text,
                     "outlet_name": text, "staff_name": text|null }, … ≤ p_list_limit … ],
  "upcoming":    [ { … same shape … }, … ≤ p_list_limit … ]
}
```

- `p_year` is `'YYYY'`, `p_month` is `'YYYY-MM'`; KPIs filter the view by
  `date` (year prefix / month prefix). `done`/`pending`/`overdue` use
  `base_status` + `p_today` as defined above.
- `trend` returns **all 12 months** of `p_year` (months with no visits report
  `done = 0, total = 0`), via a `generate_series` of months left-joined to the
  view.
- `brand_breakdown` is grouped by `brand_id` over the year (only brands with at
  least one visit appear; the client supplies name/color from reference data).
- `overdue` = `base_status = 'pending' AND date < p_today`, ordered `date asc`
  (oldest/most urgent first), `limit p_list_limit`.
- `upcoming` = `base_status = 'pending' AND date >= p_today`, ordered
  `date asc` (soonest first), `limit p_list_limit`.

### RPC: `visits_missing_label(p_label text, p_limit int) returns table (id uuid, date date, brand_name text, outlet_name text, staff_name text)`

Visits that have **no** task whose trimmed/lowercased label equals the trimmed/
lowercased `p_label`. Returns light rows (no tasks), newest first
(`date desc, id desc`), `limit p_limit`. Backs the add-task modal. Mirrors the
old `eligibleVisitsForLabel` JS logic in SQL via
`not exists (select 1 from visit_tasks t where t.visit_id = v.id and lower(trim(t.label)) = lower(trim(p_label)))`.

`grant execute … to authenticated` on both functions.

## Query layer

New keys in `src/data/queries/keys.ts` (all nested under `['visits']`):

- `visit: (id) => ['visits', 'one', id]`
- `dashboardSummary: (params) => ['visits', 'dashboard', params]`
- `visitsMissingLabel: (params) => ['visits', 'missing', params]`

### `src/data/queries/useDashboardSummary.ts`

- `useDashboardSummary(params: { today, year, month, listLimit })` →
  `supabase.rpc('dashboard_summary', {...})`, then `mapDashboardSummary(raw)` →
  typed `DashboardSummary` (camelCase). Returns `{ summary, isLoading, isError }`.

### `src/data/queries/useVisit.ts`

- `useVisit(id: string | null)` → when `id` is null, disabled query returning
  `null`; else `supabase.from('visits').select('*, visit_tasks(*)').eq('id', id).maybeSingle()`
  → `rowToVisit(row) | null`. Key `['visits','one',id]`.

### `src/data/queries/useOverdueCount.ts`

- `useOverdueCount()` → thin wrapper over the existing `visit_status_counts`
  RPC with all-time params (`today = local today, from = null, to = null,
  latest = false, search = ''`); returns the `overdue` number. Reuses the Spec 1
  fold; no new SQL.

### `src/data/queries/useVisitsMissingLabel.ts`

- `useVisitsMissingLabel(label: string)` →
  `supabase.rpc('visits_missing_label', { p_label: label, p_limit: LIMIT })`,
  returns light `MissingLabelVisit[]` (`{ id, date, brandName, outletName,
  staffName }`) via a small mapper. `LIMIT = 200`.

### Pure, tested helper — `src/data/queries/dashboardSummary.ts` (+ `.test.ts`)

- `mapDashboardSummary(raw): DashboardSummary` — converts the snake_case RPC
  JSON to the camelCase domain shape; defends against missing arrays (defaults
  to `[]`) and missing KPI fields (defaults to 0). Pure; unit-tested. This is
  the main piece of testable client logic in Spec 2.
- Types: `DashboardKpis`, `TrendPoint`, `BrandStat`, `AttentionItem`,
  `DashboardSummary`, `MissingLabelVisit`.

## Consumer changes

### `src/data/queries/useData.ts`
Remove the `visits` `useQuery`, `fetchVisits`, the `Visit` import, and `visits`
from `DataSnapshot`. `isLoading`/`isError` now reflect only reference data.

### `src/screens/Dashboard.tsx`
- Replace all `data.visits`-derived computation with `useDashboardSummary`:
  - KPIs: pick `summary.kpisMonth` or `summary.kpisYear` by `state.period`;
    completion rate = `done/total`.
  - trend: render all 12 `summary.trend` points (labels `Jan…Dec` by month
    index); `tmax` from the 12 totals.
  - brand breakdown: map `summary.brandBreakdown`, joining
    `brandById(data, brandId)` for name/color.
  - overdue/upcoming lists: render `summary.overdue` / `summary.upcoming`
    directly (already carry names + date); format date with `fmt`.
- The stat strip (brands/outlets/stores/staff counts), Brand×Outlet matrix, and
  staff-distribution chart are unchanged — they use reference data only.
- While `summary` is loading, the visit-derived sections show a lightweight
  loading placeholder; on error, a small inline message. The non-visit sections
  render immediately.
- Remove now-unused imports (`isOverdue`, `visitStatus`, `visitComplete`,
  `visitVM`, `today` if unused, etc.) to satisfy `noUnusedLocals`.

### `src/components/Sidebar.tsx` and `src/components/BottomNav.tsx`
Replace `data.visits.filter(isOverdue).length` with `useOverdueCount()`.

### `src/components/VisitDrawer.tsx`
Replace `data.visits.find((f) => f.id === S.openVisitId)` with
`useVisit(S.openVisitId)`. While loading, render nothing (or a minimal frame);
keep all other behavior. `data.brands/outlets/stores/staff` lookups stay.

### `src/components/AddTaskToVisitsModal.tsx`
Replace `eligibleVisitsForLabel(data.visits, label)` with
`useVisitsMissingLabel(label)`. Render from the returned light rows
(`title = brandName · outletName`, `dateLabel = fmt(date)`, `staffName`);
drop the `visitVM(data, v)` call. Select-all operates on the (capped) returned
set; if the cap is hit, note "showing first 200".

### `src/data/queries/visitEdit.ts` (+ `visitEdit.test.ts`)
Remove `eligibleVisitsForLabel` and its tests (logic now in SQL). Keep
`taskHasResult` and `importableTemplates` and their tests.

## Testing

- `dashboardSummary.test.ts`: `mapDashboardSummary` — full object maps correctly;
  missing arrays default to `[]`; missing KPI fields default to 0.
- Remove the `eligibleVisitsForLabel` describe block from `visitEdit.test.ts`.
- SQL (the two RPCs) verified manually in the Supabase SQL editor.
- `npm run build` must pass (strict `noUnusedLocals`/`noUnusedParameters`),
  which catches every dangling import left by removing `data.visits`.
- No DOM/component tests (repo convention).

## Files

- New: `supabase/migrations/0008_dashboard_and_lookups.sql`
- New: `src/data/queries/dashboardSummary.ts` + `dashboardSummary.test.ts`
- New: `src/data/queries/useDashboardSummary.ts`
- New: `src/data/queries/useVisit.ts`
- New: `src/data/queries/useOverdueCount.ts`
- New: `src/data/queries/useVisitsMissingLabel.ts`
- Edit: `src/data/queries/keys.ts`
- Edit: `src/data/queries/useData.ts` (remove visits)
- Edit: `src/screens/Dashboard.tsx`
- Edit: `src/components/Sidebar.tsx`, `src/components/BottomNav.tsx`
- Edit: `src/components/VisitDrawer.tsx`
- Edit: `src/components/AddTaskToVisitsModal.tsx`
- Edit: `src/data/queries/visitEdit.ts` + `visitEdit.test.ts` (remove eligible*)

## Locked decisions

- Dashboard data via a single `dashboard_summary` JSON RPC (one round trip).
- Monthly trend shows **all 12 months** (replacing the Jan–Jul prototype set).
- Attention lists capped at `p_list_limit` (default 20), oldest-first (overdue)
  / soonest-first (upcoming); the KPI cards already show the true totals.
- `visits_missing_label` capped at 200 light rows.
- New keys nested under `['visits']`; existing mutation invalidation covers them.
- RLS preserved via `SECURITY INVOKER`.

## Risks / notes

- The Dashboard's "done" semantics must stay `base_status != 'pending'` (not
  just `done`) — both done and attention are "complete". The SQL must match.
- `dashboard_summary` returns JSON; the typed boundary is `mapDashboardSummary`,
  the one unit-tested seam.
- After this spec, `fetchVisits` and the global `data.visits` array no longer
  exist; any missed reference is a build error (strict unused-locals), which is
  the safety net.
