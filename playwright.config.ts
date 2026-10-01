import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'app',
      testMatch: ['app.spec.ts', 'haptics.spec.ts'],
      use: { baseURL: 'http://127.0.0.1:5174' },
    },
    {
      name: 'offline',
      testMatch: 'offline.spec.ts',
      use: { baseURL: 'http://127.0.0.1:4174' },
    },
  ],
  webServer: [
    {
      command:
        'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: process.env.WAX_TEST_SERVER === '1',
      env: { VITE_GUESTBOOK_MODE: 'local' },
    },
    {
      command:
        'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4174 --strictPort',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: process.env.WAX_TEST_SERVER === '1',
    },
  ],
});
