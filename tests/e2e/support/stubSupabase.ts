import type { Page, Route, Request } from '@playwright/test'

/**
 * Everything needed to run the app against a fully faked Supabase backend:
 *  - a seeded, valid-shaped auth session in localStorage (no login flow), and
 *  - `page.route` handlers for every REST/RPC/auth endpoint the smoke path hits.
 *
 * The dev server is started (see playwright.config.ts) with
 * VITE_SUPABASE_URL=https://stub.supabase.co, so supabase-js derives the auth
 * storage key `sb-<ref>-auth-token` where ref = host.split('.')[0] = 'stub'.
 */
export const PROJECT_REF = 'stub'
export const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`
export const SUPABASE_HOST = 'stub.supabase.co'

// ---- fixtures (snake_case rows exactly as PostgREST would return them) ------

export const BRANDS = [
  { id: 'b1', name: 'Acme', color: '#ef4444', category: 'Fashion', sort: 0 },
  { id: 'b2', name: 'Globex', color: '#3b82f6', category: 'Food', sort: 1 },
]

export const OUTLETS = [
  { id: 'o1', name: 'Downtown Mall', location: 'Central', sort: 0 },
  { id: 'o2', name: 'Airport', location: 'North', sort: 1 },
]

export const STORES = [
  { brand_id: 'b1', outlet_id: 'o1' },
  { brand_id: 'b2', outlet_id: 'o2' },
]

export const STAFF = [
  {
    id: 's1',
    name: 'Alice',
    brand_id: 'b1',
    outlet_id: 'o1',
    role: 'Promoter',
    phone: '+15550001111',
    joined: '2025-01-01',
    staff_history: [],
  },
  {
    id: 's2',
    name: 'Bob',
    brand_id: 'b2',
    outlet_id: 'o2',
    role: 'Promoter',
    phone: null,
    joined: '2025-02-01',
    staff_history: [],
  },
]

export const TASK_TEMPLATES = [
  { id: 't1', label: 'Check signage', sort: 0 },
  { id: 't2', label: 'Verify stock', sort: 1 },
]

// Full visit rows (as `visits` + nested `visit_tasks` would return). Each also
// carries a `_search` blob so the visits_page stub can emulate p_search.
export const VISITS = [
  {
    id: 'v1',
    date: '2026-07-10',
    staff_id: 's1',
    brand_id: 'b1',
    outlet_id: 'o1',
    _search: 'acme downtown mall alice',
    visit_tasks: [
      { id: 'vt1', visit_id: 'v1', label: 'Check signage', status: 'success', remark: '', sort: 0 },
      { id: 'vt2', visit_id: 'v1', label: 'Verify stock', status: 'pending', remark: '', sort: 1 },
    ],
  },
  {
    id: 'v2',
    date: '2026-07-05',
    staff_id: 's2',
    brand_id: 'b2',
    outlet_id: 'o2',
    _search: 'globex airport bob',
    visit_tasks: [
      { id: 'vt3', visit_id: 'v2', label: 'Check signage', status: 'failed', remark: 'Torn poster', sort: 0 },
    ],
  },
]

const DASHBOARD_SUMMARY = {
  kpis_month: { total: 4, done: 2, pending: 1, overdue: 1 },
  kpis_year: { total: 12, done: 8, pending: 2, overdue: 2 },
  trend: [
    { month: '2026-06', done: 3, total: 5 },
    { month: '2026-07', done: 2, total: 4 },
  ],
  brand_breakdown: [
    { brand_id: 'b1', done: 1, total: 2 },
    { brand_id: 'b2', done: 1, total: 2 },
  ],
  overdue: [
    { id: 'v2', date: '2026-07-05', brand_name: 'Globex', outlet_name: 'Airport', staff_name: 'Bob' },
  ],
  upcoming: [
    { id: 'v1', date: '2026-07-10', brand_name: 'Acme', outlet_name: 'Downtown Mall', staff_name: 'Alice' },
  ],
  overdue_total: 1,
  upcoming_total: 1,
}

const LATEST_FAILED_TASKS = [
  {
    id: 'v2',
    brand_id: 'b2',
    outlet_id: 'o2',
    date: '2026-07-05',
    brand_name: 'Globex',
    outlet_name: 'Airport',
    staff_name: 'Bob',
    base_status: 'attention',
    failed: [{ label: 'Check signage', remark: 'Torn poster' }],
  },
]

// ---- helpers ----------------------------------------------------------------

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  })
}

/** A far-future, valid-shaped session so getSession() returns it without any
 *  network refresh (supabase-js only refreshes once within EXPIRY_MARGIN). */
function fakeSession() {
  const user = {
    id: '00000000-0000-0000-0000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'e2e@example.com',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  }
  const farFuture = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 // +1 year
  return {
    access_token: 'stub-access-token',
    refresh_token: 'stub-refresh-token',
    token_type: 'bearer',
    expires_in: 60 * 60 * 24 * 365,
    expires_at: farFuture,
    user,
  }
}

function searchOf(req: Request): string {
  try {
    const body = req.postDataJSON() as Record<string, unknown> | null
    const s = body && typeof body.p_search === 'string' ? body.p_search : ''
    return s.trim().toLowerCase()
  } catch {
    return ''
  }
}

function matchingVisits(search: string) {
  if (!search) return VISITS
  return VISITS.filter((v) => v._search.includes(search))
}

// ---- routing ----------------------------------------------------------------

async function handleRest(route: Route, url: URL) {
  const path = url.pathname // e.g. /rest/v1/brands  or  /rest/v1/rpc/visits_page

  // RPCs (POST /rest/v1/rpc/<name>)
  if (path.includes('/rpc/')) {
    const fn = path.split('/rpc/')[1]
    const req = route.request()
    switch (fn) {
      case 'visits_page': {
        const rows = matchingVisits(searchOf(req))
        return json(route, rows.map((v) => ({ id: v.id, total_count: rows.length })))
      }
      case 'visit_status_counts': {
        const rows = matchingVisits(searchOf(req))
        // Bucket everything as 'attention' — overdue stays 0 so the nav badge
        // (and Visits button accessible name) stays clean.
        return json(route, [{ status: 'attention', n: rows.length }])
      }
      case 'dashboard_summary':
        return json(route, DASHBOARD_SUMMARY)
      case 'latest_failed_tasks':
        return json(route, LATEST_FAILED_TASKS)
      case 'visits_missing_label':
        return json(route, [])
      default:
        return json(route, [])
    }
  }

  // Tables (GET /rest/v1/<table>?...)
  const table = path.replace('/rest/v1/', '').split('?')[0]
  switch (table) {
    case 'brands':
      return json(route, BRANDS)
    case 'outlets':
      return json(route, OUTLETS)
    case 'stores':
      return json(route, STORES)
    case 'staff':
      return json(route, STAFF)
    case 'task_templates':
      return json(route, TASK_TEMPLATES)
    case 'recurring_schedules':
      return json(route, [])
    case 'visits':
      return handleVisitsTable(route, url)
    case 'task_photos':
      return json(route, [])
    default:
      return json(route, [])
  }
}

const stripVisit = ({ _search, ...rest }: (typeof VISITS)[number]) => rest

/**
 * `GET /rest/v1/visits`. Two callers, distinguished by the `id` filter:
 *  - useVisitsPage does `.in('id', ids)`  → `id=in.(a,b)`  → array response.
 *  - useVisit does `.eq('id', id).maybeSingle()` → `id=eq.a` → single object.
 */
function handleVisitsTable(route: Route, url: URL) {
  const idParam = url.searchParams.get('id') ?? ''
  if (idParam.startsWith('eq.')) {
    const id = idParam.slice(3)
    const v = VISITS.find((x) => x.id === id)
    return json(route, v ? stripVisit(v) : null)
  }
  if (idParam.startsWith('in.')) {
    const ids = idParam.slice(3).replace(/[()]/g, '').split(',').filter(Boolean)
    return json(route, VISITS.filter((v) => ids.includes(v.id)).map(stripVisit))
  }
  return json(route, VISITS.map(stripVisit))
}

async function handleAuth(route: Route, url: URL) {
  const path = url.pathname
  const session = fakeSession()
  if (path.endsWith('/user')) return json(route, session.user)
  if (path.endsWith('/token')) return json(route, session)
  if (path.endsWith('/logout')) return route.fulfill({ status: 204, body: '' })
  return json(route, {})
}

/**
 * Seed the auth session then install network stubs for the whole *.supabase.co
 * surface. Call once per test before `page.goto`. When `authenticated` is false,
 * the session is not seeded (drives the Login screen).
 */
export async function stubSupabase(page: Page, { authenticated = true }: { authenticated?: boolean } = {}) {
  if (authenticated) {
    const session = fakeSession()
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key as string, value as string)
      },
      [STORAGE_KEY, JSON.stringify(session)],
    )
  }

  await page.route(`https://${SUPABASE_HOST}/**`, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.startsWith('/rest/v1/')) return handleRest(route, url)
    if (url.pathname.startsWith('/auth/v1/')) return handleAuth(route, url)
    // Storage or anything else in the smoke path: empty OK.
    return json(route, {})
  })
}
