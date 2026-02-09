import { defineConfig } from '@playwright/test';

/**
 * Root Playwright config — delegates to per-app configs.
 * Prevents `npx playwright test` from root picking up Jest/Vitest spec files.
 */
export default defineConfig({
  testDir: '.',
  testMatch: ['apps/wallet/e2e/**/*.spec.ts', 'apps/web/e2e/**/*.spec.ts'],
  testIgnore: ['**/node_modules/**', '**/src/**'],
});
