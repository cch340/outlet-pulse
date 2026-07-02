# Stores: browse page, management tab, brand ordering & per-store visit drawer

**Date:** 2026-07-02
**Status:** Approved (design)
**Branch:** `feat/stores`

## Problem

A "store" is a brand↔outlet link (the `Store` join row). Today the only way to
create one is to **edit a brand** and tick outlets under "Operates in outlets" in
the Brand modal — a section that only appears in *edit* mode. New users don't
realize stores must be set up, do it once, then forget the hidden step. There is
also no dedicated place to see all stores or drill into a single store's visit
history; the closest thing is the dashboard's "Latest failed tasks by outlet"
card, which is read-only and lives among many other dashboard cards.

## Goals

1. Make store setup **discoverable** with a dedicated management surface and
   empty-state guidance ("create a brand and outlet first").
2. Add a **top-level browse page** for stores, grouped by brand (in a
   user-controlled order) and sorted by outlet name, showing each store's latest
   visit status.
3. Let the user **order brands** (like the Tasks tab already allows), so the
   browse page and every other brand list follow a deliberate order.
4. From each store, **drill into its visit history** in a drawer, styled like the
   dashboard's failed-task rows.

## Non-goals

- Removing the dashboard "Latest failed tasks by outlet" card. It stays until the
  user explicitly decides to retire it (the new page is a superset, so retiring
  it later is a one-line delete).
- Any new backend RPC. We reuse `latest_failed_tasks(p_month)` and the existing
  paginated visits query.

## Decisions (settled during brainstorming)

- **Two surfaces, not one:** a **Manage → Stores tab** for *linking* (admin
  config) and a separate **top-level Stores page** for *browsing* (daily use).
  This matches the existing convention (Manage = configuration tabs; top-level
  nav = day-to-day screens).
- **View-visits opens a drawer** showing the store's visit history in the
  failed-task style — not a jump to the filtered Visits screen.
- **Browse page is a superset of the dashboard card:** it carries a month+year
  filter (default current month/year) and a "show failed task details" checkbox
  that expands stores with failures inline.
- **Manage → Stores tab layout:** per-brand sections with outlet **toggle
  chips** (linked = highlighted), not a brand×outlet matrix (matrices are
  unwieldy and poor on mobile).
- **Remove the "Operates in outlets" toggles from the Brand edit modal:** the
  Stores tab becomes the single, discoverable home for linking.

---

## Part 1 — Foundation: brand ordering + granular store links

### Brand ordering

Brands are currently fetched `.order('name')` and have no `sort` column. Mirror
the `task_templates` pattern exactly.

- **Migration `0012_brand_sort.sql`** (applied manually via Supabase SQL editor,
  after `0011`):
  - `alter table brands add column sort int not null default 0;`
  - Backfill existing rows per owner by current name order:
    ```sql
    update brands b set sort = s.rn
    from (
      select id, (row_number() over (partition by owner_id order by name) - 1) as rn
      from brands
    ) s
    where b.id = s.id;
    ```
- **Model:** add `sort: number` to `Brand` in `src/data/model.ts` (mirrors
  `TaskTemplate.sort`).
- **Fetch:** `fetchBrands` selects `sort` and orders `.order('sort').order('name')`
  (name as deterministic tiebreaker). Because *all* brand lists read from
  `data.brands`, this makes brand order consistent everywhere (Brands tab,
  dashboard matrix & breakdown, Visits filter, Stores page).
- **Reorder mutation** `useReorderBrands({ ids })` in `useBrandMutations.ts` — a
  direct copy of `useReorderTaskTemplates` (write each row's array index as its
  `sort`), invalidating `queryKeys.brands`.
- **Create:** `useCreateBrand` sets `sort: brands.length` (new brands go last).
  The Brand modal passes the current count.
- **Brands tab UI** (`src/screens/Brands.tsx`): add up/down arrow buttons to each
  brand card in the left list, identical in behavior to the Tasks tab
  (`move(index, dir)` swaps ids and calls the reorder mutation). Disable the ends.

### Granular store-link mutations

For live chip toggling (add/remove a single link, rather than replace-all):

- `useLinkStore({ brandId, outletId })` — `insert({ brand_id, outlet_id })`.
- `useUnlinkStore({ brandId, outletId })` — `delete().eq('brand_id').eq('outlet_id')`.
- Both invalidate `queryKeys.stores`. Keep `useSetBrandStores` in place (no longer
  used by the modal after Part 2, but harmless).

---

## Part 2 — Manage → Stores tab

- Add `'stores'` to the `ManageTab` union (`src/data/store.tsx`) and to the `TABS`
  array in `src/screens/Manage.tsx` (order: Brands, Outlets, **Stores**, Staff,
  Tasks — Stores sits next to Brands/Outlets it links).
- New component `src/components/StoresPanel.tsx` (rendered by Manage when
  `tab === 'stores'`).

### Layout

- **Per-brand sections** in brand sort order. Each section: brand chip/name +
  a wrap of **outlet toggle chips** (one per outlet). A chip is highlighted when
  the `{brandId, outletId}` store exists; tapping toggles it via
  `useLinkStore` / `useUnlinkStore`. Reuses the existing `chip(active)` style.
- A small per-brand summary (e.g. "N of M outlets linked").

### Empty states (item 1's core)

- **No brands and no outlets:** a card — "Create a brand and an outlet first" —
  with two buttons that switch to the Brands and Outlets tabs (via `setManageTab`).
- **Brands but no outlets:** "Add an outlet first" → Outlets tab.
- **Outlets but no brands:** "Add a brand first" → Brands tab.

### Brand modal change

- Remove the `m.mode === 'edit'` "Operates in outlets" block and the
  `useSetBrandStores` call from `src/components/BrandModal.tsx`. Linking now lives
  solely in the Stores tab. (`outletIds` state and the toggle handler are deleted.)

---

## Part 3 — Top-level Stores browse page

### Navigation

- Add `'stores'` to the `Screen` union (`src/data/store.tsx`).
- Insert a nav entry in `src/data/nav.ts` **between `dashboard` and `visits`**:
  `{ key: 'stores', label: 'Stores', short: 'Stores', icon: 'store' }`, and add a
  `TITLES.stores` entry. Both `Sidebar` and `BottomNav` map over `NAV`, so the new
  item appears in the correct slot automatically.
- Add the screen to the `Shell` switch in `src/App.tsx` → renders new
  `src/screens/Stores.tsx`.

### Content

- **Month + year filter** at the top (same control style as Dashboard), default =
  current month/year. Drives `useLatestFailedTasks(month)` (existing RPC) for the
  at-a-glance latest status.
- **"Show failed task details" checkbox.** When on, every store row that has
  failures expands inline to show its failed tasks (`label — remark`), mirroring
  the dashboard `FailedRow`.
- **Grouping:** stores grouped by brand (brand sort order); within a brand,
  outlets sorted by name.
- **Per store row:** `outlet name · location`, staff count, a latest-status pill
  (`Success` / `N failed` / `No visit yet`) with last visit date, and a
  **"View visits"** action (opens the drawer in Part 4).
- **Empty state (no stores):** hint pointing to Manage → Stores.

### Pure, tested logic

Extract into `src/data/queries/storeRows.ts` (+ `storeRows.test.ts`), per the
`transferLogic.ts` convention:

- `buildStoreGroups(data, latestFailed)` → an array of
  `{ brand, rows: StoreRow[] }` ordered by brand sort, rows sorted by outlet name,
  where each `StoreRow` carries `{ brandId, outletId, outletName, location,
  staffCount, latest: LatestFailedVisit | null }`.
- This isolates the grouping/sorting/join-with-latest-status from React so it can
  be unit-tested without the DOM.

## Part 4 — Per-store visit drawer

- New view state in `src/data/store.tsx`: `storeVisits: { brandId, outletId } | null`
  with `openStoreVisits(brandId, outletId)` / `closeStoreVisits()` actions.
- New component `src/components/StoreVisitsDrawer.tsx`, using the same overlay
  pattern as `VisitDrawer.tsx`, titled `Brand · Outlet`.
- Lists the store's visits **most-recent-first**, each row in the **failed-task
  style** (date, status pill, failed-task breakdown inline). Reuses the failed-row
  presentation from the dashboard; a shared row component may be factored out if
  clean, otherwise duplicated deliberately.
- **Data:** reuse `useVisitsPage` filtered to `{ brand: brandId, outlet: outletId,
  status: 'all', date range: all }` with a reasonable page size (e.g. 25) and
  simple pager, or fetch the most recent N. No new backend. Failed tasks are
  derived from `visit.tasks` (`status === 'failed'`).
- Tapping a visit calls the existing `openVisit(id)` so the full `VisitDrawer`
  opens on top for editing (the store drawer sits behind it / higher z-index on
  the visit drawer).

## Part 5 — Dashboard

- **Unchanged.** The "Latest failed tasks by outlet" card remains until the user
  decides to retire it.

---

## Affected / new files

**New**
- `supabase/migrations/0012_brand_sort.sql`
- `src/components/StoresPanel.tsx` (Manage tab)
- `src/screens/Stores.tsx` (browse page)
- `src/components/StoreVisitsDrawer.tsx`
- `src/data/queries/storeRows.ts` + `storeRows.test.ts`

**Changed**
- `src/data/model.ts` — `Brand.sort`
- `src/data/queries/useData.ts` — select `sort`, order by `sort` then `name`
- `src/data/queries/useBrandMutations.ts` — `useReorderBrands`, `sort` on create;
  `useLinkStore` / `useUnlinkStore`
- `src/screens/Brands.tsx` — up/down reorder arrows
- `src/data/store.tsx` — `Screen` += `stores`; `ManageTab` += `stores`;
  `storeVisits` state + actions
- `src/data/nav.ts` — Stores nav entry + title
- `src/App.tsx` — Stores screen in Shell switch
- `src/screens/Manage.tsx` — Stores tab
- `src/components/BrandModal.tsx` — remove outlet-linking block

## Testing

- `storeRows.test.ts`: brand-order grouping, outlet-name sort within brand,
  correct join to latest status, `No visit yet` when a store has no visit that
  month, empty-data cases.
- Existing `npm run build` (strict unused-locals) and `npm test` must pass.
- Manual: create brand+outlet, link via Stores tab, confirm empty-state hints,
  reorder brands and confirm the browse page order follows, month/year filter and
  the failed-detail checkbox, and the visit drawer → full visit drawer flow, on
  desktop and mobile.

## Rollout / ordering

Build order: Part 1 (foundation) → Part 2 (Manage tab, so stores can be created)
→ Part 3 (browse page) → Part 4 (drawer). The migration must be applied in
Supabase before the `sort`-ordered fetch ships.
