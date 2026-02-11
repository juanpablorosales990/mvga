import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

const MOCK_TRANSACTIONS = [
  {
    signature: 'tx-abc123def456789abc123def456789abc123def456789abc123def456789abcd',
    timestamp: Math.floor(Date.now() / 1000) - 3600,
    type: 'TRANSFER',
    source: 'SYSTEM_PROGRAM',
    description: 'Sent 10 USDC',
    fee: 0.000005,
    feePayer: 'MockWallet1234',
    nativeTransfers: [],
    tokenTransfers: [
      {
        fromUserAccount: 'MockWallet1234',
        toUserAccount: 'Recipient1111111111111111111111111111111111111',
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        tokenAmount: 10,
        tokenStandard: 'Fungible',
      },
    ],
    amount: 10,
    token: 'USDC',
  },
  {
    signature: 'tx-xyz789abc123def456789abc123def456789abc123def456789abc123def4567',
    timestamp: Math.floor(Date.now() / 1000) - 7200,
    type: 'TRANSFER',
    source: 'SYSTEM_PROGRAM',
    description: '',
    fee: 0.000005,
    feePayer: 'Sender222222222222222222222222222222222222222',
    nativeTransfers: [
      {
        fromUserAccount: 'Sender222222222222222222222222222222222222222',
        toUserAccount: 'MockWallet1234',
        amount: 500000000, // 0.5 SOL in lamports
      },
    ],
    tokenTransfers: [],
    amount: 0.5,
    token: 'SOL',
  },
];

test.describe('Receipt Modal — History Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock wallet transaction endpoints
    await page.route('**/api/wallet/*/transactions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TRANSACTIONS),
      })
    );
    await page.route('**/api/wallet/*/transaction-log', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );

    await createWalletAndUnlock(page);

    // Navigate via More → History
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');
    await page
      .getByRole('link', { name: /history|historial/i })
      .first()
      .click();
    await expect(page).toHaveURL('/history');
  });

  test('history page shows transactions', async ({ page }) => {
    // Should show the transaction type badges
    await expect(page.getByText(/transfer|transferencia/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('receipt button visible on transactions', async ({ page }) => {
    // Wait for transactions to load
    await expect(page.getByText(/transfer|transferencia/i).first()).toBeVisible({ timeout: 10000 });

    // Receipt button (SVG icon) should be visible — use the title attribute
    const receiptButtons = page.locator('button[title]').filter({
      has: page.locator('svg'),
    });
    await expect(receiptButtons.first()).toBeVisible({ timeout: 5000 });
  });

  test('clicking receipt button opens receipt modal', async ({ page }) => {
    // Wait for transactions to load
    await expect(page.getByText(/transfer|transferencia/i).first()).toBeVisible({ timeout: 10000 });

    // Click the receipt button on the first transaction
    const receiptButtons = page.locator('button[title]').filter({
      has: page.locator('svg'),
    });
    await receiptButtons.first().click();

    // Receipt modal should appear with title
    await expect(page.getByText(/transaction receipt|recibo de transacción/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('receipt modal shows share and close buttons', async ({ page }) => {
    await expect(page.getByText(/transfer|transferencia/i).first()).toBeVisible({ timeout: 10000 });

    const receiptButtons = page.locator('button[title]').filter({
      has: page.locator('svg'),
    });
    await receiptButtons.first().click();

    // Modal header
    await expect(page.getByText(/transaction receipt|recibo de transacción/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Close button
    await expect(page.getByRole('button', { name: /close|cerrar/i }).first()).toBeVisible();

    // Share button
    await expect(
      page.getByRole('button', { name: /share receipt|compartir recibo/i }).first()
    ).toBeVisible();
  });

  test('receipt modal shows receipt image preview', async ({ page }) => {
    await expect(page.getByText(/transfer|transferencia/i).first()).toBeVisible({ timeout: 10000 });

    const receiptButtons = page.locator('button[title]').filter({
      has: page.locator('svg'),
    });
    await receiptButtons.first().click();

    await expect(page.getByText(/transaction receipt|recibo de transacción/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Image preview should load (canvas → blob URL → img)
    const img = page.locator('img[alt="Transaction receipt"]');
    await expect(img).toBeVisible({ timeout: 10000 });
  });

  test('receipt modal closes on X button', async ({ page }) => {
    await expect(page.getByText(/transfer|transferencia/i).first()).toBeVisible({ timeout: 10000 });

    const receiptButtons = page.locator('button[title]').filter({
      has: page.locator('svg'),
    });
    await receiptButtons.first().click();

    await expect(page.getByText(/transaction receipt|recibo de transacción/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Click X (×) button
    await page.locator('button:has-text("×")').click();

    // Modal should be gone
    await expect(page.getByText(/transaction receipt|recibo de transacción/i)).not.toBeVisible({
      timeout: 5000,
    });
  });

  test('receipt modal closes on close button', async ({ page }) => {
    await expect(page.getByText(/transfer|transferencia/i).first()).toBeVisible({ timeout: 10000 });

    const receiptButtons = page.locator('button[title]').filter({
      has: page.locator('svg'),
    });
    await receiptButtons.first().click();

    await expect(page.getByText(/transaction receipt|recibo de transacción/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Click Close button
    await page
      .getByRole('button', { name: /close|cerrar/i })
      .first()
      .click();

    await expect(page.getByText(/transaction receipt|recibo de transacción/i)).not.toBeVisible({
      timeout: 5000,
    });
  });

  test('receipt modal closes on backdrop click', async ({ page }) => {
    await expect(page.getByText(/transfer|transferencia/i).first()).toBeVisible({ timeout: 10000 });

    const receiptButtons = page.locator('button[title]').filter({
      has: page.locator('svg'),
    });
    await receiptButtons.first().click();

    await expect(page.getByText(/transaction receipt|recibo de transacción/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Click the backdrop (the absolute overlay behind the modal)
    const backdrop = page.locator('.fixed.inset-0 > .absolute.inset-0');
    await backdrop.click({ position: { x: 10, y: 10 } });

    await expect(page.getByText(/transaction receipt|recibo de transacción/i)).not.toBeVisible({
      timeout: 5000,
    });
  });

  test('export buttons visible when transactions exist', async ({ page }) => {
    await expect(page.getByText(/transfer|transferencia/i).first()).toBeVisible({ timeout: 10000 });

    // CSV export button
    await expect(page.getByText(/export csv|exportar csv/i).first()).toBeVisible();

    // PDF export button
    await expect(page.getByText(/export pdf|exportar pdf/i).first()).toBeVisible();
  });
});
