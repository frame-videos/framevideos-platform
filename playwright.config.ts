import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    screenshot: 'on',
    trace: 'on-first-retry',
  },
  outputDir: './screenshots/2.2-password-security',
});
