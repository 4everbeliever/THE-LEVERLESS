import { test, expect } from '@playwright/test'

test.describe('Smoke tests', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login')

    await expect(page).toHaveTitle(/ToolShed Rentals/i)
    await expect(page.getByRole('heading', { name: /Welcome back|Create your account/i })).toBeVisible()
    await expect(page.getByLabel(/Email address/i)).toBeVisible()
    await expect(page.getByLabel(/Password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Sign in|Create account/i })).toBeVisible()
  })

  test('/dashboard redirects to /login when signed out', async ({ page }) => {
    await page.goto('/dashboard')

    // Expect navigation redirect to /login
    await page.waitForURL('**/login**')
    expect(page.url()).toContain('/login')
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible()
  })
})
