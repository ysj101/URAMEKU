import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './qa/telemetry',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  use: {
    baseURL: 'http://localhost:4186',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  webServer: {
    command: 'npm run build && npm run preview -- --host localhost --port 4186 --strictPort',
    url: 'http://localhost:4186',
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      VITE_BASE_PATH: '/',
      VITE_JOURNEYGAP_ENABLED: 'true',
      VITE_JOURNEYGAP_COLLECTOR_URL: 'http://127.0.0.1:14328/collect/test-app',
    },
  },
});
