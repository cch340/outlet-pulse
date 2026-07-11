import { test, expect } from '@playwright/test'
import { stubSupabase } from './support/stubSupabase'

test.describe('app shell (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await stubSupabase(page)
    await page.goto('/')
  })

  test('loads straight into the Dashboard', async ({ page }) => {
    // Dashboard section headers + the always-present stat strip.
    await expect(page.getByText('Monthly performance')).toBeVisible()
    await expect(page.getByText('Current status')).toBeVisible()
    await expect(page.getByText('Staff monitored')).toBeVisible()
  })

  test('navigates between screens via the sidebar and updates the URL hash', async ({ page }) => {
    // Visits
    await page.getByRole('button', { name: 'Visits' }).click()
    await expect(page).toHaveURL(/#\/visits/)
    await expect(page.getByRole('combobox', { name: 'Status' })).toBeVisible()

    // Stores
    await page.getByRole('button', { name: 'Stores' }).click()
    await expect(page).toHaveURL(/#\/stores/)
    await expect(page.getByText('Downtown Mall')).toBeVisible()

    // Manage
    await page.getByRole('button', { name: 'Manage' }).click()
    await expect(page).toHaveURL(/#\/manage/)
    await expect(page.getByRole('button', { name: 'Recurring' })).toBeVisible()
  })

  test('browser Back returns to the previous screen', async ({ page }) => {
    await page.getByRole('button', { name: 'Visits' }).click()
    await expect(page).toHaveURL(/#\/visits/)
    await page.getByRole('button', { name: 'Stores' }).click()
    await expect(page).toHaveURL(/#\/stores/)

    await page.goBack()
    await expect(page).toHaveURL(/#\/visits/)
    await expect(page.getByRole('combobox', { name: 'Status' })).toBeVisible()
  })
})
