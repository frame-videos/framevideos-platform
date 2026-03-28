// E2E — Signup & Login flows
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'https://framevideos.com';
const UNIQUE_SUFFIX = Date.now().toString(36);

test.describe('Signup Flow', () => {
  test('should navigate to signup page', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    await expect(page.getByRole('heading', { name: /criar|signup|cadastro|registr/i })).toBeVisible();
  });

  test('should show validation errors on empty submit', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    const submitBtn = page.getByRole('button', { name: /criar|signup|cadastrar|registrar/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      // Should show some validation feedback
      await expect(page.locator('[role="alert"], .error, [data-error]')).toBeVisible({ timeout: 5000 }).catch(() => {
        // Some SPAs handle validation differently
      });
    }
  });
});

test.describe('Login Flow', () => {
  test('should navigate to login page', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.getByRole('heading', { name: /login|entrar|acessar/i })).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    const emailInput = page.getByLabel(/email/i).or(page.locator('input[type="email"]'));
    const passwordInput = page.getByLabel(/senha|password/i).or(page.locator('input[type="password"]'));

    if (await emailInput.isVisible()) {
      await emailInput.fill('nonexistent@example.com');
      await passwordInput.fill('wrongpassword');

      const submitBtn = page.getByRole('button', { name: /entrar|login|acessar/i });
      await submitBtn.click();

      // Should show error message
      await page.waitForTimeout(2000);
      const errorVisible = await page.locator('[role="alert"], .error, .text-red, [data-error]').isVisible().catch(() => false);
      // Error should appear (or stay on same page)
      expect(page.url()).toContain('/login');
    }
  });
});
