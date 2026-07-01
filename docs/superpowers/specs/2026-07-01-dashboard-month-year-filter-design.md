# Dashboard Month + Year filter with scoped card grouping

**Date:** 2026-07-01
**Status:** Approved (design), ready for implementation plan

## Problem

The Dashboard's period control is a two-button toggle: **This month** / **This year**. Two issues:

1. **Confusion.** Only some cards respond to the toggle (the KPI row). The rest (overdue/upcoming lists, coverage matrix, staff-by-outlet, stat strip) never change, so users think the filter is broken.
2. **No arbitrary period.** You can only ever see the *current* month and *current* year. There is no way to browse a past month.

## Goals

- Replace the toggle with **Month + Year dropdowns** so any month of any year (from 2026 onward) can be viewed.
- **Group the cards by filter scope** with clearly labelled section headers, so it is always obvious which cards a given dropdown affects and which are intentionally unaffected.
- Extend the **Latest failed tasks** card to respect the selected month + year.

## Non-goals

- Filtering the overdue/upcoming lists, coverage matrix, staff-by-outlet, or stat strip by the selected period — these stay live/all-time by design.
- Re-introducing a "year-total KPI" view. The KPI row always shows the selected month; year totals are represented by the trend chart and Visits-by-brand card. (`kpis_year` remains returned by the RPC, unused by the UI, in case it is wanted later.)
- Any change to the coverage matrix or staff-by-outlet data.

## Filter model

Two native `<select>` dropdowns (mirroring the Visits screen's inline `selectStyle`), replacing the `This month / This year` toggle:

- **Month** — January … December. No "whole year" option. Default = current month.
- **Year** — 2026 … current year, newest first. Default = current year. (App launched in 2026, so 2026 is the floor.)

Both always show a concrete value; there is no "all" state.

### State location

Move period state out of the global store into **local `useState` in `Dashboard.tsx`**, matching the Visits screen's local brand/outlet filter precedent:

- `filterMonth: number` (1–12), default = current month
- `filterYear: number`, default = current year

Remove the now-unused `period`, `setPeriod`, and the `Period` type from `src/data/store.tsx` (Dashboard is the only consumer).

## Two tiers of filtering

| Tier | Reacts to | Cards |
| --- | --- | --- |
| **Month-scoped** | Month **and** Year | KPI row, Latest failed tasks |
| **Year-scoped** | Year only (month ignored) | Visits by month (trend), Visits by brand |
| **Unfiltered — live** | real *today* | Overdue visits, Upcoming visits |
| **Unfiltered — all-time** | nothing | Stat strip, Brand × Outlet coverage, Staff by outlet |

The month dropdown deliberately has **no effect** on the year-scoped cards; the section header states this so it does not read as a bug.

## Layout — grouped sections

Top-to-bottom order (approved):

1. **Masthead** — stat strip (Brands / Outlets / Active stores / Staff). All-time.
2. **Filter bar** — `Month ▾` + `Year ▾` dropdowns, plus the existing **Expand all** checkbox. Governs the sections below.
3. **Monthly performance** — KPI row + Latest failed tasks.
4. **Current status** — Overdue visits + Upcoming visits.
5. **Yearly overview** — Visits by month (trend) + Visits by brand.
6. **Structure** — Brand × Outlet coverage + Staff by outlet.

### Section headers (Style D: accent bar + uppercase label)

Each section is led by a header with a 3px left accent bar and a small uppercase scope label above the section title:

| Section | Accent color | Label |
| --- | --- | --- |
| Monthly performance | Indigo `#4f46e5` | `FILTERED · {Month} {Year}` (e.g. `FILTERED · MARCH 2026`) |
| Current status | Blue `#2563eb` | `LIVE · TODAY` |
| Yearly overview | Indigo `#4f46e5` | `FILTERED · YEAR {Year}` (e.g. `FILTERED · YEAR 2026`) |
| Structure | Grey `#c7cbd6` bar, muted label | `ALL-TIME` |

Color legend: **indigo** = follows the filter, **blue** = live/today, **grey** = all-time. **Red is never used on section headers** (it reads as an error); red remains reserved for actual overdue rows inside cards.

Colors should be sourced from existing theme variables where equivalents exist (`--accent` for indigo, the existing upcoming-blue `#2563eb`, `--border`/`--dim` for grey/muted) rather than hardcoded hex, per the inline-style-from-CSS-variables convention.

### Trend chart orientation (minor polish)

In the Visits-by-month chart, outline the bar for the selected month (2px indigo outline) so the user can orient the month within the year. Nice-to-have; include if cheap.

## Backend changes

### `dashboard_summary` — no change

It already accepts `p_month` and `p_year`. The frontend currently hardcodes them to today's month/year; we instead pass the **selected** month/year. `p_today` continues to be the **real** today (so KPI overdue math and the overdue/upcoming lists stay correct relative to now).

Resulting param mapping from Dashboard state:

- `p_month` = `` `${filterYear}-${String(filterMonth).padStart(2,'0')}` `` (e.g. `2026-03`)
- `p_year` = `` `${filterYear}` `` (e.g. `2026`)
- `p_today` = real today (`localDateStr(today())`)

KPI row source becomes **always** `summary.kpisMonth` (the `This year` KPI path is removed from the UI).

### `latest_failed_tasks` — new migration `0011`

Add a `p_month text` parameter (format `YYYY-MM`) and constrain the "most recent completed visit per store" to that month:

- In the `completed` CTE, add `and to_char(w.date, 'YYYY-MM') = p_month` to the `where`.
- Because the function signature changes, the migration must `drop function if exists latest_failed_tasks();` before recreating it with the new signature, and re-`grant execute` to `authenticated`.
- Behavior: per brand × outlet, show that pair's most recent completed visit **within the selected month** and its failed tasks. Stores with no completed visit in that month fall through to the client's existing "No visit yet" rendering.

Migration file: `supabase/migrations/0011_latest_failed_tasks_by_month.sql`, applied manually in the Supabase SQL editor after `0010`.

## Frontend wiring

- `src/data/store.tsx` — remove `period` / `setPeriod` / `Period`.
- `src/screens/Dashboard.tsx`:
  - Add `filterMonth` / `filterYear` local state (defaults from `today()`).
  - Build `mo`, `yr`, and the display label (`{MonthName} {Year}`) from that state; keep `todayStr` as the real today for the RPC.
  - Render the Month + Year dropdowns (reuse Visits `selectStyle`); year options computed `2026 … today().getFullYear()`, newest first; month options from the existing `MONTHS` array.
  - `kpiSrc = summary.kpisMonth` (drop the `period` branch).
  - Restructure the JSX into the four labelled sections with the Style D headers.
  - Pass `mo` to `useLatestFailedTasks`.
- `src/data/queries/useLatestFailedTasks.ts` — accept a `month: string` argument, pass it as `p_month` to the RPC, and include it in the query key.
- `src/data/queries/keys.ts` — change `latestFailedTasks` from a constant to a function of `month` (e.g. `latestFailedTasks: (month: string) => ['visits','latestFailedTasks', month] as const`).
- `src/data/queries/dashboardSummary.ts` mapper — no shape change.

## Testing

Per repo convention (pure logic → `.test.ts`, tests run in `node`, no DOM):

- Extract the period → RPC-param derivation into a small pure helper, e.g. `src/screens/dashboardPeriod.ts` exporting `periodParams(filterYear, filterMonth)` → `{ month, year, label }`, and the year-options builder `yearOptions(currentYear)` → `number[]` (2026…current, newest first). Add `dashboardPeriod.test.ts` covering:
  - Month zero-padding (`2026-03`, `2026-11`).
  - Label formatting (`March 2026`).
  - `yearOptions(2026)` → `[2026]`; `yearOptions(2028)` → `[2028, 2027, 2026]`.
- No component/DOM tests (consistent with the codebase).

## Risks / trade-offs

- **Year-scoped cards ignore the month.** Mitigated by the explicit `FILTERED · YEAR {Year}` header.
- **KPI "Overdue" vs the Overdue list can differ.** The KPI counts overdue *within the selected month*; the Overdue *list* is all overdue as of today. This is existing behavior; the section headers (`FILTERED` vs `LIVE · TODAY`) make the different scopes explicit.
- **Manual migration.** `0011` must be run by hand in Supabase like the others; the app keeps working on the old function until it is applied, except the Latest-failed-tasks card would error if the client sends an argument the old function doesn't accept — so deploy the migration together with (or before) the frontend change.
