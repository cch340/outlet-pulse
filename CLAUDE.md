# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server.
- `npm run build` — type-check (`tsc -b`) then production `vite build`. The build fails on unused locals/params (`tsconfig` has `noUnusedLocals`/`noUnusedParameters`).
- `npm test` — run the Vitest suite once (`vitest run`).
- Run a single test file: `npx vitest run src/data/queries/transferLogic.test.ts`. Watch a file: `npx vitest src/data/queries/mappers.test.ts`.
- `npm run lint` — ESLint (flat config in `eslint.config.js`; scoped to `src/**`, honors the `_`-prefix intentional-unused convention).
- `npm run test:e2e` — Playwright smoke suite in `tests/e2e/` (chromium). Supabase is stubbed (`tests/e2e/support/stubSupabase.ts`); the `webServer` starts the dev server with dummy env, so no real backend is contacted.

Vitest runs in the `node` environment and only matches `src/**/*.test.ts` (see `vitest.config.ts`); Playwright owns `tests/e2e` only. There are no DOM/component unit tests — logic is extracted into pure, testable modules (e.g. `transferLogic.ts`, `mappers.ts`) precisely so it can be unit-tested without React.

**CI** (`.github/workflows/ci.yml`) runs on PRs and pushes to `main`: one job does `npm ci` → `test` → `lint` → `build`, and a parallel job runs the Playwright e2e suite. A second workflow (`.github/workflows/keepalive.yml`) runs a daily REST query against `brands` so Supabase doesn't pause the Free plan project for 7 days of inactivity; it needs `SUPABASE_URL`/`SUPABASE_ANON_KEY` repository secrets.

## Environment

Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` (copy `.env.example`). `src/lib/supabase.ts` throws at import time if either is missing. Deployed on Vercel; `vercel.json` rewrites all routes to `/index.html` for SPA routing.

## Architecture

Single-page React 18 + TypeScript + Vite app. A "staff monitor" for retail: brands operate in outlets, staff are posted to a brand+outlet, and follow-up checklists track store visits. **All styling is inline `style={}` objects driven by CSS variables** (see `src/theme.ts` and `src/index.css`) — there is no CSS framework or `.module.css`. `index.css` also defines a motion token system: `--motion-dur`/`--motion-dur-fast`/`--motion-ease` plus keyframes (`fadein`/`slidein`/`pop`/`backdrop`), all neutralized under `prefers-reduced-motion`.

### Two separate state systems (do not conflate them)

1. **Server data** — Supabase tables, read through React Query. `src/data/queries/useData.ts` runs five `useQuery` calls (brands, outlets, stores, staff, followups) and returns a combined `DataSnapshot`. Mutations live in `src/data/queries/use*Mutations.ts` and invalidate query keys from `src/data/queries/keys.ts` on success. This is the source of truth for domain entities.
2. **UI/view state** — `src/data/store.tsx` (`StoreProvider`/`useStore`), a plain `useState` + actions context. Holds navigation (`activeScreen`), filters, search, and which modals/drawers are open. **No domain data lives here.** `isMobile` is derived from a `matchMedia` listener at the `MOBILE_BREAKPOINT` (768px), not a manual toggle. A subset (screen, visit filter, search `q`, manage tab) is mirrored into the URL hash via `src/data/urlState.ts` (pure `toHash`/`parseHash`), with `store.tsx` writing on change and applying `popstate` for Back/Forward. User settings (theme pref, accent, density) live in `src/data/settings.ts`, persisted to `localStorage` — this is UI preference, not domain data.

### Data flow

- DB rows (snake_case) are converted to the domain model (camelCase) by **mappers** in `src/data/queries/mappers.ts`. Always go through mappers; don't pass raw rows around.
- The domain model is in `src/data/model.ts`. Key relationship: **Brand↔Outlet is many-to-many**, joined by the `Store` row (`{ brandId, outletId }`). Staff and follow-ups reference a brand and outlet directly.
- **Derived/view-model computation** is in `src/data/derived.ts` — `fuVM`, status/overdue logic, tenure, lookups (`brandById`, etc.), date formatting. Components consume these helpers rather than recomputing. Note these lookups (`brandById`, `outletById`, `staffById`) assume the id exists and use `!`.
- **Photo evidence:** images are downscaled client-side (`src/data/imageResize.ts`), uploaded to the private `task-photos` bucket, and displayed via short-lived signed URLs; each object is mirrored by a `task_photos` row. The client must delete storage objects before deleting the owning task/visit (see the 0016 note above).
- **CSV export:** `src/data/csvExport.ts` is a pure RFC-4180 serializer; `fetchVisitsForExport` (in `src/data/queries/useVisitsPage.ts`, `EXPORT_CAP = 2000`) pulls the filtered rows to export.
- Recent feature logic follows the pure-module pattern: bulk selection (`bulkSelection.ts`) and staff performance stats (`staffStats.ts`), each with a `.test.ts`.

### App shell

- `src/main.tsx` wires providers: `QueryClientProvider` → `AuthProvider` → `App`.
- `src/auth/AuthProvider.tsx` (`useSession`) gates the app: unauthenticated users see `Login` (email/password + Google OAuth via Supabase Auth); only when a session exists does `StoreProvider` + `Shell` mount. Extras: a `PASSWORD_RECOVERY` event routes to the `ResetPassword` screen; the settings account section requires current-password re-verification to change a password, and hides the password form for OAuth-only accounts (`src/auth/accountProviders.ts` inspects `user.identities`).
- `src/App.tsx` `Shell` is a screen switcher driven by `state.activeScreen`. Screens live in `src/screens/`, modals/drawers in `src/components/`. Mobile renders `BottomNav`, desktop renders `Sidebar`.
- Overlays go through app-level providers instead of native dialogs: `ToastProvider` (`useToast`) and `ConfirmProvider` (`useConfirm`) replace `alert`/`confirm`; `useDialogA11y` gives modals/drawers shared semantics (role/aria, escape-close, focus trap + restoration, nesting stack).

### Backend / migrations

SQL migrations in `supabase/migrations/`, applied manually via the Supabase SQL editor (in order). `0001_init.sql` creates the schema with **permissive** RLS; `0002_auth_rls.sql` replaces those with authenticated-only policies; `0003_per_user_scoping.sql` wipes existing data and adds per-user row scoping via an `owner_id` column (defaulting to `auth.uid()`) with RLS policies of `owner_id = auth.uid()` on every table. Each signed-in user sees and mutates only the rows it created. FK deletes are `restrict` (brands/outlets referenced by staff/stores can't be deleted), which surfaces a clear error to the user; `staff_history` and `follow_up_tasks` cascade.

`0014_recurring_schedules.sql` adds recurring visit schedules (weekly/monthly): occurrences are not stored server-side but materialized into `visits` rows client-side by `useAutoGenerateVisits` (once per session) using the pure `nextOccurrence`/`dueOccurrences` logic in `src/data/recurrence.ts`, with `last_generated` on the schedule row preventing duplicate generation. `0015_recurring_lead_days.sql` adds a per-schedule `lead_days` (0–30): an occurrence is materialized up to `lead_days` before its date (`dueOccurrences` compares against a `today + leadDays` horizon), while the visit's `date` stays the occurrence date.

`0016_task_photos.sql` adds photo evidence: a **private** `task-photos` storage bucket (objects at `<uid>/<task_id>/<uuid>.jpg`, storage RLS scoping by uid prefix) plus a `task_photos` row per object. `task_photos` cascades on task/visit delete, but Postgres can't delete storage objects — **the client is responsible for removing storage objects before deleting a task/visit** (see `useTaskPhotos`/`useVisitMutations`). `0017_outlet_sort.sql` adds `outlets.sort` for manual reordering (parity with `brands.sort` from 0012).

## Conventions

- Extract non-trivial logic into a pure module with a `.test.ts` rather than embedding it in a component or mutation (the transfer flow is the model: `transferLogic.ts` + `transferLogic.test.ts`).
- When changing what's fetched, update `keys.ts`, the `useData` query, the mapper, and the `model.ts` type together.
