import { defineConfig, devices } from '@playwright/test';

// Verification 9, 11 and 12 run here: the 390 / 834 / 1440 × rtl / ltr matrix and the role walks.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure' },
  projects: [
    { name: 'phone-390', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'tablet-834', use: { ...devices['Desktop Chrome'], viewport: { width: 834, height: 1194 } } },
    { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npx next dev -p 3100',
    url: 'http://localhost:3100/ar',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
