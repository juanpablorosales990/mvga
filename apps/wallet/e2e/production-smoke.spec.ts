import { test, expect } from '@playwright/test';

/**
 * Smoke test against production (app.mvga.io).
 * Only run manually: npx playwright test e2e/production-smoke.spec.ts
 */

test.use({ baseURL: 'https://app.mvga.io' });

test('production: app loads and shows onboarding or lock screen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: '/tmp/mvga-production.png', fullPage: true });

  // Check for fatal errors
  console.log('Page errors:', errors);

  // The page should render MVGA somewhere — either onboarding or lock screen
  const rootHTML = await page.evaluate(
    () => document.getElementById('root')?.innerHTML?.slice(0, 500) || '(empty)'
  );
  console.log('Root HTML:', rootHTML);

  // Must NOT be empty root
  expect(rootHTML).not.toBe('(empty)');
  expect(rootHTML.length).toBeGreaterThan(50);

  // Should contain MVGA text
  await expect(page.getByText('MVGA').first()).toBeVisible({ timeout: 10000 });

  // Should show either onboarding or lock screen
  const isOnboarding = await page
    .getByText('Create New Wallet')
    .isVisible()
    .catch(() => false);
  const isLockScreen = await page
    .getByText('Wallet Locked')
    .isVisible()
    .catch(() => false);

  console.log('isOnboarding:', isOnboarding, 'isLockScreen:', isLockScreen);
  expect(isOnboarding || isLockScreen).toBe(true);
});
