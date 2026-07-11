# Roadmap

Trajectory and deferred designs for Outlet Pulse. Deferred items below carry
enough detail to implement without re-deriving the decisions; verify code
references before building, as the codebase moves.

## Completed

Recent shipped work (one line each):

- **#31 — UX foundation:** in-app toast + confirm-dialog system replacing native
  `alert`/`confirm`; settings menu (theme/accent/density) persisted to
  localStorage; staff detail modal with posting-history timeline; Visits search.
- **#32 — Recurring + routing:** recurring visit schedules (weekly/monthly) with
  client-side auto-generation and per-schedule lead days; URL hash routing
  (screen/filters/search with Back/Forward); search + sort on brands/outlets/staff.
- **#33 — Export + a11y:** CSV export of filtered visits and monthly failed tasks
  (with a confirm dialog explaining filter scope); shared dialog accessibility
  (role/aria, escape-close, focus trap + restoration).
- **#34 — Account + digest:** password-reset flow and account section (current-
  password re-verification, OAuth-only accounts hide the password form);
  once-per-session overdue digest toast; delete a visit from the drawer.
- **#35 — Photo evidence:** task-photo storage (private bucket + `task_photos`
  table, upload/signed-url data layer); capture/view/delete photos in the visit
  drawer; photo count on visit rows and in the CSV export.
- **#36 — Polish batch:** manual outlet reordering (`outlets.sort`, parity with
  brands); filter brands by category and outlets by location; correct a staff
  posting in place without a transfer-history entry; CI/package-lock fixes.
- **This batch — Analytics + bulk + quality:** staff performance section (visit
  stats + 6-month trend in the detail modal); bulk select on visits (mark-done,
  delete, CSV export); ESLint flat config + lint step in CI; Playwright e2e smoke
  suite (stubbed Supabase) wired into CI.

## Deferred

### 1. Out-of-app notifications for overdue visits

**Status:** deferred. In-app digest already ships — a once-per-session info toast
via `src/components/useOverdueDigest.ts` (uses `useOverdueCount` +
`overdueDigest.ts`), suppressed when the user deep-linked into the overdue view.

**Planned:** a Supabase Edge Function invoked on a schedule (Supabase cron /
pg_cron + pg_net, or the dashboard scheduler) that, per user, finds overdue
visits — pending status derived from `visit_tasks`, `date < today` — mirroring
the `visit_with_status` view logic (see migration `0007_visit_pagination.sql`
and later `0008`–`0011`). It sends an email digest through an email API (e.g.
Resend free tier).

**Requires:**
- Deploy the Edge Function.
- `EMAIL_API_KEY` (or equivalent) stored as a function secret.
- User email preferences: a small settings table or column, opt-in.
- Unsubscribe handling.

**Web push** is a further step: service worker + a push-subscription table +
VAPID keys.

**Notes:** one-time dashboard setup by the owner; no client-code blockers. If
both this and Team/sharing (#2) are wanted, build this **after** #2 so it isn't
rewritten against per-user assumptions.

### 2. Team / sharing (biggest architectural feature)

**Status:** deferred. Today the app enforces **hard per-user isolation**: every
table has `owner_id default auth.uid()` with RLS `owner_id = auth.uid()`
(`0003_per_user_scoping.sql`).

**Planned shape:**
- `workspaces` table + `workspace_members` (`user_id`, `role` = manager | staff)
  + invites.
- Every domain table gains `workspace_id`.
- **All** RLS policies rewritten from owner-match to workspace-membership match,
  with role-gated writes where needed.
- Data migration: backfill a personal workspace per existing user and move their
  rows into it.

**Open design questions (resolve with the owner before building):**
- Who can create/edit brands and outlets — manager-only?
- Do staff members see all workspace visits, or only their own?
- Single vs multiple workspaces per account?
- Are "staff" app-users the same as `staff`-table entities — i.e. does a `staff`
  row link to an auth user?

**Notes:** build in phases. This is the largest change and touches every RLS
policy; sequence it before #1 if both are planned.

### 3. PWA offline

**Status:** deferred, documented-only. Owner's call, 2026-07-11 — stays a plan
unless there's demonstrated need. If ever built, **Phase 1 only.**

**Phase 1 (cheap, real value):**
- `vite-plugin-pwa` precaching the app shell — installable, instant open.
- Persist the React Query cache to IndexedDB
  (`@tanstack/react-query-persist-client`) so last-seen data is readable offline.
- An "offline — showing cached data" banner.
- Block mutations while offline with a clear message.
- Accepted limitation: photos won't render offline (signed URLs expire).

**Phase 2 (defer indefinitely, only on demonstrated need):**
- Offline mutation outbox with retry + conflict handling against Supabase.
