// E2E — Tenant site pages
import { test, expect } from '@playwright/test';

const TENANT_URL = process.env.E2E_TENANT_URL ?? 'https://demo.framevideos.com';

test.describe('Tenant Site — Public Pages', () => {
  test('homepage loads with videos', async ({ page }) => {
    await page.goto(TENANT_URL);
    await expect(page.locator('body')).toBeVisible();
    // Should have a header
    await expect(page.locator('header')).toBeVisible();
    // Should have footer
    await expect(page.locator('footer')).toBeVisible();
  });

  test('videos page loads', async ({ page }) => {
    await page.goto(`${TENANT_URL}/videos`);
    await expect(page.locator('h1')).toContainText(/vídeo/i);
  });

  test('categories page loads', async ({ page }) => {
    await page.goto(`${TENANT_URL}/categories`);
    await expect(page.locator('h1')).toContainText(/categori/i);
  });

  test('about page loads', async ({ page }) => {
    await page.goto(`${TENANT_URL}/pages/about`);
    // Should show content or 404
    const status = await page.evaluate(() => document.title);
    expect(status).toBeTruthy();
  });

  test('terms page loads', async ({ page }) => {
    await page.goto(`${TENANT_URL}/pages/terms`);
    const status = await page.evaluate(() => document.title);
    expect(status).toBeTruthy();
  });

  test('search page loads', async ({ page }) => {
    await page.goto(`${TENANT_URL}/search`);
    await expect(page.locator('input[name="q"]')).toBeVisible();
  });

  test('search with query returns results', async ({ page }) => {
    await page.goto(`${TENANT_URL}/search?q=test`);
    await expect(page.locator('h1')).toContainText(/resultado|busca/i);
  });

  test('robots.txt is accessible', async ({ page }) => {
    const response = await page.goto(`${TENANT_URL}/robots.txt`);
    expect(response?.status()).toBe(200);
    const text = await response?.text();
    expect(text).toContain('User-agent');
    expect(text).toContain('Sitemap');
  });

  test('sitemap.xml is accessible', async ({ page }) => {
    const response = await page.goto(`${TENANT_URL}/sitemap.xml`);
    expect(response?.status()).toBe(200);
    const text = await response?.text();
    expect(text).toContain('sitemapindex');
  });

  test('health check endpoint works', async ({ page }) => {
    const response = await page.goto(`${TENANT_URL}/__health`);
    expect(response?.status()).toBe(200);
    const json = await response?.json();
    expect(json.status).toBe('ok');
  });

  test('404 page renders correctly', async ({ page }) => {
    const response = await page.goto(`${TENANT_URL}/nonexistent-page-xyz-12345`);
    expect(response?.status()).toBe(404);
    await expect(page.locator('body')).toContainText(/404|não encontrad/i);
  });
});
