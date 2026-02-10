import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

const MOCK_TREASURY_STATS = {
  mainBalance: 1000000,
  liquidityBalance: 400000,
  stakingBalance: 400000,
  grantsBalance: 200000,
  totalRevenue: 5000,
  totalDistributed: 4500,
  pendingDistribution: 500,
  nextDistributionAt: new Date(Date.now() + 86400000).toISOString(),
  lastDistributionAt: new Date().toISOString(),
  distributionBreakdown: {
    liquidityPercent: 40,
    stakingPercent: 40,
    grantsPercent: 20,
  },
};

const MOCK_DISTRIBUTIONS = [
  {
    id: 'dist-1',
    totalAmount: 1000,
    liquidityAmount: 400,
    stakingAmount: 400,
    grantsAmount: 200,
    status: 'COMPLETED',
    periodStart: new Date(Date.now() - 86400000 * 7).toISOString(),
    periodEnd: new Date().toISOString(),
    executedAt: new Date().toISOString(),
    transactions: { liquidity: 'tx1', staking: 'tx2', grants: 'tx3' },
  },
];

const MOCK_BURN_STATS = {
  totalBurned: 50000,
  burnCount: 5,
  lastBurnAt: new Date().toISOString(),
  lastBurnAmount: 10000,
  lastBurnTx: '5abc123',
  supplyReduction: 0.5,
};

const MOCK_BURN_HISTORY = [
  {
    id: 'burn-1',
    amount: 10000,
    source: 'SWAP_FEES',
    txSignature: '5abc123',
    createdAt: new Date().toISOString(),
  },
];

test.describe('Transparency Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/treasury/stats', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TREASURY_STATS),
      })
    );

    await page.route('**/api/treasury/distributions*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DISTRIBUTIONS),
      })
    );

    await page.route('**/api/burn/stats', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BURN_STATS),
      })
    );

    await page.route('**/api/burn/history*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BURN_HISTORY),
      })
    );

    await createWalletAndUnlock(page);

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');
    await page
      .getByRole('link', { name: /transparency|transparencia/i })
      .first()
      .click();
    await expect(page).toHaveURL('/transparency');
  });

  test('page loads with title', async ({ page }) => {
    await expect(page.getByText(/transparency|transparencia/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows mission statement', async ({ page }) => {
    await expect(page.getByText(/mission|misión/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows distribution breakdown', async ({ page }) => {
    await expect(page.getByText(/40%/).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/20%/).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows treasury balances', async ({ page }) => {
    await expect(page.getByText(/treasury|tesorer/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/liquidity|liquidez/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows token burns section', async ({ page }) => {
    await expect(page.getByText(/burn|quemad/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/50,000|50.000/).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows verify on-chain section', async ({ page }) => {
    await expect(page.getByText(/verify.*chain|verificar.*cadena/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows zero founder fees', async ({ page }) => {
    await expect(page.getByText(/zero.*fee|sin.*comisi/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows recent distributions', async ({ page }) => {
    await expect(
      page.getByText(/recent.*distribution|distribuciones.*recientes/i).first()
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/COMPLETED|completad/i).first()).toBeVisible({ timeout: 10000 });
  });
});
