# Dashboard: collapsible large cards + "Latest failed tasks" card

Date: 2026-06-30

## Goal

Two enhancements to the Dashboard screen (`src/screens/Dashboard.tsx`):

1. **Collapsible large cards** — make each large card on the dashboard collapse/expand-able.
   Default is collapsed for every card. An "Expand all" checkbox toggles them all at once.
   Each card's open/closed state persists across reloads.
2. **New "Latest failed tasks" card** — a new full-width large card placed above the existing
   large-card groups, summarizing, per brand×outlet, the failed checklist tasks (with remarks)
   from that pair's most recent completed visit.

## Enhancement 1 — Collapsible large cards

### Scope

The following become individually collapsible:

- Overdue visits
- Upcoming visits
- Visits by month (trend)
- Brand × Outlet coverage (matrix)
- Visits by brand
- Staff distribution by outlet
- **Latest failed tasks** (the new card from Enhancement 2)

The **stat strip**, the **period toggle**, and the **KPI row** are NOT collapsible — they are
small cards / controls, not "large cards".

### Behavior

- Default: every collapsible card is **collapsed** on first load.
- A collapsed card renders only a thin header bar: its title (and any existing header accessory,
  e.g. the trend legend or the overdue count badge) plus a chevron icon. Clicking the header bar
  toggles open/closed. The card keeps its current position in the 2-column `grid2` layout (so a
  collapsed card is just a short bar in its grid slot).
- An **"Expand all"** checkbox lives in the dashboard header row (the same flex row as the period
  toggle, near "Visit performance — …"). Checked → all cards open; unchecked → all cards collapsed.
  The checkbox reflects current state: it appears checked when every card is open.
- Open/closed state **persists in `localStorage`** keyed per card id, surviving reloads.

### Components / modules

- **`useCardCollapse` hook** (`src/data/useCardCollapse.ts`) — owns the open-state map.
  - State shape: `Record<string, boolean>` (card id → isOpen). Absent key means collapsed (default).
  - Synced to `localStorage` under a single key (e.g. `dashboard.cardCollapse`).
  - Exposes: `isOpen(id: string): boolean`, `toggle(id: string): void`,
    `setAll(open: boolean): void`, and `allOpen: boolean` (true when every known card id is open).
  - To compute `allOpen` and to make `setAll` deterministic, the hook is given the list of all
    card ids it manages (passed in at call site).
  - Pure helpers (default-collapsed resolution, `setAll` map construction, `allOpen` predicate)
    are extracted so they can be unit-tested without React.
- **`CollapsibleCard` component** (`src/components/CollapsibleCard.tsx`) — presentational wrapper.
  - Props: `id`, `title`, `open`, `onToggle`, optional `accessory` (ReactNode rendered on the
    right of the header, e.g. trend legend / count badge), optional `icon`/`iconColor` (e.g. the
    warning icon on Overdue), and `children`.
  - Renders the existing `card` style container. Always renders the header row (icon? + title +
    accessory + chevron). When `open`, also renders `children` below the header.
  - Chevron uses Material Symbols `expand_more` (open) / `expand_less` (closed) via `Icon`.
  - The header is a `button` (full-width, left-aligned) for accessibility/clickability, styled to
    look like the existing card section titles.

### Dashboard wiring

- `Dashboard.tsx` defines a stable, ordered list of card ids/titles.
- Each existing large card's outer `<div style={{ ...card, ... }}>` is replaced by
  `<CollapsibleCard ...>`, moving the title/legend/badge into the header `title`/`accessory`/`icon`
  props and leaving the body as `children`.
- The "Overdue/Upcoming" pair currently lives inside one `grid2` that is conditionally rendered
  only when there is at least one item. With collapsible cards, the grid wrappers stay; individual
  cards still render their header bar even when collapsed. (The existing "render nothing when both
  lists empty" guard is preserved — an empty list still shows no card, matching today's behavior.)

## Enhancement 2 — "Latest failed tasks" card

### Placement

A new full-width large card rendered directly **above** the first existing large-card group
(above the Overdue/Upcoming grid), inside the same collapsible system (card id e.g.
`latestFailedTasks`). It spans full width (not part of a `grid2` pair).

### Semantics

- The card lists **one row per brand×outlet pair** (every pair present in `data.stores`).
- Each row reflects that pair's **most recent _completed_ visit**. "Completed" means the visit
  has at least one task and no `pending` tasks — i.e. `visit_with_status.base_status` is
  `attention` (has failures) or `done` (all success). Visits that still have pending tasks are
  skipped when choosing "most recent".
- Row rendering by case:
  - **Has failures** (`attention`): header `Brand · Outlet`, sub-line staff name (or "Unassigned")
    and the visit date; below it, each **failed** task's label with its remark (remark omitted /
    shown muted when empty). Clicking the row opens the visit drawer via `openVisit(visitId)`.
  - **All success** (`done`): same header line with a green **"Success"** badge; no task detail.
    Clicking opens the visit drawer.
  - **No completed visit yet**: header line with a muted **"No visit yet"** badge; not clickable.
- Rows are a **flat list sorted by brand name** (then outlet name as a stable tiebreaker).

### Data layer

The global visits fetch was intentionally removed (commit `c741b09`), so this card uses a new
server-side RPC rather than client-side scanning of all visits.

- **Migration `supabase/migrations/0009_latest_failed_tasks.sql`** — a `security_invoker` SQL
  function `latest_failed_tasks()`:
  - From `visit_with_status`, keep rows where `base_status in ('attention','done')` (completed).
  - `row_number() over (partition by brand_id, outlet_id order by date desc, id desc)`; keep `rn = 1`
    → the latest completed visit per pair.
  - For those visit ids, aggregate `visit_tasks` where `status = 'failed'` into a JSON array of
    `{ label, remark }` ordered by `visit_tasks.sort, label`; empty array when none.
  - Return a JSON array of objects:
    `{ brand_id, outlet_id, id (visit id), date, brand_name, outlet_name, staff_name, base_status,
       failed: [{ label, remark }] }`.
  - `grant execute ... to authenticated;` Keeps `owner_id = auth.uid()` RLS in force via
    `security_invoker` (the function reads `visit_with_status`, itself `security_invoker`).
  - Apply AFTER `0008_dashboard_and_lookups.sql` in the Supabase SQL editor.
- **Model + mapper** (`src/data/queries/dashboardSummary.ts`, or a new sibling file if it keeps
  that file focused):
  - `interface FailedTask { label: string; remark: string }`
  - `interface LatestFailedVisit { brandId: string; outletId: string; visitId: string; date: string;
       brandName: string; outletName: string; staffName: string | null;
       status: 'attention' | 'done'; failed: FailedTask[] }`
  - `mapLatestFailedTasks(raw): LatestFailedVisit[]` — snake_case → camelCase, `remark` defaults to
    `''`, `staffName` defaults to `null`.
- **Query key** (`keys.ts`): `latestFailedTasks: ['visits', 'latestFailed'] as const`.
- **Hook** `useLatestFailedTasks` (`src/data/queries/useLatestFailedTasks.ts`) — mirrors
  `useDashboardSummary`: `useQuery` calling `supabase.rpc('latest_failed_tasks')`, returns
  `{ rows, isLoading, isError }`, default `[]`.

### Client merge (No-visit-yet handling)

The RPC returns only pairs that have a completed visit. The card builds the full list itself:

- Build the brand×outlet list from `data.stores` (each `{ brandId, outletId }`), resolving names via
  the existing `brandById` / `outletById` derived lookups.
- Index RPC rows by `\`${brandId}:${outletId}\``.
- For each store, render from its RPC row if present, else "No visit yet".
- Sort the merged list by brand name, then outlet name.

## Testing

Per repo convention (`vitest`, `node` env, `src/**/*.test.ts`, logic extracted into pure modules):

- `mapLatestFailedTasks` unit tests: failed list with remarks, empty-remark coercion to `''`,
  all-success (`done`, empty `failed`), null staff, and empty input → `[]`.
- `useCardCollapse` pure-helper tests: default id is collapsed, `toggle` flips, `setAll(true/false)`
  produces all-open/all-closed maps, and `allOpen` predicate over the managed id list.

No DOM/component tests (consistent with the existing suite).

## Files touched

- `supabase/migrations/0009_latest_failed_tasks.sql` (new)
- `src/data/queries/keys.ts` (add key)
- `src/data/queries/dashboardSummary.ts` (add model + mapper) — or a new sibling module
- `src/data/queries/useLatestFailedTasks.ts` (new)
- `src/data/useCardCollapse.ts` (new) + `src/data/useCardCollapse.test.ts` (new)
- `src/components/CollapsibleCard.tsx` (new)
- `src/screens/Dashboard.tsx` (wire collapsible cards + new card)
- mapper test file (new or extend `dashboardSummary.test.ts`)

## Out of scope / non-goals

- No changes to the stat strip, period toggle, or KPI row behavior.
- No new period/date filtering on the new card — it is always "latest completed", independent of
  the month/year toggle.
- No reordering or drag-and-drop of cards; the collapse only hides/shows bodies.
