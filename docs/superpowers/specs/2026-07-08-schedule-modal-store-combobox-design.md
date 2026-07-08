# Schedule Modal — Searchable Store Combobox

**Date:** 2026-07-08
**Status:** Approved, pending implementation plan

## Problem

In the "Schedule a visit" modal (`src/components/ScheduleModal.tsx`), the store
(brand · outlet) is selected from a flat, wrapping grid of chips — one chip per
store. Store count is expected to be **unbounded (50+)**, so the chip grid
overflows and becomes unusable as data grows.

Users pick a store by either dimension: some think "brand first", some "outlet
first". The picker must support search over both, plus browsing.

## Solution

Replace the chip grid at `ScheduleModal.tsx:141-157` with a **searchable
combobox**: a text input that filters stores as you type and opens a scrollable
dropdown of matches **grouped by brand**. Selecting a store collapses the control
to a single chip with a "change" affordance.

The **staff field is unchanged** — it is already scoped to the selected store
(`staffForStore`) and is therefore naturally short, so chips stay tidy there.

## Component structure

Split per the repo convention (CLAUDE.md: "Extract non-trivial logic into a pure
module with a `.test.ts`"):

### 1. `src/data/queries/storePicker.ts` — pure logic, no React

- `StoreOption` type: `{ key, brandId, outletId, brandName, outletName, brandColor }`
  where `key = \`${brandId}|${outletId}\`` (same key shape used today).
- `storeOptions(data: DataSnapshot): StoreOption[]` — builds options from
  `data.stores` via the existing `brandById` / `outletById` lookups, sorted by
  brand name then outlet name.
- `filterStores(options: StoreOption[], query: string): StoreOption[]` —
  case-insensitive substring match against `"brandName · outletName"`, matching
  either token. Empty/whitespace query returns all options.
- `groupByBrand(options: StoreOption[]): { brandName, brandColor, options }[]` —
  ordered groups for the dropdown's brand headers, preserving the sorted order.

Ships with `src/data/queries/storePicker.test.ts` covering:
- filter matches on the brand token,
- filter matches on the outlet token,
- empty query returns all,
- grouping produces ordered groups with the right options.

### 2. `src/components/StoreCombobox.tsx` — presentational

Props: `{ options: StoreOption[]; value: string; onChange: (key: string) => void }`.

- Owns only local UI state: `query` and `open`.
- Reuses the existing `chip()` style (`src/theme.ts`) for the selected pill and
  the brand color dot already rendered at `ScheduleModal.tsx:152`.
- Self-contained "click outside to close" via a `ref` + mousedown `useEffect`.

## Behavior & interaction

- **Empty state (nothing selected):** input with search icon and placeholder
  "Search brand or outlet…". Focus/typing opens the dropdown.
- **Dropdown:** `max-height` ~260px, `overflow: auto`; grouped by brand with a
  small uppercase brand header (styled like the existing `fieldLabel`). Each row:
  color dot + "Brand · Outlet". No matches → muted "No stores match" line.
- **Selecting:** calls `onChange(key)`, closes the dropdown, clears the query.
  Control collapses to the selected store as a chip (color dot + "Brand ·
  Outlet") with an "×/Change" button that reopens the input.
- **Close triggers:** picking an item, Escape, or click outside.
- **Keyboard (minimal, YAGNI):** Escape closes; Enter selects the sole match when
  exactly one option remains. No arrow-key navigation.

## Wiring into ScheduleModal

- Replace lines 141-157 with:
  ```tsx
  <StoreCombobox
    options={storeOptions(data)}
    value={af.storeKey}
    onChange={(key) => setAf('storeKey', key)}
  />
  ```
- The empty-stores hint (`ScheduleModal.tsx:125-140`) and all other fields stay.
- The existing `useEffect` that resets `staffId` when `storeKey` changes
  (`ScheduleModal.tsx:39-45`) already handles the downstream update — no change.

## Testing

- `storePicker.test.ts` covers the pure logic (Vitest, node env — matches the
  repo's `src/**/*.test.ts` convention; no DOM tests).
- No component test (repo has no DOM/component tests by design).

## Out of scope

- Staff field stays as chips.
- No changes to other screens or the Visit Drawer's own store picker.
