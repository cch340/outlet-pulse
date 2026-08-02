import type { VercelRequest, VercelResponse } from '@vercel/node'

// Supabase pauses Free plan projects after 7 days without database activity.
// This runs on a daily Vercel cron (see `crons` in vercel.json) and issues one
// real PostgREST query, which resets the inactivity window.
//
// It has to be an authenticated query: an unauthenticated request is rejected
// at the Supabase API gateway with a 401 and never reaches Postgres, so it
// would not count as activity. Per-user RLS (`owner_id = auth.uid()`) means the
// anon key matches no rows and the response is an empty array — that is
// expected. What matters is that the query reaches the database.

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // Vercel signs cron invocations with CRON_SECRET when the env var is set.
  // Without it the endpoint is publicly reachable, so treat a missing secret as
  // a misconfiguration rather than silently accepting anonymous callers.
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.authorization !== `Bearer ${cronSecret}`) {
    return response.status(401).json({ ok: false, error: 'unauthorized' })
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return response
      .status(500)
      .json({ ok: false, error: 'supabase env vars not configured' })
  }

  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/brands?select=id&limit=1`

  try {
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`Supabase keep-alive failed: ${res.status} ${body}`)
      return response
        .status(502)
        .json({ ok: false, status: res.status, error: body.slice(0, 500) })
    }

    return response.status(200).json({ ok: true, status: res.status })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Supabase keep-alive threw: ${message}`)
    return response.status(502).json({ ok: false, error: message })
  }
}
