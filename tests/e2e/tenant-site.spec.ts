// E2E — Tenant site pages
import { test, expect } from '@playwright/test';

const TENANT_URL = process.env.E2E_TENANT_URL ?? 'https://duovideos.com';

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
    // Pode ter múltiplos inputs "q" (header desktop, mobile, search page)
    await expect(page.locator('input[name="q"]').first()).toBeVisible();
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

test.describe('Tenant Site — Performance Optimizations', () => {
  // Testes de CSS estático — rodam após deploy com as otimizações
  test('CSS estático serve com cache immutable', async ({ request }) => {
    const homeResp = await request.get(TENANT_URL);
    const html = await homeResp.text();

    // Extrair o path do CSS do HTML (pode ser inline ou externo dependendo do deploy)
    const cssMatch = html.match(/href="(\/assets\/styles-[^"]+\.css)"/);
    if (!cssMatch) {
      // CSS ainda inline (pré-deploy) — skip graceful
      test.skip();
      return;
    }
    const cssPath = cssMatch[1];

    // Buscar o CSS
    const cssResp = await request.get(`${TENANT_URL}${cssPath}`);
    expect(cssResp.status()).toBe(200);

    // Verificar headers
    const headers = cssResp.headers();
    expect(headers['content-type']).toContain('text/css');
    expect(headers['cache-control']).toContain('immutable');
    expect(headers['cache-control']).toContain('max-age=31536000');

    // Verificar que o conteúdo é CSS válido
    const cssText = await cssResp.text();
    expect(cssText.length).toBeGreaterThan(5000); // ~11KB de CSS
    expect(cssText).toContain('box-sizing');
    expect(cssText).toContain('border-radius');
  });

  test('homepage não contém CSS inline grande (pós-deploy)', async ({ request }) => {
    const resp = await request.get(TENANT_URL);
    const html = await resp.text();

    // Se CSS externo ainda não deployado, skip graceful
    if (!html.includes('/assets/styles-')) {
      test.skip();
      return;
    }

    // Não deve ter o CSS inline gigante (o bloco "Critical CSS")
    const styleBlocks = html.match(/<style[^>]*>[\s\S]*?<\/style>/g) || [];
    for (const block of styleBlocks) {
      // Nenhum bloco <style> deve ter mais de 2KB (o CSS principal era ~11KB)
      expect(block.length).toBeLessThan(2000);
    }
  });

  test('homepage retorna headers esperados', async ({ request }) => {
    const resp = await request.get(TENANT_URL);
    expect(resp.status()).toBe(200);

    const headers = resp.headers();
    expect(headers['content-type']).toContain('text/html');
  });

  test('homepage carrega com header e footer', async ({ page }) => {
    await page.goto(TENANT_URL);
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
    // CSS deve ter sido carregado (verificar que estilos aplicaram)
    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    // Deve ser o dark theme (#0a0a0f = rgb(10, 10, 15))
    expect(bgColor).toContain('rgb(10, 10, 15)');
  });

  test('categoria carrega corretamente', async ({ page }) => {
    await page.goto(`${TENANT_URL}/categories`);
    const firstCategory = page.locator('a[href*="/category/"]').first();
    if (await firstCategory.isVisible()) {
      await firstCategory.click();
      await expect(page.locator('h1')).toBeVisible();
    }
  });
});
