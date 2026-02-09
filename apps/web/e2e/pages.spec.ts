import { test, expect } from '@playwright/test';

test.describe('Grants Page', () => {
  // Grants page does SSR data fetching to the API. When the API is not running locally,
  // Next.js dev server is slow on first compile due to ECONNREFUSED retries.
  // Serial mode + retries prevent flaky failures from cold compilation.
  test.describe.configure({ mode: 'serial', retries: 1 });
  test.setTimeout(120000);

  test('loads and shows heading', async ({ page }) => {
    await page.goto('/grants', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await expect(page.locator('text=Community Grants')).toBeVisible({ timeout: 20000 });
  });

  test('has submit proposal button linking to app', async ({ page }) => {
    await page.goto('/grants', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const submitBtn = page.locator('a:has-text("Submit a Proposal")');
    await expect(submitBtn).toBeVisible({ timeout: 15000 });
    await expect(submitBtn).toHaveAttribute('href', 'https://app.mvga.io/grants/create');
  });

  test('shows How It Works section with 4 steps', async ({ page }) => {
    await page.goto('/grants', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('text=How It Works')).toBeVisible({ timeout: 15000 });
    await page.locator('text=How It Works').scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: 'Apply' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Vote' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Fund', exact: true })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByRole('heading', { name: 'Update' })).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Transparency Page', () => {
  test('loads and shows heading', async ({ page }) => {
    await page.goto('/transparency');
    await expect(page.locator('text=Full Transparency')).toBeVisible();
  });

  test('shows Treasury Wallets section with 6 wallets', async ({ page }) => {
    await page.goto('/transparency');
    await expect(page.locator('text=Treasury Wallets')).toBeVisible();

    // All 6 wallet names should be visible
    await expect(page.locator('text=Main Treasury')).toBeVisible();
    await expect(page.locator('text=Humanitarian Fund').first()).toBeVisible();
    await expect(page.locator('text=Staking Vault').first()).toBeVisible();
    await expect(page.locator('text=Team Vesting').first()).toBeVisible();
    await expect(page.locator('text=Marketing').first()).toBeVisible();
    await expect(page.locator('text=Advisors').first()).toBeVisible();
  });

  test('wallet addresses link to Solscan', async ({ page }) => {
    await page.goto('/transparency');

    // Check that Solscan links exist for treasury wallet
    const solscanLinks = page.locator('a[href*="solscan.io/account/"]');
    const count = await solscanLinks.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('shows Verify Our Claims section', async ({ page }) => {
    await page.goto('/transparency');
    await expect(page.locator('text=Verify Our Claims')).toBeVisible();
    await expect(page.locator('text=LP Locked')).toBeVisible();
    await expect(page.locator('text=Mint Authority Renounced')).toBeVisible();
    await expect(page.locator('text=Open Source Code')).toBeVisible();
  });

  test('GitHub link points to correct repo', async ({ page }) => {
    await page.goto('/transparency');
    const githubLink = page.locator('a[href="https://github.com/juanpablorosales990/mvga"]');
    await expect(githubLink.first()).toBeVisible();
  });
});

test.describe('Wallet Redirect', () => {
  test('/wallet redirects to app.mvga.io', async ({ page }) => {
    const response = await page.request.get('/wallet', { maxRedirects: 0 });
    // Should get a redirect status (301 or 308)
    expect([301, 302, 307, 308]).toContain(response.status());
    const location = response.headers()['location'];
    // Next.js may add trailing slash
    expect(location?.replace(/\/$/, '')).toBe('https://app.mvga.io');
  });
});
