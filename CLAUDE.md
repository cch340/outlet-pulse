# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server.
- `npm run build` — type-check (`tsc -b`) then production `vite build`. The build fails on unused locals/params (`tsconfig` has `noUnusedLocals`/`noUnusedParameters`).
- `npm test` — run the Vitest suite once (`vitest run`).
- Run a single test file: `npx vitest run src/data/queries/transferLogic.test.ts`. Watch a file: `npx vitest src/data/queries/mappers.test.ts`.

Tests run in the `node` environment and only match `src/**/*.test.ts` (see `vitest.config.ts`) — there are no DOM/component tests; logic is extracted into pure, testable modules (e.g. `transferLogic.ts`, `mappers.ts`) precisely so it can be unit-tested without React.

## Environment

Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` (copy `.env.example`). `src/lib/supabase.ts` throws at import time if either is missing. Deployed on Vercel; `vercel.json` rewrites all routes to `/index.html` for SPA routing.

## Architecture

Single-page React 18 + TypeScript + Vite app. A "staff monitor" for retail: brands operate in outlets, staff are posted to a brand+outlet, and follow-up checklists track store visits. **All styling is inline `style={}` objects driven by CSS variables** (see `src/theme.ts` and `src/index.css`) — there is no CSS framework or `.module.css`.

### Two separate state systems (do not conflate them)

1. **Server data** — Supabase tables, read through React Query. `src/data/queries/useData.ts` runs five `useQuery` calls (brands, outlets, stores, staff, followups) and returns a combined `DataSnapshot`. Mutations live in `src/data/queries/use*Mutations.ts` and invalidate query keys from `src/data/queries/keys.ts` on success. This is the source of truth for domain entities.
2. **UI/view state** — `src/data/store.tsx` (`StoreProvider`/`useStore`), a plain `useState` + actions context. Holds navigation (`activeScreen`), filters, search, and which modals/drawers are open. **No domain data lives here.** `isMobile` is derived from a `matchMedia` listener at the `MOBILE_BREAKPOINT` (768px), not a manual toggle.

### Data flow

- DB rows (snake_case) are converted to the domain model (camelCase) by **mappers** in `src/data/queries/mappers.ts`. Always go through mappers; don't pass raw rows around.
- The domain model is in `src/data/model.ts`. Key relationship: **Brand↔Outlet is many-to-many**, joined by the `Store` row (`{ brandId, outletId }`). Staff and follow-ups reference a brand and outlet directly.
- **Derived/view-model computation** is in `src/data/derived.ts` — `fuVM`, status/overdue logic, tenure, lookups (`brandById`, etc.), date formatting. Components consume these helpers rather than recomputing. Note these lookups (`brandById`, `outletById`, `staffById`) assume the id exists and use `!`.

### App shell

- `src/main.tsx` wires providers: `QueryClientProvider` → `AuthProvider` → `App`.
- `src/auth/AuthProvider.tsx` (`useSession`) gates the app: unauthenticated users see `Login` (email/password + Google OAuth via Supabase Auth); only when a session exists does `StoreProvider` + `Shell` mount.
- `src/App.tsx` `Shell` is a screen switcher driven by `state.activeScreen`. Screens live in `src/screens/`, modals/drawers in `src/components/`. Mobile renders `BottomNav`, desktop renders `Sidebar`.

### Backend / migrations

SQL migrations in `supabase/migrations/`, applied manually via the Supabase SQL editor (in order). `0001_init.sql` creates the schema with **permissive** RLS; `0002_auth_rls.sql` replaces those with authenticated-only policies; `0003_per_user_scoping.sql` wipes existing data and adds per-user row scoping via an `owner_id` column (defaulting to `auth.uid()`) with RLS policies of `owner_id = auth.uid()` on every table. Each signed-in user sees and mutates only the rows it created. FK deletes are `restrict` (brands/outlets referenced by staff/stores can't be deleted), which surfaces a clear error to the user; `staff_history` and `follow_up_tasks` cascade.

## Conventions

- Extract non-trivial logic into a pure module with a `.test.ts` rather than embedding it in a component or mutation (the transfer flow is the model: `transferLogic.ts` + `transferLogic.test.ts`).
- When changing what's fetched, update `keys.ts`, the `useData` query, the mapper, and the `model.ts` type together.
