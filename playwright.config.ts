import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.ANATOMY_TEST_PORT ?? 4173);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    ...(process.env.ANATOMY_USE_CHROME === '1' ? { channel: 'chrome' } : {}),
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
