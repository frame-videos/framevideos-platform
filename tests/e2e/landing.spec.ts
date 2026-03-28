// E2E — Landing page (SaaS website)
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://framevideos.com';

test.describe('Landing Page', () => {
  test('should load the landing page', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/Frame Videos/i);
  });

  test('should have a CTA button', async ({ page }) => {
    await page.goto(BASE_URL);
    const cta = page.getByRole('link', { name: /começar|signup|criar|start/i });
    await expect(cta).toBeVisible();
  });

  test('should have navigation links', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByRole('navigation')).toBeVisible();
  });
});
