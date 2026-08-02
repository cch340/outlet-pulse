# Outlet Pulse

A staff monitor for retail operations. Brands operate in outlets, staff are posted to a
brand + outlet, and follow-up checklists track store visits so nothing falls through the
cracks — with dashboards, recurring schedules, task photos, and CSV export.

Single-page app built with **React 18 + TypeScript + Vite**, backed by **Supabase**
(Postgres, Auth, Storage) and **React Query**.

## Prerequisites

- Node.js 20.19+ or 22.12+
- A [Supabase](https://supabase.com) project

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase values
npm run dev
```

The app requires the following variables in `.env.local` (see `.env.example`):

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

`src/lib/supabase.ts` throws at import time if either is missing.

### Database setup

Apply the SQL migrations in `supabase/migrations/` **in order**, via the Supabase SQL
editor. In brief:

- `0001_init.sql` — schema with permissive RLS.
- `0002_auth_rls.sql` — replaces those with authenticated-only policies.
- `0003_per_user_scoping.sql` — adds per-user row scoping (`owner_id = auth.uid()`), so each
  signed-in user sees and mutates only the rows they created. **This migration wipes existing data.**
- `0004`–`0017` — incremental features (task templates, visit pagination, dashboards,
  recurring schedules, staff phone/WhatsApp, task photos, sort ordering, etc.).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server. |
| `npm run build` | Type-check (`tsc -b`) then production `vite build`. Fails on unused locals/params. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run ESLint. |
| `npm test` | Run the Vitest suite once. |
| `npm run test:e2e` | Run the Playwright end-to-end tests. |

Run a single unit test file: `npx vitest run src/data/queries/transferLogic.test.ts`.

Tests run in the `node` environment and match `src/**/*.test.ts` — there are no DOM/component
unit tests. Non-trivial logic is extracted into pure, testable modules (e.g.
`transferLogic.ts`, `mappers.ts`, `recurrence.ts`) so it can be unit-tested without React.

## Architecture

The app keeps **two separate state systems** that are deliberately not conflated:

1. **Server data** — Supabase tables read through React Query. `src/data/queries/useData.ts`
   combines the domain queries into a single `DataSnapshot`. Mutations live in
   `src/data/queries/use*Mutations.ts` and invalidate query keys from `keys.ts` on success.
   This is the source of truth for domain entities.
2. **UI / view state** — `src/data/store.tsx` (`StoreProvider` / `useStore`), a plain
   `useState` + actions context holding navigation, filters, search, and open modals/drawers.
   **No domain data lives here.**

### Data flow

- DB rows (snake_case) are converted to the domain model (camelCase) by **mappers** in
  `src/data/queries/mappers.ts`. Always go through mappers.
- The domain model lives in `src/data/model.ts`. Key relationship: **Brand ↔ Outlet is
  many-to-many**, joined by the `Store` row (`{ brandId, outletId }`). Staff and follow-ups
  reference a brand and outlet directly.
- **Derived / view-model logic** lives in `src/data/derived.ts` (status/overdue logic,
  tenure, lookups, date formatting). Components consume these helpers rather than recomputing.

### App shell

- `src/main.tsx` wires providers: `QueryClientProvider` → `AuthProvider` → `App`.
- `src/auth/AuthProvider.tsx` gates the app: unauthenticated users see `Login`
  (email/password + Google OAuth via Supabase Auth). Only with a session do `StoreProvider`
  and the app shell mount.
- `src/App.tsx` is a screen switcher driven by `state.activeScreen`. Screens live in
  `src/screens/`, modals/drawers in `src/components/`. Mobile renders `BottomNav`; desktop
  renders `Sidebar`.

### Styling

All styling is via inline `style={}` objects driven by CSS variables (see `src/theme.ts` and
`src/index.css`). There is no CSS framework or `.module.css`.

## Project structure

```
src/
  auth/         AuthProvider, Login, password/provider helpers
  components/   Modals, drawers, nav, shared UI
  data/
    queries/    React Query hooks, mutations, mappers, keys
    *.ts        Pure logic modules (recurrence, csvExport, settings, …) + tests
    model.ts    Domain model types
    derived.ts  Derived/view-model helpers
    store.tsx   UI/view state provider
  lib/          Supabase client
  screens/      Top-level screens (Dashboard, Visits, Staff, Brands, …)
  theme.ts      Design tokens / CSS variables
supabase/
  migrations/   Ordered SQL migrations (applied manually)
tests/e2e/      Playwright end-to-end tests
```

## Deployment

Deployed on Vercel. `vercel.json` rewrites all routes to `/index.html` for SPA routing.
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in the Vercel
project.

### Keeping the Supabase project awake

Supabase pauses Free plan projects after 7 days without database activity.
`.github/workflows/keepalive.yml` runs a daily `select` against `brands` to reset that
window. It needs two repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | the anon/publishable key |

Trigger it once manually from the Actions tab to confirm it returns HTTP 200. Note that
GitHub disables scheduled workflows in repos with no commits for 60 days — if that happens,
re-enable it from the Actions tab. Upgrading to the Pro plan removes inactivity pausing
entirely and is the only guaranteed fix.

## Conventions

- Extract non-trivial logic into a pure module with a `.test.ts` rather than embedding it in
  a component or mutation (the transfer flow is the model: `transferLogic.ts` +
  `transferLogic.test.ts`).
- When changing what's fetched, update `keys.ts`, the `useData` query, the mapper, and the
  `model.ts` type together.
