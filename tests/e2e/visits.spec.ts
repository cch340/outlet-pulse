import { test, expect } from '@playwright/test'
import { stubSupabase } from './support/stubSupabase'

test.describe('visits screen', () => {
  test.beforeEach(async ({ page }) => {
    await stubSupabase(page)
    await page.goto('/#/visits')
  })

  test('renders the stubbed visit rows', async ({ page }) => {
    await expect(page.getByText('Acme · Downtown Mall')).toBeVisible()
    await expect(page.getByText('Globex · Airport')).toBeVisible()
  })

  test('search filters the list (RPC receives p_search)', async ({ page }) => {
    await expect(page.getByText('Acme · Downtown Mall')).toBeVisible()

    await page.getByRole('textbox', { name: /Search visits/ }).fill('Globex')

    // Debounced (~250ms) store update re-runs the visits_page RPC with p_search.
    await expect(page.getByText('Globex · Airport')).toBeVisible()
    await expect(page.getByText('Acme · Downtown Mall')).toHaveCount(0)
  })

  test('opening a visit shows its checklist in the drawer', async ({ page }) => {
    await page.getByText('Acme · Downtown Mall').click()

    const drawer = page.getByRole('dialog', { name: 'Visit details' })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText('Checklist')).toBeVisible()
    await expect(drawer.getByText('Verify stock')).toBeVisible()
  })
})
