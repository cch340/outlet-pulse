---
name: add-entity-field
description: Background checklist for adding or changing a fetched domain field, keeping the DB column, query, mapper, and model type in sync. Applies whenever a server-data field is added, renamed, or removed.
user-invocable: false
---

# add-entity-field

When changing what the app fetches from Supabase, these pieces must move
**together** or the data silently breaks (a column exists but never reaches a
component, or a mapper reads a field the query didn't select).

## The four files to update in lockstep

1. **DB column** — a migration in `supabase/migrations/` (use `create-migration`).
2. **`src/data/queries/keys.ts`** — the query key, if the fetch shape changes.
3. **`src/data/queries/useData.ts`** — the `useQuery` `select`/columns for that entity.
4. **`src/data/queries/mappers.ts`** — map the new snake_case DB field to the
   camelCase domain field. Never pass raw rows around; always go through mappers.
5. **`src/data/model.ts`** — add/adjust the field on the domain type.

## Rules

- DB rows are **snake_case**; the domain model is **camelCase**. The mapper is the
  only place that boundary is crossed.
- **Brand↔Outlet is many-to-many**, joined by the `Store` row (`{ brandId, outletId }`).
  Staff and follow-ups reference a brand and outlet directly.
- Derived/view-model logic (status, overdue, tenure, formatting, `brandById` and
  friends) lives in `src/data/derived.ts` — compute there, don't recompute in
  components. Note `brandById`/`outletById`/`staffById` assume the id exists (`!`).
- If the field feeds non-trivial logic, extract it into a pure module with a
  co-located `.test.ts` rather than embedding it in a component or mutation
  (`transferLogic.ts` is the model).

## Quick self-check before finishing

- Does the query actually `select` the new column?
- Does the mapper read it, and the model type declare it?
- Is the value consumed via `derived.ts` helpers, not recomputed inline?
- `npm run build` passes (strict, `noUnusedLocals`/`noUnusedParameters`)?
