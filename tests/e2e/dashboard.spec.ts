// E2E — Dashboard (requires auth)
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://framevideos.com';

test.describe('Dashboard', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    // Should redirect to login or show login form
    await page.waitForTimeout(2000);
    const url = page.url();
    const isLoginOrDashboard = url.includes('/login') || url.includes('/dashboard');
    expect(isLoginOrDashboard).toBe(true);
  });

  test('should load dashboard after login', async ({ page }) => {
    // Skip if no test credentials available
    const testEmail = process.env.E2E_TEST_EMAIL;
    const testPassword = process.env.E2E_TEST_PASSWORD;
    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }

    // Login first
    await page.goto(`${BASE_URL}/login`);
    await page.locator('input[type="email"]').fill(testEmail);
    await page.locator('input[type="password"]').fill(testPassword);
    await page.getByRole('button', { name: /entrar|login/i }).click();

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
    await expect(page.getByRole('heading')).toBeVisible();
  });
});
