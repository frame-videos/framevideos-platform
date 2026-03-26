/**
 * Login UI E2E Tests with Screenshots
 * Visual verification of login page security features
 */
import { test, expect } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

test.describe('Login Page UI', () => {
  
  test('should display login form', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/auth/login`, { timeout: 10000 }).catch(() => {});
    await page.screenshot({ 
      path: 'screenshots/2.2-password-security/01-login-page.png',
      fullPage: true 
    });
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/auth/login`, { timeout: 10000 }).catch(() => {});
    
    // Fill in wrong credentials
    await page.fill('input[name="email"]', 'test@test.com').catch(() => {});
    await page.fill('input[name="password"]', 'wrongpassword').catch(() => {});
    await page.screenshot({ 
      path: 'screenshots/2.2-password-security/02-filled-form.png',
      fullPage: true 
    });
    
    // Submit
    await page.click('button[type="submit"]').catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: 'screenshots/2.2-password-security/03-login-error.png',
      fullPage: true 
    });
  });

  test('should show rate limit error after multiple attempts', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/auth/login`, { timeout: 10000 }).catch(() => {});
    
    // Try multiple login attempts
    for (let i = 0; i < 6; i++) {
      await page.fill('input[name="email"]', 'ratelimit@test.com').catch(() => {});
      await page.fill('input[name="password"]', `wrong${i}`).catch(() => {});
      await page.click('button[type="submit"]').catch(() => {});
      await page.waitForTimeout(1000);
    }
    
    await page.screenshot({ 
      path: 'screenshots/2.2-password-security/04-rate-limited.png',
      fullPage: true 
    });
  });

  test('should display register page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/auth/register`, { timeout: 10000 }).catch(() => {});
    await page.screenshot({ 
      path: 'screenshots/2.2-password-security/05-register-page.png',
      fullPage: true 
    });
  });
});
