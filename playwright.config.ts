import { defineConfig, devices } from '@playwright/test'

/**
 * E2E config. The dev server runs with dummy Supabase env vars so
 * `src/lib/supabase.ts` doesn't throw at import — all network to *.supabase.co
 * is stubbed in tests (see tests/e2e/support/stubSupabase.ts), so no real
 * backend is ever contacted. The stub project ref is `stub` (host
 * stub.supabase.co), which fixes the auth storage key to `sb-stub-auth-token`.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:
      'VITE_SUPABASE_URL=https://stub.supabase.co VITE_SUPABASE_ANON_KEY=stub-key npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
