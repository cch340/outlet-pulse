import { test, expect } from '@playwright/test'
import { stubSupabase } from './support/stubSupabase'

test.describe('login (unauthenticated)', () => {
  test('renders the Login screen when there is no session', async ({ page }) => {
    // No session seeded → getSession() returns null → App shows <Login/>.
    await stubSupabase(page, { authenticated: false })
    await page.goto('/')

    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /Continue with Google/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Forgot password?' })).toBeVisible()
  })
})
